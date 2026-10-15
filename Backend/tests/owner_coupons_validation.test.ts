import { describe, it, expect } from 'vitest';
import {
  createCouponSchema,
  updateCouponSchema,
  couponQuerySchema,
} from '@/lib/validation/coupon';
import { formatCoupon, computeCouponStatus } from '@/lib/coupons/format';
import { Prisma } from '@prisma/client';

describe('STEP 9B: Owner Coupon Validation & Utility Tests', () => {
  describe('createCouponSchema', () => {
    it('should accept valid fixed discount coupon input and normalize code to uppercase', () => {
      const parsed = createCouponSchema.parse({
        code: '  flat50  ',
        name: 'Flat Rs 50 Off',
        discountType: 'fixed',
        discountValue: 50.0,
        minimumOrderAmount: 200.0,
        usageLimit: 100,
      });

      expect(parsed.code).toBe('FLAT50');
      expect(parsed.name).toBe('Flat Rs 50 Off');
      expect(parsed.discountType).toBe('fixed');
      expect(parsed.discountValue).toBe(50.0);
      expect(parsed.minimumOrderAmount).toBe(200.0);
      expect(parsed.usageLimit).toBe(100);
      expect(parsed.isActive).toBe(true);
    });

    it('should accept valid percentage discount coupon with maximum discount amount', () => {
      const parsed = createCouponSchema.parse({
        code: 'SUMMER20',
        name: 'Summer 20% Discount',
        discountType: 'percentage',
        discountValue: 20,
        minimumOrderAmount: 500,
        maximumDiscountAmount: 150,
      });

      expect(parsed.code).toBe('SUMMER20');
      expect(parsed.discountType).toBe('percentage');
      expect(parsed.discountValue).toBe(20);
      expect(parsed.maximumDiscountAmount).toBe(150);
    });

    it('should allow valid characters in code (letters, numbers, hyphens, underscores)', () => {
      const parsed = createCouponSchema.parse({
        code: 'promo_2026-new',
        name: 'New Year Promo',
        discountType: 'fixed',
        discountValue: 100,
      });

      expect(parsed.code).toBe('PROMO_2026-NEW');
    });

    it('should reject invalid characters in code', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'SAVE 20!',
          name: 'Invalid Code',
          discountType: 'fixed',
          discountValue: 20,
        })
      ).toThrow(/Coupon code can only contain letters, numbers, hyphens, and underscores/);
    });

    it('should enforce code length constraints (2 to 50 chars)', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'A',
          name: 'Short Code',
          discountType: 'fixed',
          discountValue: 10,
        })
      ).toThrow(/Coupon code must be at least 2 characters/);

      const longCode = 'A'.repeat(51);
      expect(() =>
        createCouponSchema.parse({
          code: longCode,
          name: 'Long Code',
          discountType: 'fixed',
          discountValue: 10,
        })
      ).toThrow(/Coupon code cannot exceed 50 characters/);
    });

    it('should reject percentage discount exceeding 100%', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'INVALID101',
          name: '101% Off',
          discountType: 'percentage',
          discountValue: 100.5,
        })
      ).toThrow(/Percentage discount cannot exceed 100%/);
    });

    it('should reject maximumDiscountAmount on fixed discounts', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'FIXEDMAX',
          name: 'Fixed with Max',
          discountType: 'fixed',
          discountValue: 50,
          maximumDiscountAmount: 100,
        })
      ).toThrow(/Maximum discount amount is only applicable for percentage discounts/);
    });

    it('should reject negative or zero discount values', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'ZERO',
          name: 'Zero Discount',
          discountType: 'fixed',
          discountValue: 0,
        })
      ).toThrow(/Discount value must be positive/);

      expect(() =>
        createCouponSchema.parse({
          code: 'NEG',
          name: 'Negative Discount',
          discountType: 'fixed',
          discountValue: -15,
        })
      ).toThrow(/Discount value must be positive/);
    });

    it('should reject discount value with more than 2 decimal places', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'PRECISION',
          name: 'Too many decimals',
          discountType: 'fixed',
          discountValue: 10.999,
        })
      ).toThrow(/Discount value cannot have more than 2 decimal places/);
    });

    it('should reject negative minimumOrderAmount', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'NEGMIN',
          name: 'Negative Min Order',
          discountType: 'fixed',
          discountValue: 50,
          minimumOrderAmount: -10,
        })
      ).toThrow(/Minimum order amount cannot be negative/);
    });

    it('should reject negative or non-integer usageLimit', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'BADLIMIT',
          name: 'Bad Limit',
          discountType: 'fixed',
          discountValue: 50,
          usageLimit: 0,
        })
      ).toThrow(/Usage limit must be at least 1/);

      expect(() =>
        createCouponSchema.parse({
          code: 'BADLIMIT2',
          name: 'Bad Limit 2',
          discountType: 'fixed',
          discountValue: 50,
          usageLimit: 2.5,
        })
      ).toThrow(/Usage limit must be an integer/);
    });

    it('should accept valid dates where validUntil is after validFrom', () => {
      const parsed = createCouponSchema.parse({
        code: 'DATERANGE',
        name: 'Date Range Valid',
        discountType: 'fixed',
        discountValue: 50,
        validFrom: '2026-10-01T00:00:00.000Z',
        validUntil: '2026-10-31T23:59:59.000Z',
      });

      expect(parsed.validFrom).toBe('2026-10-01T00:00:00.000Z');
      expect(parsed.validUntil).toBe('2026-10-31T23:59:59.000Z');
    });

    it('should reject dates where validUntil precedes validFrom', () => {
      expect(() =>
        createCouponSchema.parse({
          code: 'INVDATES',
          name: 'Inverted Dates',
          discountType: 'fixed',
          discountValue: 50,
          validFrom: '2026-10-31T00:00:00.000Z',
          validUntil: '2026-10-01T00:00:00.000Z',
        })
      ).toThrow(/validUntil cannot precede validFrom/);
    });
  });

  describe('updateCouponSchema', () => {
    it('should reject empty update payload', () => {
      expect(() => updateCouponSchema.parse({})).toThrow(
        /At least one field must be provided for update/
      );
    });

    it('should accept valid partial update payload', () => {
      const parsed = updateCouponSchema.parse({
        name: 'Updated Name',
        discountValue: 75.5,
      });

      expect(parsed.name).toBe('Updated Name');
      expect(parsed.discountValue).toBe(75.5);
      expect(parsed.code).toBeUndefined();
    });

    it('should normalize code when updated', () => {
      const parsed = updateCouponSchema.parse({
        code: '  newcode20  ',
      });

      expect(parsed.code).toBe('NEWCODE20');
    });

    it('should validate percentage bounds on partial update', () => {
      expect(() =>
        updateCouponSchema.parse({
          discountType: 'percentage',
          discountValue: 120,
        })
      ).toThrow(/Percentage discount cannot exceed 100%/);
    });

    it('should reject maximumDiscountAmount on fixed discount during partial update', () => {
      expect(() =>
        updateCouponSchema.parse({
          discountType: 'fixed',
          maximumDiscountAmount: 50,
        })
      ).toThrow(/Maximum discount amount is only applicable for percentage discounts/);
    });

    it('should reject invalid dates in partial update', () => {
      expect(() =>
        updateCouponSchema.parse({
          validFrom: '2026-10-30T00:00:00.000Z',
          validUntil: '2026-10-10T00:00:00.000Z',
        })
      ).toThrow(/validUntil cannot precede validFrom/);
    });
  });

  describe('couponQuerySchema', () => {
    it('should parse defaults for page and limit', () => {
      const parsed = couponQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.isActive).toBeUndefined();
    });

    it('should parse isActive boolean filter', () => {
      expect(couponQuerySchema.parse({ isActive: 'true' }).isActive).toBe(true);
      expect(couponQuerySchema.parse({ isActive: 'false' }).isActive).toBe(false);
    });

    it('should enforce pagination bounds', () => {
      expect(() => couponQuerySchema.parse({ page: '0' })).toThrow();
      expect(() => couponQuerySchema.parse({ limit: '101' })).toThrow();
      expect(() => couponQuerySchema.parse({ limit: '0' })).toThrow();
    });
  });

  describe('formatCoupon & computeCouponStatus', () => {
    const fixedNow = new Date('2026-10-12T12:00:00.000Z');

    it('should compute status as "inactive" when is_active is false regardless of dates', () => {
      const status = computeCouponStatus(
        {
          is_active: false,
          valid_from: new Date('2026-10-01T00:00:00.000Z'),
          valid_until: new Date('2026-10-31T00:00:00.000Z'),
          usage_limit: 100,
          usage_count: 5,
        },
        fixedNow
      );
      expect(status).toBe('inactive');
    });

    it('should compute status as "scheduled" when valid_from is in the future', () => {
      const status = computeCouponStatus(
        {
          is_active: true,
          valid_from: new Date('2026-10-15T00:00:00.000Z'),
          valid_until: new Date('2026-10-31T00:00:00.000Z'),
          usage_limit: 100,
          usage_count: 0,
        },
        fixedNow
      );
      expect(status).toBe('scheduled');
    });

    it('should compute status as "expired" when valid_until has passed', () => {
      const status = computeCouponStatus(
        {
          is_active: true,
          valid_from: new Date('2026-10-01T00:00:00.000Z'),
          valid_until: new Date('2026-10-10T00:00:00.000Z'),
          usage_limit: 100,
          usage_count: 10,
        },
        fixedNow
      );
      expect(status).toBe('expired');
    });

    it('should compute status as "exhausted" when usage_count reaches usage_limit', () => {
      const status = computeCouponStatus(
        {
          is_active: true,
          valid_from: new Date('2026-10-01T00:00:00.000Z'),
          valid_until: new Date('2026-10-31T00:00:00.000Z'),
          usage_limit: 50,
          usage_count: 50,
        },
        fixedNow
      );
      expect(status).toBe('exhausted');
    });

    it('should compute status as "active" when valid, unexpired, and below usage limit', () => {
      const status = computeCouponStatus(
        {
          is_active: true,
          valid_from: new Date('2026-10-01T00:00:00.000Z'),
          valid_until: new Date('2026-10-31T00:00:00.000Z'),
          usage_limit: 100,
          usage_count: 25,
        },
        fixedNow
      );
      expect(status).toBe('active');
    });

    it('should correctly format Prisma Decimal fields into numbers and string formats', () => {
      const rawCoupon = {
        id: '11111111-1111-1111-1111-111111111111',
        restaurant_id: '22222222-2222-2222-2222-222222222222',
        code: 'TEST50',
        name: 'Test 50% Off',
        description: 'Test coupon description',
        discount_type: 'percentage',
        discount_value: new Prisma.Decimal('50.00'),
        minimum_order_amount: new Prisma.Decimal('250.50'),
        maximum_discount_amount: new Prisma.Decimal('100.00'),
        usage_limit: 500,
        usage_count: 12,
        valid_from: new Date('2026-10-01T00:00:00.000Z'),
        valid_until: new Date('2026-10-31T23:59:59.000Z'),
        is_active: true,
        created_at: new Date('2026-10-01T00:00:00.000Z'),
        updated_at: new Date('2026-10-01T00:00:00.000Z'),
      };

      const formatted = formatCoupon(rawCoupon, fixedNow);

      expect(formatted.id).toBe(rawCoupon.id);
      expect(formatted.restaurantId).toBe(rawCoupon.restaurant_id);
      expect(formatted.code).toBe('TEST50');
      expect(formatted.discountValue).toBe(50);
      expect(formatted.discountValueFormatted).toBe('50.00');
      expect(formatted.minimumOrderAmount).toBe(250.5);
      expect(formatted.minimumOrderAmountFormatted).toBe('250.50');
      expect(formatted.maximumDiscountAmount).toBe(100);
      expect(formatted.maximumDiscountAmountFormatted).toBe('100.00');
      expect(formatted.status).toBe('active');
      expect(formatted.usageCount).toBe(12);
      expect(formatted.usageLimit).toBe(500);
    });
  });
});
