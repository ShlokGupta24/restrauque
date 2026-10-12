export type CouponDiscountType = 'fixed' | 'percentage';

export type CouponStatus =
  | 'active'
  | 'inactive'
  | 'expired'
  | 'scheduled'
  | 'exhausted';

export interface SafeCoupon {
  id: string;
  restaurantId: string;
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  discountValueFormatted: string;
  minimumOrderAmount: number;
  minimumOrderAmountFormatted: string;
  maximumDiscountAmount: number | null;
  maximumDiscountAmountFormatted: string | null;
  usageLimit: number | null;
  usageCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CouponSummaryCounts {
  totalCoupons: number;
  activeCoupons: number;
  inactiveCoupons: number;
  expiredCoupons: number;
}

export interface OwnerCouponsPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface OwnerCouponsListResponse {
  coupons: SafeCoupon[];
  pagination: OwnerCouponsPagination;
  summary: CouponSummaryCounts;
}
