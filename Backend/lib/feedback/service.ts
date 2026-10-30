import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/http/errors';
import {
  getOrCreateRestaurantLoyaltyProgram,
  awardFeedbackLoyaltyReward,
  type AwardRewardResult,
} from '@/lib/loyalty/service';
import type {
  CreateFeedbackInput,
  OwnerFeedbackQueryInput,
} from '@/lib/validation/feedback';

export interface OrderFeedbackItemInfo {
  productId: string;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  addons: string[];
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
  existingFeedback: {
    id: string;
    rating: number | null;
    comment: string | null;
    submittedAt: string;
    itemFeedback: {
      productId: string;
      rating: number | null;
      comment: string | null;
    }[];
  } | null;
  potentialReward: {
    isActive: boolean;
    programName: string;
    baseStars: number;
  };
}

export interface FeedbackSubmissionResult {
  feedbackId: string;
  orderId: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  reward: AwardRewardResult;
}

/**
 * Authoritative predicate for order feedback review eligibility.
 */
export function evaluateOrderFeedbackEligibility(
  orderStatus: string,
  alreadySubmitted: boolean
): { isEligible: boolean; reason: string | null } {
  if (alreadySubmitted) {
    return {
      isEligible: false,
      reason: 'Feedback has already been submitted for this order',
    };
  }
  if (orderStatus !== 'completed') {
    return {
      isEligible: false,
      reason: `Order status is "${orderStatus}". Feedback can only be submitted once your meal is marked as completed.`,
    };
  }
  return {
    isEligible: true,
    reason: null,
  };
}

/**
 * Checks if an order is eligible for customer feedback and returns order and item metadata.
 */
export async function getOrderFeedbackEligibility(
  orderId: string,
  customerId: string
): Promise<FeedbackEligibilityResult> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      restaurants: { select: { id: true, name: true } },
      restaurant_tables: { select: { id: true, table_number: true } },
      order_items: {
        include: {
          order_item_addons: true,
          products: { select: { id: true, image_url: true } },
        },
      },
      feedback: {
        include: {
          feedback_products: true,
          feedback_aspects: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Tenant/Customer ownership check: strictly reject other customers
  if (order.customer_id !== customerId) {
    throw new ForbiddenError('Access forbidden: You can only view or review your own orders');
  }

  // Loyalty rules preview
  const loyaltyProgram = await getOrCreateRestaurantLoyaltyProgram(order.restaurant_id);

  const existing = order.feedback[0] || null;
  const alreadySubmitted = !!existing;

  const { isEligible, reason } = evaluateOrderFeedbackEligibility(order.status, alreadySubmitted);

  const items: OrderFeedbackItemInfo[] = order.order_items.map((oi) => ({
    productId: oi.product_id,
    productName: oi.product_name,
    variantName: oi.variant_name,
    imageUrl: oi.products?.image_url || null,
    quantity: oi.quantity,
    addons: oi.order_item_addons.map((a) => a.addon_name),
  }));

  // Reconstruct existing item feedback if already submitted
  let existingFeedbackData = null;
  if (existing) {
    const itemMap = new Map<string, { rating: number | null; comment: string | null }>();
    for (const aspect of existing.feedback_aspects) {
      if (aspect.product_id) {
        const cur = itemMap.get(aspect.product_id) || { rating: null, comment: null };
        if (aspect.aspect === 'item_rating' && aspect.aspect_value) {
          cur.rating = parseInt(aspect.aspect_value, 10);
        } else if (aspect.aspect === 'item_comment') {
          cur.comment = aspect.aspect_value;
        }
        itemMap.set(aspect.product_id, cur);
      }
    }

    existingFeedbackData = {
      id: existing.id,
      rating: existing.rating,
      comment: existing.comment,
      submittedAt: existing.submitted_at.toISOString(),
      itemFeedback: Array.from(itemMap.entries()).map(([productId, data]) => ({
        productId,
        rating: data.rating,
        comment: data.comment,
      })),
    };
  }

  return {
    isEligible,
    reason,
    alreadySubmitted,
    order: {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      restaurantId: order.restaurant_id,
      restaurantName: order.restaurants.name,
      tableNumber: order.restaurant_tables?.table_number ?? null,
      completedAt: order.completed_at ? order.completed_at.toISOString() : null,
      items,
    },
    existingFeedback: existingFeedbackData,
    potentialReward: {
      isActive: loyaltyProgram.isActive,
      programName: loyaltyProgram.name,
      baseStars: loyaltyProgram.starsPerReview,
    },
  };
}

/**
 * Submits overall and item-level order feedback with transactional row-level locking,
 * duplicate-prevention, item-membership verification, and automatic loyalty reward awarding.
 */
export async function submitOrderFeedback(
  customerId: string,
  orderId: string,
  input: CreateFeedbackInput
): Promise<FeedbackSubmissionResult> {
  // Execute within atomic transaction
  return await prisma.$transaction(
    async (tx) => {
      // 1. Acquire row lock on order to serialize concurrent submissions
      const lockedOrders: any[] = await tx.$queryRaw`
        SELECT id, restaurant_id, branch_id, customer_id, status, order_number
        FROM orders
        WHERE id = ${orderId}::uuid
        FOR UPDATE
      `;

      if (!lockedOrders || lockedOrders.length === 0) {
        throw new NotFoundError('Order not found');
      }

      const order = lockedOrders[0];

      // 2. Customer ownership verification
      if (order.customer_id !== customerId) {
        throw new ForbiddenError('Access forbidden: You can only review your own orders');
      }

      // 3. Strict lifecycle state check: only 'completed' orders are eligible
      if (order.status !== 'completed') {
        throw new AppError(
          `Feedback can only be submitted for completed orders. Current order status: "${order.status}".`,
          400,
          'ORDER_NOT_COMPLETED'
        );
      }

      // 4. Duplicate feedback check inside the locked transaction
      const existingFeedback = await tx.feedback.findFirst({
        where: { order_id: orderId },
      });

      if (existingFeedback) {
        throw new ConflictError('Feedback has already been submitted for this order');
      }

      // 5. Verify ordered items for individual item feedback
      const orderItems = await tx.order_items.findMany({
        where: { order_id: orderId },
        select: { product_id: true, product_name: true },
      });

      const orderedProductIds = new Set(orderItems.map((oi) => oi.product_id));

      // Validate item reviews in payload:
      // a. No duplicates in payload for the same product
      // b. Product ID must belong to this order
      const reviewedProductIds = new Set<string>();

      for (const itemFeedback of input.items) {
        if (reviewedProductIds.has(itemFeedback.productId)) {
          throw new ValidationError(
            `Duplicate review submitted for product "${itemFeedback.productId}" in the same request`
          );
        }
        reviewedProductIds.add(itemFeedback.productId);

        if (!orderedProductIds.has(itemFeedback.productId)) {
          throw new ValidationError(
            `Invalid product ID "${itemFeedback.productId}": This product was not included in order ${order.order_number}`
          );
        }
      }

      // 6. Create overall feedback record
      const now = new Date();
      const feedback = await tx.feedback.create({
        data: {
          restaurant_id: order.restaurant_id,
          branch_id: order.branch_id,
          order_id: order.id,
          customer_id: customerId,
          rating: input.rating,
          comment: input.comment?.trim() || null,
          feedback_type: 'review',
          status: 'published',
          submitted_at: now,
        },
      });

      // 7. Insert individual item feedback (feedback_products and feedback_aspects)
      for (const itemFeedback of input.items) {
        await tx.feedback_products.create({
          data: {
            feedback_id: feedback.id,
            product_id: itemFeedback.productId,
            created_at: now,
          },
        });

        // Store rating aspect
        await tx.feedback_aspects.create({
          data: {
            feedback_id: feedback.id,
            product_id: itemFeedback.productId,
            aspect: 'item_rating',
            sentiment:
              itemFeedback.rating >= 4 ? 'positive' : itemFeedback.rating === 3 ? 'neutral' : 'negative',
            aspect_value: String(itemFeedback.rating),
            confidence: new Prisma.Decimal(1.0),
            created_at: now,
            updated_at: now,
          },
        });

        // Store comment aspect if provided
        if (itemFeedback.comment?.trim()) {
          await tx.feedback_aspects.create({
            data: {
              feedback_id: feedback.id,
              product_id: itemFeedback.productId,
              aspect: 'item_comment',
              sentiment:
                itemFeedback.rating >= 4 ? 'positive' : itemFeedback.rating === 3 ? 'neutral' : 'negative',
              aspect_value: itemFeedback.comment.trim(),
              confidence: new Prisma.Decimal(1.0),
              created_at: now,
              updated_at: now,
            },
          });
        }
      }

      // 8. Authoritative, idempotent loyalty reward calculation & awarding
      const rewardResult = await awardFeedbackLoyaltyReward(tx, {
        customerId,
        restaurantId: order.restaurant_id,
        orderId: order.id,
        feedbackId: feedback.id,
        itemCount: input.items.length,
      });

      return {
        feedbackId: feedback.id,
        orderId: order.id,
        rating: feedback.rating ?? input.rating,
        comment: feedback.comment,
        submittedAt: feedback.submitted_at.toISOString(),
        reward: rewardResult,
      };
    },
    {
      isolationLevel: 'ReadCommitted',
      maxWait: 5000,
      timeout: 10000,
    }
  );
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

export interface OwnerFeedbackResponse {
  restaurantId: string;
  summary: OwnerFeedbackSummary;
  items: OwnerFeedbackItem[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeFeedbackCursor(id: string, submittedAt: Date | string): string {
  const isoDate =
    submittedAt instanceof Date ? submittedAt.toISOString() : new Date(submittedAt).toISOString();
  const payload = { id, submittedAt: isoDate };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeFeedbackCursor(cursorStr: string): string | null {
  if (!cursorStr || typeof cursorStr !== 'string') {
    return null;
  }
  const trimmed = cursorStr.trim();
  if (!trimmed) {
    return null;
  }
  if (UUID_REGEX.test(trimmed)) {
    return trimmed;
  }
  try {
    const jsonStr = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.id === 'string' && UUID_REGEX.test(parsed.id.trim())) {
      return parsed.id.trim();
    }
  } catch {
    // Malformed cursor
  }
  return null;
}

/**
 * Retrieves paginated feedback records and server-calculated rating summary
 * for an authenticated restaurant owner's authorized restaurant.
 * Tenant-scoped strictly to `restaurantId`.
 */
export async function getOwnerFeedback(
  restaurantId: string,
  query: OwnerFeedbackQueryInput
): Promise<OwnerFeedbackResponse> {
  const limit = query.limit ?? 20;

  // 1. Build base tenant-isolated filter
  const baseWhere: Prisma.feedbackWhereInput = {
    restaurant_id: restaurantId,
  };

  if (query.branchId) {
    baseWhere.branch_id = query.branchId;
  }

  if (query.startDate || query.endDate) {
    baseWhere.submitted_at = {};
    if (query.startDate) {
      baseWhere.submitted_at.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      baseWhere.submitted_at.lte = new Date(query.endDate);
    }
  }

  // 2. Build items where clause (inheriting base filters, adding cursor pagination)
  const itemsWhere: Prisma.feedbackWhereInput = { ...baseWhere };

  if (query.cursor) {
    const cursorId = decodeFeedbackCursor(query.cursor);
    if (!cursorId) {
      throw new ValidationError('Invalid cursor: malformed cursor string');
    }

    const cursorFeedback = await prisma.feedback.findFirst({
      where: {
        id: cursorId,
        ...baseWhere,
      },
      select: {
        id: true,
        submitted_at: true,
      },
    });

    if (!cursorFeedback) {
      throw new ValidationError(
        'Invalid cursor: referenced feedback does not exist or does not match query filters'
      );
    }

    itemsWhere.OR = [
      { submitted_at: { lt: cursorFeedback.submitted_at } },
      {
        submitted_at: cursorFeedback.submitted_at,
        id: { lt: cursorFeedback.id },
      },
    ];
  }

  // 3. Concurrently fetch summary metrics across all matching records (not limited to current page)
  // and fetch limit + 1 items for deterministic keyset pagination
  const [totalCount, avgAggregate, ratingGroupCounts, rawItems] = await Promise.all([
    prisma.feedback.count({ where: baseWhere }),
    prisma.feedback.aggregate({
      where: {
        ...baseWhere,
        rating: { not: null },
      },
      _avg: { rating: true },
    }),
    prisma.feedback.groupBy({
      by: ['rating'],
      where: {
        ...baseWhere,
        rating: { in: [1, 2, 3, 4, 5] },
      },
      _count: { id: true },
    }),
    prisma.feedback.findMany({
      where: itemsWhere,
      orderBy: [
        { submitted_at: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      include: {
        branches: { select: { id: true, name: true } },
        orders: { select: { id: true, order_number: true } },
        customers: { select: { id: true, name: true } },
      },
    }),
  ]);

  // 4. Compute server-derived summary metrics
  const rawAvg = avgAggregate._avg?.rating;
  // Documented rounding rule: round to 1 decimal place; null when no valid ratings exist
  const averageRating =
    rawAvg !== null && rawAvg !== undefined
      ? Math.round(rawAvg * 10) / 10
      : null;

  const ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number } = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const group of ratingGroupCounts) {
    if (group.rating && group.rating >= 1 && group.rating <= 5) {
      ratingDistribution[group.rating as 1 | 2 | 3 | 4 | 5] = group._count.id;
    }
  }

  // 5. Handle pagination slicing
  const hasMore = rawItems.length > limit;
  const pagedItems = hasMore ? rawItems.slice(0, limit) : rawItems;
  const lastItem = pagedItems[pagedItems.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeFeedbackCursor(lastItem.id, lastItem.submitted_at)
      : null;

  // 6. Map to privacy-safe owner feedback items (never include customer phone or auth data)
  const items: OwnerFeedbackItem[] = pagedItems.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    orderNumber: item.orders?.order_number ?? null,
    rating: item.rating ?? null,
    comment: item.comment ?? null,
    status: item.status ?? null,
    createdAt: item.created_at.toISOString(),
    submittedAt: item.submitted_at.toISOString(),
    branchId: item.branch_id ?? null,
    branchName: item.branches?.name ?? null,
    customerName: item.customers?.name ?? null,
  }));

  return {
    restaurantId,
    summary: {
      totalCount,
      averageRating,
      ratingDistribution,
    },
    items,
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}
