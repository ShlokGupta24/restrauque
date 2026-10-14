import { apiClient } from './apiClient';

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

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number | null;
  usageLimit?: number | null;
  validFrom?: string;
  validUntil?: string | null;
  isActive?: boolean;
}

export interface UpdateCouponInput {
  code?: string;
  name?: string;
  description?: string | null;
  discountType?: CouponDiscountType;
  discountValue?: number;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number | null;
  usageLimit?: number | null;
  validFrom?: string;
  validUntil?: string | null;
  isActive?: boolean;
}

export interface DeleteCouponResponse {
  id: string;
  code: string;
  action: 'deleted' | 'archived';
  message: string;
}

export const couponService = {
  getCoupons: async (params?: {
    page?: number;
    limit?: number;
    isActive?: boolean | string;
    search?: string;
  }): Promise<OwnerCouponsListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.isActive !== undefined && params.isActive !== 'all') {
      query.append('isActive', String(params.isActive));
    }
    if (params?.search && params.search.trim()) {
      query.append('search', params.search.trim());
    }

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<OwnerCouponsListResponse>(`/api/v1/owner/coupons${qs}`);
  },

  getCoupon: async (couponId: string): Promise<{ coupon: SafeCoupon }> => {
    return apiClient.get<{ coupon: SafeCoupon }>(
      `/api/v1/owner/coupons/${encodeURIComponent(couponId)}`
    );
  },

  createCoupon: async (data: CreateCouponInput): Promise<{ coupon: SafeCoupon }> => {
    return apiClient.post<{ coupon: SafeCoupon }>('/api/v1/owner/coupons', data);
  },

  updateCoupon: async (
    couponId: string,
    data: UpdateCouponInput
  ): Promise<{ coupon: SafeCoupon }> => {
    return apiClient.patch<{ coupon: SafeCoupon }>(
      `/api/v1/owner/coupons/${encodeURIComponent(couponId)}`,
      data
    );
  },

  deleteCoupon: async (couponId: string): Promise<DeleteCouponResponse> => {
    return apiClient.delete<DeleteCouponResponse>(
      `/api/v1/owner/coupons/${encodeURIComponent(couponId)}`
    );
  },
};
