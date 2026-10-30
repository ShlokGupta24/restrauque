/**
 * Restrauque Customer Feedback Service (feedbackService)
 * 
 * Communicates with Next.js backend feedback endpoints using typed apiClient:
 * - GET  /api/v1/customer/orders/[orderId]/feedback -> getOrderFeedbackEligibility
 * - POST /api/v1/customer/orders/[orderId]/feedback -> submitOrderFeedback
 *
 * Requirements & Guardrails:
 * - Order IDs must be real UUIDs from completed orders.
 * - Customer authentication enforced by backend HttpOnly cookie.
 * - Overall rating is required (1-5 integer).
 * - Per-item feedback is optional but validates product UUIDs, 1-5 ratings, and max 500 chars.
 * - Strict payload formatting matches backend createFeedbackSchema.strict().
 * - Duplicate submissions handled via 409 Conflict.
 * - Never silently falls back to mock fixtures in production.
 */

import { apiClient, ApiClientError } from './apiClient.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export interface ItemFeedbackInput {
  productId: string;
  rating: number; // 1-5 integer
  comment?: string | null;
}

export interface CreateFeedbackRequest {
  rating: number; // 1-5 integer
  comment?: string | null;
  items?: ItemFeedbackInput[];
}

export interface OrderFeedbackItemInfo {
  productId: string;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  addons: string[];
}

export interface ExistingItemFeedback {
  productId: string;
  rating: number | null;
  comment: string | null;
}

export interface ExistingFeedbackDetails {
  id: string;
  rating: number | null;
  comment: string | null;
  submittedAt: string;
  itemFeedback: ExistingItemFeedback[];
}

export interface PotentialLoyaltyReward {
  isActive: boolean;
  programName: string;
  baseStars: number;
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
    items: OrderFeedbackItemInfo[];
  };
  existingFeedback: ExistingFeedbackDetails | null;
  potentialReward: PotentialLoyaltyReward;
}

export interface FeedbackAwardRewardResult {
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
  reward: FeedbackAwardRewardResult;
}

/**
 * Checks if an order is eligible for customer feedback and returns order and item metadata.
 * GET /api/v1/customer/orders/[orderId]/feedback
 */
export async function fetchOrderFeedbackEligibility(
  orderId: string,
  signal?: AbortSignal
): Promise<FeedbackEligibilityResult> {
  const cleanOrderId = typeof orderId === 'string' ? orderId.trim() : '';

  if (!cleanOrderId || !isValidUuid(cleanOrderId)) {
    throw new ApiClientError(
      'Invalid order ID: must be a valid UUID.',
      400,
      'INVALID_ORDER_ID'
    );
  }

  const endpoint = `/api/v1/customer/orders/${encodeURIComponent(cleanOrderId)}/feedback`;
  const result = await apiClient.get<FeedbackEligibilityResult>(endpoint, { signal });

  if (!result || typeof result.isEligible !== 'boolean' || !result.order || !Array.isArray(result.order.items)) {
    throw new ApiClientError(
      'Malformed feedback eligibility response received from server.',
      500,
      'MALFORMED_RESPONSE'
    );
  }

  return result;
}

/**
 * Submits overall and item-level order feedback with transactional backend verification.
 * POST /api/v1/customer/orders/[orderId]/feedback
 */
export async function submitOrderFeedback(
  orderId: string,
  payload: CreateFeedbackRequest,
  signal?: AbortSignal
): Promise<FeedbackSubmissionResult> {
  const cleanOrderId = typeof orderId === 'string' ? orderId.trim() : '';

  if (!cleanOrderId || !isValidUuid(cleanOrderId)) {
    throw new ApiClientError(
      'Invalid order ID: must be a valid UUID.',
      400,
      'INVALID_ORDER_ID'
    );
  }

  // Validate overall rating: 1-5 integer
  if (
    typeof payload.rating !== 'number' ||
    !Number.isInteger(payload.rating) ||
    payload.rating < 1 ||
    payload.rating > 5
  ) {
    throw new ApiClientError(
      'Overall rating is required and must be an integer between 1 and 5 stars.',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Validate comment length if provided
  if (payload.comment && payload.comment.trim().length > 1000) {
    throw new ApiClientError(
      'Overall comment cannot exceed 1000 characters.',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Validate items review array
  const cleanItems: ItemFeedbackInput[] = [];
  if (payload.items && payload.items.length > 0) {
    if (payload.items.length > 50) {
      throw new ApiClientError(
        'Cannot review more than 50 items.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const reviewedProductIds = new Set<string>();

    for (const item of payload.items) {
      const pId = typeof item.productId === 'string' ? item.productId.trim() : '';
      if (!pId || !isValidUuid(pId)) {
        throw new ApiClientError(
          `Invalid item productId "${item.productId}": must be a valid UUID.`,
          400,
          'VALIDATION_ERROR'
        );
      }

      if (reviewedProductIds.has(pId)) {
        throw new ApiClientError(
          `Duplicate review submitted for product "${pId}" in the same request.`,
          400,
          'VALIDATION_ERROR'
        );
      }
      reviewedProductIds.add(pId);

      if (
        typeof item.rating !== 'number' ||
        !Number.isInteger(item.rating) ||
        item.rating < 1 ||
        item.rating > 5
      ) {
        throw new ApiClientError(
          `Item rating for product "${pId}" must be an integer between 1 and 5 stars.`,
          400,
          'VALIDATION_ERROR'
        );
      }

      if (item.comment && item.comment.trim().length > 500) {
        throw new ApiClientError(
          `Item comment for product "${pId}" cannot exceed 500 characters.`,
          400,
          'VALIDATION_ERROR'
        );
      }

      cleanItems.push({
        productId: pId,
        rating: item.rating,
        comment: item.comment && item.comment.trim() ? item.comment.trim() : null,
      });
    }
  }

  // Strict JSON payload matching backend createFeedbackSchema
  const requestBody = {
    rating: payload.rating,
    comment: payload.comment && payload.comment.trim() ? payload.comment.trim() : null,
    items: cleanItems,
  };

  const endpoint = `/api/v1/customer/orders/${encodeURIComponent(cleanOrderId)}/feedback`;
  const result = await apiClient.post<FeedbackSubmissionResult>(endpoint, requestBody, { signal });

  if (!result || !result.feedbackId || !result.reward) {
    throw new ApiClientError(
      'Malformed feedback submission response received from server.',
      500,
      'MALFORMED_RESPONSE'
    );
  }

  return result;
}
