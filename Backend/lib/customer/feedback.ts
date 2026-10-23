import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { ValidationError } from '@/lib/http/errors';
import { decodeOrderCursor, encodeOrderCursor } from '@/lib/orders/cursor';
import { evaluateOrderFeedbackEligibility } from '@/lib/feedback/service';
import type { CustomerFeedbackQueryInput } from '@/lib/validation/feedback';

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
  items: Array<{
    productId: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    imageUrl: string | null;
    addons: string[];
  }>;
  eligibility: {
    isEligible: boolean;
    reason: string | null;
  };
  hasFeedback: boolean;
  feedback: {
    id: string;
    rating: number | null;
    comment: string | null;
    submittedAt: string;
    itemFeedback: Array<{
      productId: string;
      productName: string;
      rating: number | null;
      comment: string | null;
    }>;
    reward: {
      isAwarded: boolean;
      pointsAwarded: number;
      starsAwarded: number;
      transactionType: string | null;
      description: string | null;
    } | null;
  } | null;
  potentialReward: {
    isActive: boolean;
    programName: string;
    basePoints: number;
    baseStars: number;
  } | null;
}

export interface CustomerRestaurantFeedbackSummary {
  restaurantId: string;
  restaurantName: string;
  pendingFeedbackCount: number;
  totalOrdersCount: number;
  reviewedOrdersCount: number;
}

export interface CustomerFeedbackHistoryResponse {
  orders: CustomerFeedbackOrderItem[];
  pagination: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
  summary: {
    all: number;
    awaitingReview: number;
    reviewed: number;
  };
  restaurantSummary: CustomerRestaurantFeedbackSummary[];
}

/**
 * Retrieves paginated order feedback history for an authenticated customer with restaurant-grouped summaries.
 * Strictly scoped to customerId to prevent any cross-tenant or cross-customer data leakage.
 */
export async function getCustomerFeedbackHistory(
  customerId: string,
  query: CustomerFeedbackQueryInput
): Promise<CustomerFeedbackHistoryResponse> {
  const limit = query.limit ?? 10;

  // 1. Build customer-isolated where clause
  const where: Prisma.ordersWhereInput = {
    customer_id: customerId,
  };

  if (query.restaurantId) {
    where.restaurant_id = query.restaurantId;
  }

  if (query.status === 'awaiting_review') {
    where.status = 'completed';
    where.feedback = { none: {} };
  } else if (query.status === 'reviewed') {
    where.feedback = { some: {} };
  }

  // 2. Handle keyset cursor pagination if anchor cursor provided
  if (query.cursor) {
    const decodedCursorId = decodeOrderCursor(query.cursor);
    if (!decodedCursorId) {
      throw new ValidationError('Invalid cursor: malformed cursor string');
    }

    const cursorOrder = await prisma.orders.findFirst({
      where: {
        id: decodedCursorId,
        customer_id: customerId, // strictly tenant/customer isolated
      },
      select: {
        id: true,
        ordered_at: true,
      },
    });

    if (!cursorOrder) {
      throw new ValidationError(
        'Invalid cursor: referenced order does not exist or does not belong to you'
      );
    }

    where.OR = [
      { ordered_at: { lt: cursorOrder.ordered_at } },
      {
        ordered_at: cursorOrder.ordered_at,
        id: { lt: cursorOrder.id },
      },
    ];
  }

  // 3. Concurrently fetch paginated orders and global restaurant summaries
  const [orders, totalPerRest, pendingPerRest, reviewedPerRest] = await Promise.all([
    prisma.orders.findMany({
      where,
      orderBy: [
        { ordered_at: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      include: {
        restaurants: {
          select: {
            id: true,
            name: true,
            loyalty_programs: {
              select: {
                name: true,
                is_active: true,
                stars_per_review: true,
              },
            },
          },
        },
        branches: {
          select: { id: true, name: true },
        },
        restaurant_tables: {
          select: { id: true, table_number: true },
        },
        order_items: {
          include: {
            order_item_addons: {
              select: { addon_name: true },
            },
            products: {
              select: { image_url: true },
            },
          },
        },
        feedback: {
          include: {
            feedback_aspects: true,
            loyalty_transactions: {
              where: { transaction_type: 'review_reward' },
              select: {
                stars: true,
                transaction_type: true,
                description: true,
              },
            },
          },
        },
      },
    }),
    // Global total orders per restaurant for this customer
    prisma.orders.groupBy({
      by: ['restaurant_id'],
      where: { customer_id: customerId },
      _count: { id: true },
    }),
    // Global pending feedback orders per restaurant for this customer
    prisma.orders.groupBy({
      by: ['restaurant_id'],
      where: {
        customer_id: customerId,
        status: 'completed',
        feedback: { none: {} },
      },
      _count: { id: true },
    }),
    // Global reviewed orders per restaurant for this customer
    prisma.orders.groupBy({
      by: ['restaurant_id'],
      where: {
        customer_id: customerId,
        feedback: { some: {} },
      },
      _count: { id: true },
    }),
  ]);

  // 4. Resolve restaurant names for restaurantSummary
  const allRestaurantIds = Array.from(new Set(totalPerRest.map((r) => r.restaurant_id)));
  const restaurantRecords =
    allRestaurantIds.length > 0
      ? await prisma.restaurants.findMany({
          where: { id: { in: allRestaurantIds } },
          select: { id: true, name: true },
        })
      : [];
  const restaurantNameMap = new Map(restaurantRecords.map((r) => [r.id, r.name]));

  const pendingMap = new Map(pendingPerRest.map((p) => [p.restaurant_id, p._count.id]));
  const reviewedMap = new Map(reviewedPerRest.map((r) => [r.restaurant_id, r._count.id]));

  const restaurantSummary: CustomerRestaurantFeedbackSummary[] = totalPerRest.map((t) => ({
    restaurantId: t.restaurant_id,
    restaurantName: restaurantNameMap.get(t.restaurant_id) ?? 'Unknown Restaurant',
    pendingFeedbackCount: pendingMap.get(t.restaurant_id) ?? 0,
    totalOrdersCount: t._count.id,
    reviewedOrdersCount: reviewedMap.get(t.restaurant_id) ?? 0,
  }));

  const globalSummary = {
    all: totalPerRest.reduce((acc, curr) => acc + curr._count.id, 0),
    awaitingReview: pendingPerRest.reduce((acc, curr) => acc + curr._count.id, 0),
    reviewed: reviewedPerRest.reduce((acc, curr) => acc + curr._count.id, 0),
  };

  // 5. Handle pagination slicing
  const hasNextPage = orders.length > limit;
  const pagedOrders = hasNextPage ? orders.slice(0, limit) : orders;
  const lastOrder = pagedOrders[pagedOrders.length - 1];
  const nextCursor =
    hasNextPage && lastOrder
      ? encodeOrderCursor(lastOrder.id, lastOrder.ordered_at)
      : null;

  // 6. Format order items with eligibility and feedback details
  const formattedOrders: CustomerFeedbackOrderItem[] = pagedOrders.map((order) => {
    const fb = Array.isArray(order.feedback) && order.feedback.length > 0 ? order.feedback[0] : null;
    const alreadySubmitted = !!fb;
    const { isEligible, reason } = evaluateOrderFeedbackEligibility(order.status, alreadySubmitted);

    const totalAmount = new Prisma.Decimal(order.total_amount ?? 0);

    // Map ordered product IDs to product names
    const productNameMap = new Map<string, string>();
    for (const oi of order.order_items) {
      productNameMap.set(oi.product_id, oi.product_name);
    }

    const items = order.order_items.map((oi) => ({
      productId: oi.product_id,
      productName: oi.product_name,
      variantName: oi.variant_name ?? null,
      quantity: oi.quantity,
      imageUrl: oi.products?.image_url ?? null,
      addons: oi.order_item_addons.map((a) => a.addon_name),
    }));

    // Format submitted feedback if present
    let formattedFeedback = null;
    if (fb) {
      const itemMap = new Map<string, { rating: number | null; comment: string | null }>();
      for (const aspect of fb.feedback_aspects) {
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

      const tx =
        Array.isArray(fb.loyalty_transactions) && fb.loyalty_transactions.length > 0
          ? fb.loyalty_transactions[0]
          : null;

      formattedFeedback = {
        id: fb.id,
        rating: fb.rating,
        comment: fb.comment,
        submittedAt:
          fb.submitted_at instanceof Date
            ? fb.submitted_at.toISOString()
            : new Date(fb.submitted_at).toISOString(),
        itemFeedback: Array.from(itemMap.entries()).map(([productId, data]) => ({
          productId,
          productName: productNameMap.get(productId) ?? 'Unknown Dish',
          rating: data.rating,
          comment: data.comment,
        })),
        reward: tx
          ? {
              isAwarded: true,
              pointsAwarded: tx.stars,
              starsAwarded: tx.stars,
              transactionType: tx.transaction_type,
              description: tx.description,
            }
          : null,
      };
    }

    // Format potential reward preview if feedback not yet submitted
    const lp = order.restaurants?.loyalty_programs;
    const potentialReward =
      !fb && lp && lp.is_active
        ? {
            isActive: true,
            programName: lp.name,
            basePoints: lp.stars_per_review,
            baseStars: lp.stars_per_review,
          }
        : null;

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      restaurant: {
        id: order.restaurants.id,
        name: order.restaurants.name,
      },
      branch: order.branches
        ? {
            id: order.branches.id,
            name: order.branches.name,
          }
        : null,
      table: order.restaurant_tables
        ? {
            id: order.restaurant_tables.id,
            tableNumber: order.restaurant_tables.table_number,
          }
        : null,
      orderedAt:
        order.ordered_at instanceof Date
          ? order.ordered_at.toISOString()
          : new Date(order.ordered_at).toISOString(),
      completedAt:
        order.completed_at instanceof Date
          ? order.completed_at.toISOString()
          : order.completed_at
          ? new Date(order.completed_at).toISOString()
          : null,
      pricing: {
        totalAmount: Number(totalAmount),
        totalAmountFormatted: totalAmount.toFixed(2),
        currency: 'INR',
      },
      items,
      eligibility: {
        isEligible,
        reason,
      },
      hasFeedback: alreadySubmitted,
      feedback: formattedFeedback,
      potentialReward,
    };
  });

  return {
    orders: formattedOrders,
    pagination: {
      limit,
      hasNextPage,
      nextCursor,
    },
    summary: globalSummary,
    restaurantSummary,
  };
}
