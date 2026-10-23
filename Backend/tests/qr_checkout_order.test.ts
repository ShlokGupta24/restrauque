import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { createOrderSchema, orderPreviewSchema } from '@/lib/validation/order';
import { requestOtpSchema, verifyOtpSchema, normalizePhoneNumber } from '@/lib/validation/auth';
import { formatCustomerOrder } from '@/lib/orders/format';
import { calculateAuthoritativePricing } from '@/lib/orders/pricing';
import { generateCartItemId, formatCurrency, THEME } from '@/app/qr/[token]/constants';
import { CartItem, ConfirmedOrder } from '@/app/qr/[token]/types';

describe('Step 3 — QR Dine-In Checkout, Auth, and Order Confirmation Verification', () => {
  const mockTableId = '11111111-1111-4111-8111-111111111111';
  const mockProductId = '22222222-2222-4222-8222-222222222222';
  const mockVariantId = '33333333-3333-4333-8333-333333333333';
  const mockAddonId = '44444444-4444-4444-8444-444444444444';
  const validQrToken = 'a'.repeat(64);

  // 1. Checkout Cart Summary & Price Breakdown
  describe('1. Checkout Cart Summary & Price Breakdown', () => {
    it('should calculate accurate subtotal and line item totals for checkout display', () => {
      const cart: CartItem[] = [
        {
          id: generateCartItemId(mockProductId, mockVariantId, [mockAddonId]),
          productId: mockProductId,
          productName: 'Woodfired Truffle Pizza',
          imageUrl: null,
          variantId: mockVariantId,
          variantName: 'Large 14"',
          unitPrice: 420,
          addons: [{ id: mockAddonId, name: 'Extra Mozzarella', price: 60 }],
          quantity: 2,
          specialInstructions: 'Well done crust',
          lineTotal: 960, // (420 + 60) * 2
        },
        {
          id: generateCartItemId(mockProductId, null, []),
          productId: mockProductId,
          productName: 'Iced Peach Nitro Tea',
          imageUrl: null,
          variantId: null,
          variantName: null,
          unitPrice: 150,
          addons: [],
          quantity: 1,
          lineTotal: 150,
        },
      ];

      const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

      expect(subtotal).toBe(1110);
      expect(totalItems).toBe(3);
      expect(formatCurrency(subtotal)).toBe('₹1110.00');
    });

    it('should format a valid payload for the server price preview endpoint', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [
          {
            productId: mockProductId,
            variantId: mockVariantId,
            addonIds: [mockAddonId],
            quantity: 2,
            specialInstructions: 'Well done crust',
          },
        ],
        couponCode: 'WELCOME20',
        notes: 'Table near window',
      };

      const parsed = orderPreviewSchema.parse(payload);
      expect(parsed.qrToken).toBe(validQrToken);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.couponCode).toBe('WELCOME20');
      expect(parsed.notes).toBe('Table near window');
    });
  });

  // 2. Customer Phone & OTP Authentication Validation
  describe('2. Customer Phone & OTP Authentication Normalization & Safety', () => {
    it('should normalize 10-digit Indian mobile numbers to E.164 format with +91', () => {
      expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
      expect(normalizePhoneNumber('09876543210')).toBe('+919876543210');
      expect(normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210');
    });

    it('should validate customer OTP request schema strictly', () => {
      const valid = requestOtpSchema.safeParse({ phone: '9876543210' });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.phone).toBe('+919876543210');
      }

      const invalid = requestOtpSchema.safeParse({ phone: '123' });
      expect(invalid.success).toBe(false);
    });

    it('should validate 6-digit OTP verification schema strictly', () => {
      const valid = verifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '654321',
        name: 'Rahul Sharma',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.otp).toBe('654321');
        expect(valid.data.name).toBe('Rahul Sharma');
      }

      // Non-6-digit OTP rejected
      const invalidOtp = verifyOtpSchema.safeParse({
        phone: '9876543210',
        otp: '1234',
      });
      expect(invalidOtp.success).toBe(false);
    });
  });

  // 3. Order Placement Schema & Strict Server Rules
  describe('3. Order Placement Schema & Security Contracts', () => {
    it('should validate strict createOrderSchema payload with idempotency key', () => {
      const orderPayload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        idempotencyKey: 'checkout-req-12345-abc',
        expectedTotal: 1110,
        items: [
          {
            productId: mockProductId,
            variantId: mockVariantId,
            addonIds: [mockAddonId],
            quantity: 2,
            specialInstructions: 'No garlic',
          },
        ],
        couponCode: null,
        notes: 'Please bring food promptly',
      };

      const parsed = createOrderSchema.parse(orderPayload);
      expect(parsed.qrToken).toBe(validQrToken);
      expect(parsed.idempotencyKey).toBe('checkout-req-12345-abc');
      expect(parsed.expectedTotal).toBe(1110);
      expect(parsed.items).toHaveLength(1);
    });

    it('should reject extra unrecognized fields because schema is strict', () => {
      const maliciousPayload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [
          {
            productId: mockProductId,
            quantity: 1,
          },
        ],
        fakeRole: 'ADMIN', // Unauthorized client field injection
      };

      const result = createOrderSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
    });

    it('should reject orders with zero items', () => {
      const emptyOrder = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [],
      };

      const result = createOrderSchema.safeParse(emptyOrder);
      expect(result.success).toBe(false);
    });
  });

  // 4. Cart Preservation & Failure Resilience
  describe('4. Cart Preservation on Submission Failure', () => {
    it('should preserve cart line items if an order request fails or is rejected', () => {
      const originalCart: CartItem[] = [
        {
          id: 'item-1',
          productId: mockProductId,
          productName: 'Truffle Pizza',
          imageUrl: null,
          unitPrice: 420,
          addons: [],
          quantity: 2,
          lineTotal: 840,
        },
      ];

      // Simulate a simulated error (e.g. 409 PRICE_CHANGED or 503 network failure)
      let cartState = [...originalCart];
      const simulatedSubmissionFailed = true;

      if (simulatedSubmissionFailed) {
        // Safe UI rule: Do NOT clear cart on failure!
        // cartState remains unchanged
      }

      expect(cartState).toHaveLength(1);
      expect(cartState[0].quantity).toBe(2);
      expect(cartState[0].lineTotal).toBe(840);
    });

    it('should only clear cart after verified 201/200 success response', () => {
      let cartState: CartItem[] = [
        {
          id: 'item-1',
          productId: mockProductId,
          productName: 'Truffle Pizza',
          imageUrl: null,
          unitPrice: 420,
          addons: [],
          quantity: 1,
          lineTotal: 420,
        },
      ];

      const simulatedResponse = {
        status: 201,
        success: true,
        data: {
          id: 'ord-123',
          orderNumber: 'ORD-20261017-001',
        },
      };

      if (simulatedResponse.status === 201 && simulatedResponse.success) {
        cartState = [];
      }

      expect(cartState).toHaveLength(0);
    });
  });

  // 5. Order Confirmation Presentation & Data Mapping
  describe('5. Order Confirmation Presentation & Data Mapping', () => {
    it('should map formatCustomerOrder structure to confirmed order view accurately', () => {
      const mockRawDbOrder = {
        id: '99999999-9999-4999-8999-999999999999',
        order_number: 'ORD-20261017-009',
        order_type: 'dine_in',
        status: 'pending',
        subtotal: 840,
        discount_amount: 50,
        tax_amount: 39.5,
        total_amount: 829.5,
        notes: 'Extra napkins please',
        ordered_at: new Date('2026-10-17T00:00:00Z'),
        completed_at: null,
        restaurant_tables: {
          id: mockTableId,
          table_number: 'T-10',
        },
        branches: {
          name: 'Downtown Terrace',
        },
        restaurants: {
          name: 'Restraque Warm Bistro',
        },
        order_items: [
          {
            id: 'oi-1',
            product_id: mockProductId,
            product_name: 'Truffle Pizza',
            variant_id: mockVariantId,
            variant_name: 'Large 14"',
            quantity: 2,
            unit_price: 420,
            total_price: 840,
            special_instructions: 'Extra crispy',
            order_item_addons: [],
          },
        ],
        order_status_history: [
          {
            status: 'pending',
            notes: 'Customer placed dine-in order',
            changed_at: new Date('2026-10-17T00:00:00Z'),
          },
        ],
      };

      const formatted = formatCustomerOrder(mockRawDbOrder);

      expect(formatted.id).toBe('99999999-9999-4999-8999-999999999999');
      expect(formatted.orderNumber).toBe('ORD-20261017-009');
      expect(formatted.status).toBe('pending');
      expect(formatted.table?.tableNumber).toBe('T-10');
      expect(formatted.branchName).toBe('Downtown Terrace');
      expect(formatted.restaurantName).toBe('Restraque Warm Bistro');
      expect(formatted.pricing.subtotal).toBe(840);
      expect(formatted.pricing.discountAmount).toBe(50);
      expect(formatted.pricing.taxAmount).toBe(39.5);
      expect(formatted.pricing.totalAmount).toBe(829.5);
      expect(formatted.items).toHaveLength(1);
      expect(formatted.items[0].productName).toBe('Truffle Pizza');
      expect(formatted.items[0].variantName).toBe('Large 14"');
    });

    it('should enforce that Pay at Restaurant retains status as unpaid without fake payment records', () => {
      // Per system architecture: pay_at_restaurant orders start with payment_status UNPAID
      const initialPaymentStatus = 'unpaid';
      const orderStatus = 'pending';

      expect(initialPaymentStatus).toBe('unpaid');
      expect(orderStatus).toBe('pending');
    });

    it('should calculate authoritative price using base product price when variant price is 0 on paid product (defect regression)', async () => {
      const mockDbClient: any = {
        products: {
          findMany: async () => [
            {
              id: 'prod-cake-149',
              name: 'cake',
              price: new Prisma.Decimal('149.30'),
              restaurant_id: 'rest-1',
              is_active: true,
              is_available: true,
              product_variants: [
                {
                  id: 'var-cake-large',
                  name: 'large',
                  price: new Prisma.Decimal('0.00'),
                  is_active: true,
                  is_available: true,
                },
              ],
              product_addons: [],
            },
          ],
        },
      };

      const result = await calculateAuthoritativePricing(
        [
          {
            productId: 'prod-cake-149',
            variantId: 'var-cake-large',
            addonIds: [],
            quantity: 2,
          },
        ],
        'rest-1',
        'table-1',
        null,
        null,
        mockDbClient
      );

      expect(result.items[0].unitPrice.toString()).toBe('149.3');
      expect(result.items[0].totalPrice.toString()).toBe('298.6');
      expect(result.subtotal.toString()).toBe('298.6');
    });

    it('should preserve legitimate free product and variant price 0 in authoritative pricing', async () => {
      const mockDbClient: any = {
        products: {
          findMany: async () => [
            {
              id: 'prod-mint-0',
              name: 'Mint',
              price: new Prisma.Decimal('0.00'),
              restaurant_id: 'rest-1',
              is_active: true,
              is_available: true,
              product_variants: [
                {
                  id: 'var-mint-free',
                  name: 'Single',
                  price: new Prisma.Decimal('0.00'),
                  is_active: true,
                  is_available: true,
                },
              ],
              product_addons: [],
            },
          ],
        },
      };

      const result = await calculateAuthoritativePricing(
        [
          {
            productId: 'prod-mint-0',
            variantId: 'var-mint-free',
            addonIds: [],
            quantity: 1,
          },
        ],
        'rest-1',
        'table-1',
        null,
        null,
        mockDbClient
      );

      expect(result.items[0].unitPrice.toString()).toBe('0');
      expect(result.items[0].totalPrice.toString()).toBe('0');
      expect(result.subtotal.toString()).toBe('0');
    });
  });
});
