import { SafeCoupon, CouponStatus, CouponDiscountType } from '@/types/coupon';

/**
 * Computes the operational status of a coupon based on its active flag,
 * scheduling dates, expiration, and usage limits.
 *
 * Status semantics:
 * - 'inactive': The coupon is explicitly deactivated (is_active === false).
 * - 'scheduled': The coupon is active but validFrom is in the future.
 * - 'expired': The coupon is active, but validUntil has passed.
 * - 'exhausted': The coupon is active and within date window, but usageCount >= usageLimit.
 * - 'active': The coupon is currently valid, unexpired, within limits, and redeemable.
 */
export function computeCouponStatus(
  coupon: {
    is_active: boolean;
    valid_from: Date | string;
    valid_until?: Date | string | null;
    usage_limit?: number | null;
    usage_count?: number | null;
  },
  now = new Date()
): CouponStatus {
  if (!coupon.is_active) {
    return 'inactive';
  }

  const from = coupon.valid_from instanceof Date ? coupon.valid_from : new Date(coupon.valid_from);
  if (from.getTime() > now.getTime()) {
    return 'scheduled';
  }

  if (coupon.valid_until) {
    const until =
      coupon.valid_until instanceof Date ? coupon.valid_until : new Date(coupon.valid_until);
    if (until.getTime() < now.getTime()) {
      return 'expired';
    }
  }

  const count = coupon.usage_count ?? 0;
  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && count >= coupon.usage_limit) {
    return 'exhausted';
  }

  return 'active';
}

/**
 * Formats a Prisma coupon model into a clean, typed API representation.
 * Handles Decimal conversions to numbers and 2-decimal formatted strings.
 */
export function formatCoupon(c: any, now = new Date()): SafeCoupon {
  const numericDiscount = typeof c.discount_value === 'number' ? c.discount_value : Number(c.discount_value);
  const minOrder =
    c.minimum_order_amount !== null && c.minimum_order_amount !== undefined
      ? typeof c.minimum_order_amount === 'number'
        ? c.minimum_order_amount
        : Number(c.minimum_order_amount)
      : 0;

  const maxDiscount =
    c.maximum_discount_amount !== null && c.maximum_discount_amount !== undefined
      ? typeof c.maximum_discount_amount === 'number'
        ? c.maximum_discount_amount
        : Number(c.maximum_discount_amount)
      : null;

  const usageLimit = c.usage_limit !== undefined && c.usage_limit !== null ? Number(c.usage_limit) : null;
  const usageCount = c.usage_count !== undefined && c.usage_count !== null ? Number(c.usage_count) : 0;

  return {
    id: c.id,
    restaurantId: c.restaurant_id,
    code: c.code,
    name: c.name,
    description: c.description ?? null,
    discountType: c.discount_type as CouponDiscountType,
    discountValue: numericDiscount,
    discountValueFormatted: numericDiscount.toFixed(2),
    minimumOrderAmount: minOrder,
    minimumOrderAmountFormatted: minOrder.toFixed(2),
    maximumDiscountAmount: maxDiscount,
    maximumDiscountAmountFormatted: maxDiscount !== null ? maxDiscount.toFixed(2) : null,
    usageLimit,
    usageCount,
    validFrom: c.valid_from instanceof Date ? c.valid_from.toISOString() : new Date(c.valid_from).toISOString(),
    validUntil: c.valid_until
      ? c.valid_until instanceof Date
        ? c.valid_until.toISOString()
        : new Date(c.valid_until).toISOString()
      : null,
    isActive: Boolean(c.is_active),
    status: computeCouponStatus(c, now),
    createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : new Date(c.created_at).toISOString(),
    updatedAt: c.updated_at instanceof Date ? c.updated_at.toISOString() : new Date(c.updated_at).toISOString(),
  };
}
