import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  orderPreviewSchema,
  createOrderSchema,
  OrderItemInput,
} from '@/lib/validation/order';
import {
  calculateAuthoritativePricing,
  computeCanonicalPayloadHash,
} from '@/lib/orders/pricing';
import {
  MIN_REDEMPTION_POINTS,
  MAX_REDEMPTION_DISCOUNT_PERCENTAGE,
} from '@/lib/loyalty/service';
import { POST as previewOrderHandler } from '@/app/api/v1/customer/orders/preview/route';
import { POST as createOrderHandler } from '@/app/api/v1/customer/orders/route';
import { requireCustomer } from '@/lib/auth/guard';
import { resolveQrContext } from '@/lib/qr/resolve';
import { generateUniqueOrderNumber } from '@/lib/orders/number';

// Mock dependencies
vi.mock('@/lib/auth/guard', () => ({
  requireCustomer: vi.fn(),
}));

vi.mock('@/lib/qr/resolve', () => ({
  resolveQrContext: vi.fn(),
}));

vi.mock('@/lib/orders/number', () => ({
  generateUniqueOrderNumber: vi.fn().mockResolvedValue('ORD-12345'),
}));

vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(),
    products: {
      findMany: vi.fn(),
    },
    coupons: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    loyalty_programs: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customer_loyalty_accounts: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    loyalty_transactions: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    orders: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order_items: {
      create: vi.fn(),
    },
    order_item_addons: {
      createMany: vi.fn(),
    },
    order_coupons: {
      create: vi.fn(),
    },
    order_status_history: {
      create: vi.fn(),
    },
    restaurant_tables: {
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 42 — Atomic Checkout Loyalty Points Redemption', () => {
  const mockRestaurantId = '11111111-1111-4111-8111-111111111111';
  const mockBranchId = '22222222-2222-4222-8222-222222222222';
  const mockTableId = '33333333-3333-4333-8333-333333333333';
  const mockCustomerId = '44444444-4444-4444-8444-444444444444';
  const mockAccountId = '55555555-5555-4555-8555-555555555555';
  const mockProductId = '66666666-6666-4666-8666-666666666666';
  const validQrToken = 'a'.repeat(64);

  const mockProduct = {
    id: mockProductId,
    restaurant_id: mockRestaurantId,
    name: 'Truffle Risotto',
    price: new Prisma.Decimal('400.00'),
    is_active: true,
    is_available: true,
    product_variants: [],
    product_addons: [],
  };

  const defaultMockProgram = {
    id: 'prog-1',
    restaurant_id: mockRestaurantId,
    name: 'Dining Rewards',
    description: 'Earn points and redeem discounts',
    is_active: true,
    earning_mode: 'visit_and_review',
    stars_per_visit: 5,
    stars_per_review: 10,
    redemption_rate: new Prisma.Decimal('1.00'),
  };

  const defaultMockAccount = {
    id: mockAccountId,
    customer_id: mockCustomerId,
    restaurant_id: mockRestaurantId,
    stars_balance: 100,
    lifetime_stars_earned: 150,
    lifetime_stars_redeemed: 50,
  };

  const standardOrderItem: OrderItemInput = {
    productId: mockProductId,
    quantity: 1,
    addonIds: [],
    variantId: null,
    specialInstructions: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireCustomer).mockResolvedValue({
      user: {
        id: mockCustomerId,
        role: 'CUSTOMER',
        phone: '+919876543210',
        name: 'Test Customer',
      } as any,
      sessionId: 'session-123',
    });

    vi.mocked(resolveQrContext).mockResolvedValue({
      qrRecord: { id: 'qr-1', table_id: mockTableId, code: 'hash', is_active: true },
      table: {
        id: mockTableId,
        branch_id: mockBranchId,
        table_number: 'T1',
        capacity: 4,
        status: 'available',
        is_active: true,
      },
      branch: {
        id: mockBranchId,
        restaurant_id: mockRestaurantId,
        name: 'Main Branch',
        status: 'active',
        timezone: 'Asia/Kolkata',
      },
      restaurant: {
        id: mockRestaurantId,
        name: 'The Truffle Table',
        status: 'active',
      },
    });

    vi.mocked(prisma.products.findMany).mockResolvedValue([mockProduct as any]);
    vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(defaultMockProgram as any);
    vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValue(defaultMockAccount as any);
    vi.mocked(prisma.coupons.findFirst).mockResolvedValue(null);
  });

  // =========================================================================
  // 1. Request Schemas & Contract Validation
  // =========================================================================
  describe('1. Checkout API Contract & Input Validation', () => {
    it('accepts order preview and creation payloads without pointsToRedeem (backward compatibility)', () => {
      const previewPayload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
      };
      const parsedPreview = orderPreviewSchema.parse(previewPayload);
      expect(parsedPreview.pointsToRedeem).toBeUndefined();

      const createPayload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
      };
      const parsedCreate = createOrderSchema.parse(createPayload);
      expect(parsedCreate.pointsToRedeem).toBeUndefined();
    });

    it('accepts explicit null for pointsToRedeem', () => {
      const previewPayload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: null,
      };
      const parsed = orderPreviewSchema.parse(previewPayload);
      expect(parsed.pointsToRedeem).toBeNull();
    });

    it('accepts positive integer pointsToRedeem', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: 25,
      };
      const parsed = orderPreviewSchema.parse(payload);
      expect(parsed.pointsToRedeem).toBe(25);
    });

    it('rejects negative pointsToRedeem', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: -10,
      };
      expect(() => orderPreviewSchema.parse(payload)).toThrow(/positive/);
      expect(() => createOrderSchema.parse(payload)).toThrow(/positive/);
    });

    it('rejects zero pointsToRedeem', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: 0,
      };
      expect(() => orderPreviewSchema.parse(payload)).toThrow(/positive/);
      expect(() => createOrderSchema.parse(payload)).toThrow(/positive/);
    });

    it('rejects fractional pointsToRedeem', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: 20.5,
      };
      expect(() => orderPreviewSchema.parse(payload)).toThrow(/integer/);
      expect(() => createOrderSchema.parse(payload)).toThrow(/integer/);
    });

    it('rejects string non-numeric pointsToRedeem', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: 'twenty',
      };
      expect(() => orderPreviewSchema.parse(payload)).toThrow(/number/);
    });

    it('rejects unknown fields injected into payload due to strict schema', () => {
      const payload = {
        qrToken: validQrToken,
        tableId: mockTableId,
        items: [{ productId: mockProductId, quantity: 1 }],
        pointsToRedeem: 20,
        fakeDiscountRate: 100, // Unauthorized field
      };
      expect(() => orderPreviewSchema.parse(payload)).toThrow();
      expect(() => createOrderSchema.parse(payload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Canonical Idempotency Payload Hash
  // =========================================================================
  describe('2. Canonical Idempotency Hash Differentiation', () => {
    it('produces identical hashes for identical payloads', () => {
      const items: OrderItemInput[] = [standardOrderItem];
      const hash1 = computeCanonicalPayloadHash(mockTableId, items, 'SAVE10', 'Window seat', 25);
      const hash2 = computeCanonicalPayloadHash(mockTableId, items, 'SAVE10', 'Window seat', 25);
      expect(hash1).toBe(hash2);
    });

    it('produces different hash when pointsToRedeem changes', () => {
      const items: OrderItemInput[] = [standardOrderItem];
      const hash1 = computeCanonicalPayloadHash(mockTableId, items, null, null, 20);
      const hash2 = computeCanonicalPayloadHash(mockTableId, items, null, null, 30);
      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash between omitting pointsToRedeem and specifying pointsToRedeem', () => {
      const items: OrderItemInput[] = [standardOrderItem];
      const hashWithout = computeCanonicalPayloadHash(mockTableId, items, null, null, null);
      const hashWith = computeCanonicalPayloadHash(mockTableId, items, null, null, 20);
      expect(hashWithout).not.toBe(hashWith);
    });
  });

  // =========================================================================
  // 3. Server-Authoritative Pricing Calculation
  // =========================================================================
  describe('3. Server-Authoritative Pricing & Redemption Business Rules', () => {
    const mockDb: any = {
      products: {
        findMany: async () => [mockProduct],
      },
      coupons: {
        findFirst: async () => null,
      },
      loyalty_programs: {
        findUnique: async () => defaultMockProgram,
      },
      customer_loyalty_accounts: {
        findUnique: async () => defaultMockAccount,
      },
    };

    it('computes ordinary checkout without pointsToRedeem', async () => {
      const result = await calculateAuthoritativePricing(
        [standardOrderItem],
        mockRestaurantId,
        mockTableId,
        null,
        null,
        mockDb
      );

      expect(result.subtotal.toFixed(2)).toBe('400.00');
      expect(result.discountAmount.toFixed(2)).toBe('0.00');
      expect(result.loyaltyDiscountAmount.toFixed(2)).toBe('0.00');
      expect(result.pointsRedeemed).toBe(0);
      expect(result.totalAmount.toFixed(2)).toBe('400.00');
    });

    it('computes valid loyalty redemption with default 1.00 rate', async () => {
      const result = await calculateAuthoritativePricing(
        [standardOrderItem],
        mockRestaurantId,
        mockTableId,
        null,
        null,
        mockDb,
        { pointsToRedeem: 30, customerId: mockCustomerId }
      );

      // Subtotal ₹400, coupon ₹0, eligible spend ₹400
      // 30 points * ₹1.00 = ₹30.00 (within 50% cap of ₹200)
      expect(result.subtotal.toFixed(2)).toBe('400.00');
      expect(result.discountAmount.toFixed(2)).toBe('0.00');
      expect(result.loyaltyDiscountAmount.toFixed(2)).toBe('30.00');
      expect(result.pointsRedeemed).toBe(30);
      expect(result.totalAmount.toFixed(2)).toBe('370.00');
    });

    it('applies coupon and loyalty discounts separately and exactly once', async () => {
      const mockDbWithCoupon: any = {
        ...mockDb,
        coupons: {
          findFirst: async () => ({
            id: 'coupon-1',
            code: 'FLAT50',
            discount_type: 'fixed',
            discount_value: new Prisma.Decimal('50.00'),
            minimum_order_amount: new Prisma.Decimal('100.00'),
            maximum_discount_amount: null,
            usage_limit: null,
            usage_count: 0,
            valid_from: new Date(Date.now() - 10000),
            valid_until: null,
            is_active: true,
          }),
        },
      };

      const result = await calculateAuthoritativePricing(
        [standardOrderItem],
        mockRestaurantId,
        mockTableId,
        'FLAT50',
        null,
        mockDbWithCoupon,
        { pointsToRedeem: 40, customerId: mockCustomerId }
      );

      // Subtotal ₹400, coupon discount ₹50.00
      // Eligible spend = 400 - 50 = ₹350.00
      // Max loyalty cap (50%) = ₹175.00
      // 40 points * ₹1.00 = ₹40.00 (within cap)
      // Total = 400 - 50 - 40 = ₹310.00
      expect(result.subtotal.toFixed(2)).toBe('400.00');
      expect(result.discountAmount.toFixed(2)).toBe('50.00'); // coupon only
      expect(result.loyaltyDiscountAmount.toFixed(2)).toBe('40.00'); // loyalty only
      expect(result.totalAmount.toFixed(2)).toBe('310.00');
    });

    it('enforces minimum 20 points rule and rejects < 20 points', async () => {
      await expect(
        calculateAuthoritativePricing(
          [standardOrderItem],
          mockRestaurantId,
          mockTableId,
          null,
          null,
          mockDb,
          { pointsToRedeem: 19, customerId: mockCustomerId }
        )
      ).rejects.toThrow(/Minimum redemption is 20 points/);
    });

    it('enforces 50% cap on eligible bill and rejects over-cap redemption without silent clamping', async () => {
      // Product price ₹400. Eligible bill ₹400. Max 50% discount = ₹200.00.
      // Requesting 201 points @ ₹1.00 = ₹201.00 > ₹200.00.
      const mockDbRichAccount: any = {
        ...mockDb,
        customer_loyalty_accounts: {
          findUnique: async () => ({
            ...defaultMockAccount,
            stars_balance: 500,
          }),
        },
      };

      await expect(
        calculateAuthoritativePricing(
          [standardOrderItem],
          mockRestaurantId,
          mockTableId,
          null,
          null,
          mockDbRichAccount,
          { pointsToRedeem: 201, customerId: mockCustomerId }
        )
      ).rejects.toThrow(/exceeds maximum allowed discount/);
    });

    it('calculates 50% cap strictly against eligible bill (subtotal minus coupon discount)', async () => {
      // Subtotal ₹400, Coupon ₹200 -> Eligible bill = ₹200.
      // Max loyalty discount (50% of ₹200) = ₹100.
      // Requesting 110 points @ 1.00 = ₹110 -> Exceeds ₹100 cap!
      const mockDbLargeCoupon: any = {
        ...mockDb,
        coupons: {
          findFirst: async () => ({
            id: 'coupon-2',
            code: 'HALF50',
            discount_type: 'fixed',
            discount_value: new Prisma.Decimal('200.00'),
            minimum_order_amount: new Prisma.Decimal('100.00'),
            maximum_discount_amount: null,
            usage_limit: null,
            usage_count: 0,
            valid_from: new Date(Date.now() - 10000),
            valid_until: null,
            is_active: true,
          }),
        },
        customer_loyalty_accounts: {
          findUnique: async () => ({ ...defaultMockAccount, stars_balance: 500 }),
        },
      };

      await expect(
        calculateAuthoritativePricing(
          [standardOrderItem],
          mockRestaurantId,
          mockTableId,
          'HALF50',
          null,
          mockDbLargeCoupon,
          { pointsToRedeem: 110, customerId: mockCustomerId }
        )
      ).rejects.toThrow(/exceeds maximum allowed discount/);
    });

    it('handles boundary conversion rates and deterministic currency rounding', async () => {
      // Test 1: Rate ₹0.50 (2 points per rupee)
      // 30 points * 0.50 = ₹15.00
      const mockDbHalfRate: any = {
        ...mockDb,
        loyalty_programs: {
          findUnique: async () => ({
            ...defaultMockProgram,
            redemption_rate: new Prisma.Decimal('0.50'),
          }),
        },
      };

      const resHalf = await calculateAuthoritativePricing(
        [standardOrderItem],
        mockRestaurantId,
        mockTableId,
        null,
        null,
        mockDbHalfRate,
        { pointsToRedeem: 30, customerId: mockCustomerId }
      );
      expect(resHalf.loyaltyDiscountAmount.toFixed(2)).toBe('15.00');
      expect(resHalf.totalAmount.toFixed(2)).toBe('385.00');

      // Test 2: Rate ₹1.25
      // 24 points * 1.25 = ₹30.00
      const mockDbQuarterRate: any = {
        ...mockDb,
        loyalty_programs: {
          findUnique: async () => ({
            ...defaultMockProgram,
            redemption_rate: new Prisma.Decimal('1.25'),
          }),
        },
      };

      const resQuarter = await calculateAuthoritativePricing(
        [standardOrderItem],
        mockRestaurantId,
        mockTableId,
        null,
        null,
        mockDbQuarterRate,
        { pointsToRedeem: 24, customerId: mockCustomerId }
      );
      expect(resQuarter.loyaltyDiscountAmount.toFixed(2)).toBe('30.00');
      expect(resQuarter.totalAmount.toFixed(2)).toBe('370.00');

      // Test 3: Fractional rate with rounding (e.g. ₹0.33)
      // 25 points * 0.33 = 8.25
      const mockDbFracRate: any = {
        ...mockDb,
        loyalty_programs: {
          findUnique: async () => ({
            ...defaultMockProgram,
            redemption_rate: new Prisma.Decimal('0.33'),
          }),
        },
      };

      const resFrac = await calculateAuthoritativePricing(
        [standardOrderItem],
        mockRestaurantId,
        mockTableId,
        null,
        null,
        mockDbFracRate,
        { pointsToRedeem: 25, customerId: mockCustomerId }
      );
      expect(resFrac.loyaltyDiscountAmount.toFixed(2)).toBe('8.25');
      expect(resFrac.totalAmount.toFixed(2)).toBe('391.75');
    });

    it('rejects redemption when customer balance is insufficient', async () => {
      // Customer has 25 points, requests 30
      const mockDbLowBalance: any = {
        ...mockDb,
        customer_loyalty_accounts: {
          findUnique: async () => ({
            ...defaultMockAccount,
            stars_balance: 25,
          }),
        },
      };

      await expect(
        calculateAuthoritativePricing(
          [standardOrderItem],
          mockRestaurantId,
          mockTableId,
          null,
          null,
          mockDbLowBalance,
          { pointsToRedeem: 30, customerId: mockCustomerId }
        )
      ).rejects.toThrow(/Insufficient loyalty points/);
    });

    it('rejects redemption when loyalty program is inactive or missing', async () => {
      const mockDbInactive: any = {
        ...mockDb,
        loyalty_programs: {
          findUnique: async () => ({
            ...defaultMockProgram,
            is_active: false,
          }),
        },
      };

      await expect(
        calculateAuthoritativePricing(
          [standardOrderItem],
          mockRestaurantId,
          mockTableId,
          null,
          null,
          mockDbInactive,
          { pointsToRedeem: 20, customerId: mockCustomerId }
        )
      ).rejects.toThrow(/Loyalty redemption is currently unavailable/);
    });
  });

  // =========================================================================
  // 4. Order Preview Endpoint Integration
  // =========================================================================
  describe('4. Customer Order Preview Endpoint (POST /api/v1/customer/orders/preview)', () => {
    it('returns preview quote with loyalty discount and points redeemed', async () => {
      const req = new NextRequest('http://localhost/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 25,
        }),
      });

      const response = await previewOrderHandler(req);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.pricing.subtotal).toBe(400);
      expect(json.data.pricing.discountAmount).toBe(0);
      expect(json.data.pricing.loyaltyDiscountAmount).toBe(25);
      expect(json.data.pricing.loyaltyDiscountAmountFormatted).toBe('25.00');
      expect(json.data.pricing.pointsRedeemed).toBe(25);
      expect(json.data.pricing.totalAmount).toBe(375);
    });

    it('returns 400 when preview requests redemption with insufficient points', async () => {
      vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValueOnce({
        ...defaultMockAccount,
        stars_balance: 10,
      } as any);

      const req = new NextRequest('http://localhost/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 20,
        }),
      });

      const response = await previewOrderHandler(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toMatch(/Insufficient loyalty points/);
    });
  });

  // =========================================================================
  // 5. Atomic Order Creation & Points Deduction
  // =========================================================================
  describe('5. Atomic Order Creation with Points Deduction (POST /api/v1/customer/orders)', () => {
    it('creates order, deducts points, writes signed ledger transaction, and persists loyalty discount', async () => {
      // Mock row locks
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          {
            id: mockTableId,
            branch_id: mockBranchId,
            table_number: 'T1',
            capacity: 4,
            status: 'available',
            is_active: true,
          },
        ]) // table lock
        .mockResolvedValueOnce([
          {
            id: mockAccountId,
            stars_balance: 100,
            lifetime_stars_earned: 150,
            lifetime_stars_redeemed: 50,
          },
        ]); // customer loyalty account lock

      const createdMockOrder = {
        id: 'ord-created-1',
        order_number: 'ORD-12345',
        status: 'pending',
        order_type: 'dine_in',
        table_id: mockTableId,
        restaurant_id: mockRestaurantId,
        branch_id: mockBranchId,
        customer_id: mockCustomerId,
        subtotal: new Prisma.Decimal('400.00'),
        discount_amount: new Prisma.Decimal('0.00'),
        loyalty_discount_amount: new Prisma.Decimal('30.00'),
        tax_amount: new Prisma.Decimal('0.00'),
        total_amount: new Prisma.Decimal('370.00'),
        notes: null,
        ordered_at: new Date(),
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        restaurant_tables: { id: mockTableId, table_number: 'T1' },
        branches: { name: 'Main Branch' },
        restaurants: { name: 'The Truffle Table' },
        order_items: [
          {
            id: 'item-1',
            product_id: mockProductId,
            product_name: 'Truffle Risotto',
            variant_id: null,
            variant_name: null,
            quantity: 1,
            unit_price: new Prisma.Decimal('400.00'),
            total_price: new Prisma.Decimal('400.00'),
            special_instructions: null,
            order_item_addons: [],
          },
        ],
        order_status_history: [
          { status: 'pending', notes: 'Customer placed dine-in order', changed_at: new Date() },
        ],
      };

      vi.mocked(prisma.orders.create).mockResolvedValueOnce(createdMockOrder as any);
      vi.mocked(prisma.orders.findUnique).mockResolvedValueOnce(createdMockOrder as any);
      vi.mocked(prisma.order_items.create).mockResolvedValueOnce({ id: 'item-1' } as any);
      vi.mocked(prisma.loyalty_transactions.create).mockResolvedValueOnce({ id: 'tx-1' } as any);
      vi.mocked(prisma.customer_loyalty_accounts.update).mockResolvedValueOnce({} as any);

      const req = new NextRequest('http://localhost/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 30,
        }),
      });

      const response = await createOrderHandler(req);
      expect(response.status).toBe(201);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.pricing.loyaltyDiscountAmount).toBe(30);
      expect(json.data.pricing.totalAmount).toBe(370);

      // Verify signed loyalty ledger transaction was created
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loyalty_account_id: mockAccountId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
          order_id: createdMockOrder.id,
          transaction_type: 'redemption',
          stars: -30, // Negative for deduction
          description: expect.stringContaining('Redeemed 30 points'),
        }),
      });

      // Verify account balance update atomically decremented
      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: { decrement: 30 },
          lifetime_stars_redeemed: { increment: 30 },
        }),
      });

      // Verify order persisted loyalty_discount_amount separately
      expect(prisma.orders.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          discount_amount: expect.any(Prisma.Decimal),
          loyalty_discount_amount: expect.any(Prisma.Decimal),
          total_amount: expect.any(Prisma.Decimal),
        }),
      });
    });

    it('aborts transaction and makes no partial updates if balance check fails under row lock', async () => {
      // Row lock returns insufficient balance
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          {
            id: mockTableId,
            branch_id: mockBranchId,
            table_number: 'T1',
            capacity: 4,
            status: 'available',
            is_active: true,
          },
        ]) // table lock
        .mockResolvedValueOnce([
          {
            id: mockAccountId,
            stars_balance: 15, // Only 15 points
            lifetime_stars_earned: 150,
            lifetime_stars_redeemed: 50,
          },
        ]); // customer loyalty account lock

      const req = new NextRequest('http://localhost/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 30, // Requests 30
        }),
      });

      const response = await createOrderHandler(req);
      expect(response.status).toBe(400);

      // Verify NO order created, NO transaction created, NO account updated
      expect(prisma.orders.create).not.toHaveBeenCalled();
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('handles idempotent replay without deducting points a second time or creating duplicate ledger entries', async () => {
      const idempotencyKey = 'idem-checkout-test-999';
      const canonicalHash = computeCanonicalPayloadHash(
        mockTableId,
        [standardOrderItem],
        null,
        null,
        30
      );

      const existingCommittedOrder = {
        id: 'ord-existing-99',
        order_number: 'ORD-99999',
        status: 'pending',
        order_type: 'dine_in',
        table_id: mockTableId,
        restaurant_id: mockRestaurantId,
        branch_id: mockBranchId,
        customer_id: mockCustomerId,
        idempotency_key: idempotencyKey,
        idempotency_payload_hash: canonicalHash,
        subtotal: new Prisma.Decimal('400.00'),
        discount_amount: new Prisma.Decimal('0.00'),
        loyalty_discount_amount: new Prisma.Decimal('30.00'),
        tax_amount: new Prisma.Decimal('0.00'),
        total_amount: new Prisma.Decimal('370.00'),
        notes: null,
        ordered_at: new Date(),
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        restaurant_tables: { id: mockTableId, table_number: 'T1' },
        branches: { name: 'Main Branch' },
        restaurants: { name: 'The Truffle Table' },
        order_items: [],
        order_status_history: [],
      };

      // Mock finding the existing committed order pre-transaction
      vi.mocked(prisma.orders.findFirst).mockResolvedValueOnce(existingCommittedOrder as any);

      const req = new NextRequest('http://localhost/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          idempotencyKey,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 30,
        }),
      });

      const response = await createOrderHandler(req);
      expect(response.status).toBe(200);
      expect(response.headers.get('Idempotent-Replay')).toBe('true');

      // Verify transaction was bypassed: no new order, no ledger entry, no account update
      expect(prisma.orders.create).not.toHaveBeenCalled();
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('rejects idempotency key replay with 409 Conflict when pointsToRedeem payload is changed', async () => {
      const idempotencyKey = 'idem-checkout-test-conflict';
      // Original order had pointsToRedeem: 20
      const originalHash = computeCanonicalPayloadHash(
        mockTableId,
        [standardOrderItem],
        null,
        null,
        20
      );

      const existingCommittedOrder = {
        id: 'ord-existing-conflict',
        order_number: 'ORD-88888',
        customer_id: mockCustomerId,
        idempotency_key: idempotencyKey,
        idempotency_payload_hash: originalHash,
      };

      vi.mocked(prisma.orders.findFirst).mockResolvedValueOnce(existingCommittedOrder as any);

      // Replaying with pointsToRedeem: 30
      const req = new NextRequest('http://localhost/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          idempotencyKey,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 30,
        }),
      });

      const response = await createOrderHandler(req);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error.code).toBe('CONFLICT');
      expect(json.error.message).toMatch(/different order request payload/);
    });

    it('detects price drift against expectedTotal and rejects with 409 PRICE_CHANGED', async () => {
      const req = new NextRequest('http://localhost/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: validQrToken,
          tableId: mockTableId,
          items: [{ productId: mockProductId, quantity: 1 }],
          pointsToRedeem: 30,
          expectedTotal: 300, // Stale client expected 300, actual authoritative total is 370
        }),
      });

      const response = await createOrderHandler(req);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error.code).toBe('PRICE_CHANGED');
    });
  });
});
