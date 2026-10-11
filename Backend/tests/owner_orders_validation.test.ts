import { describe, it, expect } from 'vitest';
import {
  ownerOrdersQuerySchema,
  updateOrderStatusSchema,
  isValidStatusTransition,
  orderStatusEnum,
  paymentStatusFilterEnum,
  ALLOWED_STATUS_TRANSITIONS,
} from '@/lib/validation/owner_order';
import {
  formatOwnerPricing,
  formatOwnerOrderPaymentSummary,
  formatOwnerOrderPaymentDetail,
  formatOwnerOrderSummary,
  formatOwnerOrderDetail,
} from '@/lib/orders/owner_format';
import { Prisma } from '@prisma/client';

describe('Owner Orders: Validation & State Machine Tests', () => {
  describe('ownerOrdersQuerySchema', () => {
    it('should parse valid pagination with default values', () => {
      const parsed = ownerOrdersQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });

    it('should coerce and enforce min/max bounds on pagination', () => {
      const parsed = ownerOrdersQuerySchema.parse({ page: '3', limit: '50' });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(50);

      expect(() => ownerOrdersQuerySchema.parse({ page: '0' })).toThrow();
      expect(() => ownerOrdersQuerySchema.parse({ limit: '101' })).toThrow();
      expect(() => ownerOrdersQuerySchema.parse({ limit: '0' })).toThrow();
    });

    it('should validate branchId as UUID', () => {
      const validUuid = '11111111-2222-3333-4444-555555555555';
      const parsed = ownerOrdersQuerySchema.parse({ branchId: validUuid });
      expect(parsed.branchId).toBe(validUuid);

      expect(() => ownerOrdersQuerySchema.parse({ branchId: 'not-a-uuid' })).toThrow();
    });

    it('should validate supported order status filters', () => {
      for (const status of ['pending', 'preparing', 'served', 'completed', 'cancelled']) {
        const parsed = ownerOrdersQuerySchema.parse({ status });
        expect(parsed.status).toBe(status);
      }

      expect(() => ownerOrdersQuerySchema.parse({ status: 'delivered' })).toThrow();
      expect(() => ownerOrdersQuerySchema.parse({ status: 'refunded' })).toThrow();
      expect(() => ownerOrdersQuerySchema.parse({ status: 'unknown' })).toThrow();
    });

    it('should validate supported paymentStatus filters', () => {
      for (const paymentStatus of ['pending', 'paid', 'not_recorded']) {
        const parsed = ownerOrdersQuerySchema.parse({ paymentStatus });
        expect(parsed.paymentStatus).toBe(paymentStatus);
      }

      expect(() => ownerOrdersQuerySchema.parse({ paymentStatus: 'failed' })).toThrow();
      expect(() => ownerOrdersQuerySchema.parse({ paymentStatus: 'settled' })).toThrow();
    });

    it('should validate dateFrom and dateTo formatting', () => {
      const validIso = '2026-10-01T00:00:00.000Z';
      const validDate = '2026-10-01';
      const parsed = ownerOrdersQuerySchema.parse({ dateFrom: validIso, dateTo: validDate });
      expect(parsed.dateFrom).toBe(validIso);
      expect(parsed.dateTo).toBe(validDate);

      expect(() => ownerOrdersQuerySchema.parse({ dateFrom: 'invalid-date' })).toThrow();
    });

    it('should trim and limit search query length', () => {
      const parsed = ownerOrdersQuerySchema.parse({ search: '  ORD-1082  ' });
      expect(parsed.search).toBe('ORD-1082');

      const longSearch = 'a'.repeat(101);
      expect(() => ownerOrdersQuerySchema.parse({ search: longSearch })).toThrow();
    });
  });

  describe('updateOrderStatusSchema', () => {
    it('should accept valid target statuses and optional notes', () => {
      const valid = updateOrderStatusSchema.parse({
        status: 'preparing',
        notes: 'Accepted by kitchen',
        expectedCurrentStatus: 'pending',
      });
      expect(valid.status).toBe('preparing');
      expect(valid.notes).toBe('Accepted by kitchen');
      expect(valid.expectedCurrentStatus).toBe('pending');
    });

    it('should reject invalid or unsupported target statuses', () => {
      expect(() => updateOrderStatusSchema.parse({ status: 'delivered' })).toThrow();
      expect(() => updateOrderStatusSchema.parse({ status: 'refunded' })).toThrow();
      expect(() => updateOrderStatusSchema.parse({ status: 'in_progress' })).toThrow();
    });

    it('should reject oversized notes (> 500 chars)', () => {
      const longNotes = 'x'.repeat(501);
      expect(() => updateOrderStatusSchema.parse({ status: 'preparing', notes: longNotes })).toThrow();
    });
  });

  describe('State Machine & Transition Matrix (isValidStatusTransition)', () => {
    it('should allow valid initial transitions', () => {
      // pending -> preparing, pending -> cancelled
      expect(isValidStatusTransition('pending', 'preparing').isValid).toBe(true);
      expect(isValidStatusTransition('pending', 'cancelled').isValid).toBe(true);

      // preparing -> served, preparing -> cancelled
      expect(isValidStatusTransition('preparing', 'served').isValid).toBe(true);
      expect(isValidStatusTransition('preparing', 'cancelled').isValid).toBe(true);

      // served -> completed
      expect(isValidStatusTransition('served', 'completed').isValid).toBe(true);
    });

    it('should REJECT served -> cancelled per explicit requirement', () => {
      const check = isValidStatusTransition('served', 'cancelled');
      expect(check.isValid).toBe(false);
      expect(check.reason).toContain('managerial override');
    });

    it('should REJECT same-status transitions', () => {
      for (const s of ['pending', 'preparing', 'served', 'completed', 'cancelled']) {
        const check = isValidStatusTransition(s, s);
        expect(check.isValid).toBe(false);
        expect(check.reason).toContain('already in');
      }
    });

    it('should REJECT skipping lifecycle steps', () => {
      expect(isValidStatusTransition('pending', 'served').isValid).toBe(false);
      expect(isValidStatusTransition('pending', 'completed').isValid).toBe(false);
      expect(isValidStatusTransition('preparing', 'completed').isValid).toBe(false);
    });

    it('should REJECT transitions from terminal states', () => {
      // completed is terminal
      for (const next of ['pending', 'preparing', 'served', 'cancelled']) {
        const check = isValidStatusTransition('completed', next);
        expect(check.isValid).toBe(false);
        expect(check.reason).toContain('terminal');
      }

      // cancelled is terminal
      for (const next of ['pending', 'preparing', 'served', 'completed']) {
        const check = isValidStatusTransition('cancelled', next);
        expect(check.isValid).toBe(false);
        expect(check.reason).toContain('terminal');
      }
    });

    it('should reject unknown current status', () => {
      const check = isValidStatusTransition('invalid_state', 'preparing');
      expect(check.isValid).toBe(false);
      expect(check.reason).toContain('Unknown or unhandled');
    });
  });

  describe('DTO Formatting & Snapshot Preservation', () => {
    it('should format monetary values with 2 decimal places and correct currency', () => {
      const pricing = formatOwnerPricing({
        subtotal: new Prisma.Decimal('460.50'),
        discount_amount: new Prisma.Decimal('10.25'),
        tax_amount: new Prisma.Decimal('0.00'),
        total_amount: new Prisma.Decimal('450.25'),
      });

      expect(pricing.currency).toBe('INR');
      expect(pricing.subtotal).toBe(460.5);
      expect(pricing.subtotalFormatted).toBe('460.50');
      expect(pricing.discountAmount).toBe(10.25);
      expect(pricing.discountAmountFormatted).toBe('10.25');
      expect(pricing.totalAmount).toBe(450.25);
      expect(pricing.totalAmountFormatted).toBe('450.25');
    });

    it('should represent missing payments honestly as not_recorded', () => {
      const summaryPayment = formatOwnerOrderPaymentSummary([]);
      expect(summaryPayment.status).toBe('not_recorded');
      expect(summaryPayment.paymentMethod).toBeNull();
      expect(summaryPayment.amount).toBeNull();

      const detailPayment = formatOwnerOrderPaymentDetail([]);
      expect(detailPayment.status).toBe('not_recorded');
      expect(detailPayment.id).toBeNull();
      expect(detailPayment.paidAt).toBeNull();
    });

    it('should preserve historical item and add-on snapshots without alteration', () => {
      const mockOrder = {
        id: '11111111-1111-1111-1111-111111111111',
        order_number: 'ORD-20261007-8A2D',
        order_type: 'dine_in',
        status: 'pending',
        ordered_at: new Date('2026-10-07T15:12:00Z'),
        completed_at: null,
        subtotal: 460,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 460,
        notes: 'Less spicy',
        branches: { id: 'b1', name: 'Hazratganj' },
        restaurant_tables: { id: 't1', table_number: 'T04', capacity: 4 },
        customers: { id: 'c1', name: 'Riya Sharma', phone: '+919876543210' },
        order_items: [
          {
            id: 'oi1',
            product_id: 'p1',
            product_name: 'Paneer Tikka Wrap (Historical Name)',
            variant_id: 'v1',
            variant_name: 'Large (Historical Variant)',
            quantity: 2,
            unit_price: 220,
            total_price: 440,
            special_instructions: 'Crispy',
            order_item_addons: [
              {
                id: 'oia1',
                product_addon_id: 'pa1',
                addon_name: 'Extra Mint Chutney (Historical Addon)',
                quantity: 1,
                unit_price: 20,
                total_price: 20,
              },
            ],
          },
        ],
        order_coupons: [],
        payments: [],
        order_status_history: [
          {
            id: 'osh1',
            status: 'pending',
            changed_at: new Date('2026-10-07T15:12:00Z'),
            notes: 'Placed by customer',
          },
        ],
      };

      const detail = formatOwnerOrderDetail(mockOrder);
      expect(detail.id).toBe(mockOrder.id);
      expect(detail.orderNumber).toBe('ORD-20261007-8A2D');
      expect(detail.customer?.name).toBe('Riya Sharma');
      expect(detail.customer?.phone).toBe('+919876543210');
      // No internal customer session or token field should exist
      expect((detail.customer as any).sessionToken).toBeUndefined();
      expect((detail.customer as any).otpCode).toBeUndefined();

      // Check item snapshot preservation
      expect(detail.items[0].productName).toBe('Paneer Tikka Wrap (Historical Name)');
      expect(detail.items[0].variantName).toBe('Large (Historical Variant)');
      expect(detail.items[0].unitPriceFormatted).toBe('220.00');
      expect(detail.items[0].totalPriceFormatted).toBe('440.00');

      // Check addon snapshot preservation
      expect(detail.items[0].addons[0].addonName).toBe('Extra Mint Chutney (Historical Addon)');
      expect(detail.items[0].addons[0].unitPriceFormatted).toBe('20.00');

      // Check payment status honestly represented
      expect(detail.payment.status).toBe('not_recorded');
    });
  });
});
