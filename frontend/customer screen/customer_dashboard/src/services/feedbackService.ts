/**
 * Restrauque Customer Dashboard Feedback Service
 * Communicates with Next.js backend API:
 *   - GET /api/v1/customer/feedback
 *   - GET /api/v1/customer/orders/:orderId/feedback
 *   - POST /api/v1/customer/orders/:orderId/feedback
 *
 * Uses typed apiClient with credentials: 'include' for HttpOnly session cookie authentication.
 * Never persists tokens in browser storage.
 */

import { apiClient, QueryParams } from './apiClient';

export type CustomerFeedbackStatusFilter = 'all' | 'awaiting_review' | 'reviewed';

export interface CustomerFeedbackQueryParams {
  status?: CustomerFeedbackStatusFilter;
  restaurantId?: string;
  limit?: number;
  cursor?: string;
}

export interface CustomerFeedbackOrderItemProduct {
  productId: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  imageUrl: string | null;
  addons: string[];
}

export interface CustomerFeedbackOrderItemEligibility {
  isEligible: boolean;
  reason: string | null;
}

export interface CustomerFeedbackRecordAspect {
  productId: string;
  productName: string;
  rating: number | null;
  comment: string | null;
}

export interface CustomerFeedbackRecordReward {
  isAwarded: boolean;
  pointsAwarded: number;
  starsAwarded: number;
  transactionType: string | null;
  description: string | null;
}

export interface CustomerFeedbackRecord {
  id: string;
  rating: number | null;
  comment: string | null;
  submittedAt: string;
  itemFeedback: CustomerFeedbackRecordAspect[];
  reward: CustomerFeedbackRecordReward | null;
}

export interface CustomerFeedbackPotentialReward {
  isActive: boolean;
  programName: string;
  basePoints: number;
  baseStars: number;
}

export interface CustomerFeedbackOrderItem {
  orderId: string;
  orderNumber: string;
  status: string;
  restaurant: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
  } | null;
  table: {
    id: string;
    tableNumber: string;
  } | null;
  orderedAt: string;
  completedAt: string | null;
  pricing: {
    totalAmount: number;
    totalAmountFormatted: string;
    currency: string;
  };
  items: CustomerFeedbackOrderItemProduct[];
  eligibility: CustomerFeedbackOrderItemEligibility;
  hasFeedback: boolean;
  feedback: CustomerFeedbackRecord | null;
  potentialReward: CustomerFeedbackPotentialReward | null;
}

export interface CustomerRestaurantFeedbackSummary {
  restaurantId: string;
  restaurantName: string;
  pendingFeedbackCount: number;
  totalOrdersCount: number;
  reviewedOrdersCount: number;
}

export interface CustomerFeedbackSummaryAggregate {
  all: number;
  awaitingReview: number;
  reviewed: number;
}

export interface CustomerFeedbackHistoryPaginationMeta {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface CustomerFeedbackHistoryResponse {
  orders: CustomerFeedbackOrderItem[];
  pagination: CustomerFeedbackHistoryPaginationMeta;
  summary: CustomerFeedbackSummaryAggregate;
  restaurantSummary: CustomerRestaurantFeedbackSummary[];
}

export interface OrderFeedbackEligibilityItemInfo {
  productId: string;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  addons: string[];
}

export interface ExistingOrderFeedbackDetail {
  id: string;
  rating: number | null;
  comment: string | null;
  submittedAt: string;
  itemFeedback: Array<{
    productId: string;
    rating: number | null;
    comment: string | null;
  }>;
}

export interface FeedbackEligibilityResult {
  isEligible: boolean;
  reason: string | null;
  alreadySubmitted: boolean;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    restaurantId: string;
    restaurantName: string;
    tableNumber: string | null;
    completedAt: string | null;
    items: OrderFeedbackEligibilityItemInfo[];
  };
  existingFeedback: ExistingOrderFeedbackDetail | null;
  potentialReward: {
    isActive: boolean;
    programName: string;
    baseStars: number;
  };
}

export interface ItemFeedbackPayload {
  productId: string;
  rating: number; // 1-5 integer
  comment?: string | null; // max 500 chars
}

export interface CreateFeedbackPayload {
  rating: number; // 1-5 integer (required)
  comment?: string | null; // max 1000 chars
  items?: ItemFeedbackPayload[];
}

export interface FeedbackSubmissionReward {
  starsAwarded: number;
  newBalance: number;
  isRewardEarned: boolean;
  programName: string;
  description: string;
}

export interface FeedbackSubmissionResult {
  feedbackId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  reward: FeedbackSubmissionReward;
}

/**
 * Fetch customer feedback history with restaurant breakdown and global counts.
 */
export async function fetchCustomerFeedbackHistory(
  params?: CustomerFeedbackQueryParams,
  signal?: AbortSignal
): Promise<CustomerFeedbackHistoryResponse> {
  const queryParams: QueryParams = {};

  if (params) {
    if (params.status) queryParams.status = params.status;
    if (params.restaurantId) queryParams.restaurantId = params.restaurantId;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.cursor) queryParams.cursor = params.cursor;
  }

  return await apiClient.get<CustomerFeedbackHistoryResponse>(
    '/api/v1/customer/feedback',
    {
      params: queryParams,
      signal,
    }
  );
}

/**
 * Check feedback eligibility and retrieve order/feedback details for a specific order.
 */
export async function fetchOrderFeedbackEligibility(
  orderId: string,
  signal?: AbortSignal
): Promise<FeedbackEligibilityResult> {
  const cleanId = orderId.trim();
  return await apiClient.get<FeedbackEligibilityResult>(
    `/api/v1/customer/orders/${encodeURIComponent(cleanId)}/feedback`,
    { signal }
  );
}

/**
 * Submit feedback for an eligible order and receive confirmed reward outcome.
 */
export async function submitOrderFeedback(
  orderId: string,
  payload: CreateFeedbackPayload,
  signal?: AbortSignal
): Promise<FeedbackSubmissionResult> {
  const cleanId = orderId.trim();

  // Validate client payload before dispatch
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5 stars.');
  }

  const cleanPayload: CreateFeedbackPayload = {
    rating: payload.rating,
    comment: payload.comment ? payload.comment.trim() : null,
  };

  if (payload.items && payload.items.length > 0) {
    cleanPayload.items = payload.items.map((item) => ({
      productId: item.productId,
      rating: item.rating,
      comment: item.comment ? item.comment.trim() : null,
    }));
  }

  return await apiClient.post<FeedbackSubmissionResult>(
    `/api/v1/customer/orders/${encodeURIComponent(cleanId)}/feedback`,
    cleanPayload,
    { signal }
  );
}
