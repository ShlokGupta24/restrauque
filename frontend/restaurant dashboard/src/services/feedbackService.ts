import { apiClient } from './apiClient';

export interface OwnerFeedbackSummary {
  totalCount: number;
  averageRating: number | null;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface OwnerFeedbackItem {
  id: string;
  orderId: string;
  orderNumber: string | null;
  rating: number | null;
  comment: string | null;
  status: string | null;
  createdAt: string;
  submittedAt: string;
  branchId: string | null;
  branchName: string | null;
  customerName: string | null;
}

export interface OwnerFeedbackPagination {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface OwnerFeedbackResponse {
  restaurantId: string;
  summary: OwnerFeedbackSummary;
  items: OwnerFeedbackItem[];
  pagination: OwnerFeedbackPagination;
}

export interface GetOwnerFeedbackOptions {
  restaurantId?: string;
  branchId?: string;
  limit?: number;
  cursor?: string;
  startDate?: string;
  endDate?: string;
  signal?: AbortSignal;
}

export const feedbackService = {
  /**
   * Fetches real customer feedback and server-calculated rating summary
   * for an authorized restaurant.
   */
  getFeedback: async (options?: GetOwnerFeedbackOptions): Promise<OwnerFeedbackResponse> => {
    const params = new URLSearchParams();

    if (options?.restaurantId) {
      params.set('restaurantId', options.restaurantId);
    }
    if (options?.branchId && options.branchId !== 'all') {
      params.set('branchId', options.branchId);
    }
    if (options?.limit && options.limit > 0) {
      params.set('limit', String(options.limit));
    }
    if (options?.cursor && options.cursor.trim()) {
      params.set('cursor', options.cursor.trim());
    }
    if (options?.startDate) {
      params.set('startDate', options.startDate);
    }
    if (options?.endDate) {
      params.set('endDate', options.endDate);
    }

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<OwnerFeedbackResponse>(`/api/v1/owner/feedback${qs}`, {
      signal: options?.signal,
    });
  },
};
