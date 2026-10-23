import { prisma } from '@/lib/db/prisma';
import { NotFoundError } from '@/lib/http/errors';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
}

export interface CustomerFeedbackSummary {
  pendingFeedbackCount: number;
  submittedFeedbackCount: number;
  completedOrdersCount: number;
}

export interface CustomerLoyaltyAccountSummary {
  accountId: string;
  restaurantId: string;
  restaurantName: string;
  programName: string;
  pointsBalance: number;
  starsBalance: number;
  lifetimePointsEarned: number;
  lifetimeStarsEarned: number;
  lifetimePointsRedeemed: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
}

export interface RecentVisitedRestaurant {
  restaurantId: string;
  restaurantName: string;
  lastOrderDate: string | null;
  visitCount: number;
}

export interface RecentPointsActivityItem {
  id: string;
  restaurantId: string;
  restaurantName: string;
  transactionType: string;
  pointsDelta: number;
  points: number;
  stars: number;
  action: 'earn' | 'redeem';
  isEarned: boolean;
  balanceAfter: number | null;
  description: string | null;
  createdAt: string;
}

export interface CustomerDashboardOverviewResponse {
  customer: CustomerProfile;
  feedbackSummary: CustomerFeedbackSummary;
  loyaltyAccounts: CustomerLoyaltyAccountSummary[];
  recentRestaurants: RecentVisitedRestaurant[];
  recentPointsActivity: RecentPointsActivityItem[];
}

export interface FallbackCustomerInfo {
  id: string;
  name: string;
  phone: string | null;
}

/**
 * Retrieves the aggregated customer dashboard overview data.
 * All queries are strictly scoped to the authenticated customer ID to prevent cross-customer data leakage.
 */
export async function getCustomerDashboardOverview(
  customerId: string,
  fallbackCustomer?: FallbackCustomerInfo
): Promise<CustomerDashboardOverviewResponse> {
  // Concurrently execute all independent customer-scoped queries
  const [
    customerRecord,
    pendingFeedbackCount,
    submittedFeedbackCount,
    completedOrdersCount,
    loyaltyAccounts,
    restaurantVisits,
    recentTransactions,
  ] = await Promise.all([
    prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, phone: true },
    }),
    // Completed orders eligible for feedback that have not yet been reviewed
    prisma.orders.count({
      where: {
        customer_id: customerId,
        status: 'completed',
        feedback: { none: {} },
      },
    }),
    // Total reviews submitted by customer
    prisma.feedback.count({
      where: { customer_id: customerId },
    }),
    // Total completed orders
    prisma.orders.count({
      where: {
        customer_id: customerId,
        status: 'completed',
      },
    }),
    // Loyalty accounts grouped per restaurant
    prisma.customer_loyalty_accounts.findMany({
      where: { customer_id: customerId },
      include: {
        restaurants: { select: { id: true, name: true } },
        loyalty_programs: { select: { name: true } },
      },
      orderBy: { updated_at: 'desc' },
    }),
    // Recent visited restaurants based on qualifying non-cancelled orders
    prisma.orders.groupBy({
      by: ['restaurant_id'],
      where: {
        customer_id: customerId,
        status: { not: 'cancelled' },
      },
      _count: { id: true },
      _max: { ordered_at: true },
      orderBy: {
        _max: { ordered_at: 'desc' },
      },
      take: 5,
    }),
    // Recent loyalty transactions across restaurants
    prisma.loyalty_transactions.findMany({
      where: { customer_id: customerId },
      include: {
        restaurants: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ]);

  const resolvedProfile: CustomerProfile = customerRecord
    ? {
        id: customerRecord.id,
        name: customerRecord.name,
        phone: customerRecord.phone ?? null,
      }
    : fallbackCustomer
    ? {
        id: fallbackCustomer.id,
        name: fallbackCustomer.name,
        phone: fallbackCustomer.phone ?? null,
      }
    : (() => {
        throw new NotFoundError('Customer profile not found');
      })();

  // Resolve restaurant names for recent restaurant visits
  const restaurantIds = restaurantVisits.map((v) => v.restaurant_id);
  const restaurantRecords =
    restaurantIds.length > 0
      ? await prisma.restaurants.findMany({
          where: { id: { in: restaurantIds } },
          select: { id: true, name: true },
        })
      : [];
  const restaurantMap = new Map(restaurantRecords.map((r) => [r.id, r.name]));

  const recentRestaurants: RecentVisitedRestaurant[] = restaurantVisits.map((v) => ({
    restaurantId: v.restaurant_id,
    restaurantName: restaurantMap.get(v.restaurant_id) ?? 'Unknown Restaurant',
    lastOrderDate: v._max.ordered_at ? v._max.ordered_at.toISOString() : null,
    visitCount: v._count.id,
  }));

  // Serialize loyalty accounts preserving points and backward compatible stars
  const serializedAccounts: CustomerLoyaltyAccountSummary[] = loyaltyAccounts.map((acc) => ({
    accountId: acc.id,
    restaurantId: acc.restaurant_id,
    restaurantName: acc.restaurants?.name ?? 'Unknown Restaurant',
    programName: acc.loyalty_programs?.name ?? 'Dining Rewards',
    pointsBalance: acc.stars_balance,
    starsBalance: acc.stars_balance,
    lifetimePointsEarned: acc.lifetime_stars_earned,
    lifetimeStarsEarned: acc.lifetime_stars_earned,
    lifetimePointsRedeemed: acc.lifetime_stars_redeemed,
    lifetimeStarsRedeemed: acc.lifetime_stars_redeemed,
    tier: acc.tier,
    status: acc.status,
  }));

  // Serialize recent points activity
  const serializedTransactions: RecentPointsActivityItem[] = recentTransactions.map((tx) => {
    const isEarned = tx.stars > 0;
    return {
      id: tx.id,
      restaurantId: tx.restaurant_id,
      restaurantName: tx.restaurants?.name ?? 'Unknown Restaurant',
      transactionType: tx.transaction_type,
      pointsDelta: tx.stars,
      points: tx.stars,
      stars: tx.stars,
      action: tx.stars >= 0 ? 'earn' : 'redeem',
      isEarned,
      balanceAfter: null, // Note: Schema does not store per-transaction balance_after
      description: tx.description,
      createdAt:
        tx.created_at instanceof Date
          ? tx.created_at.toISOString()
          : new Date(tx.created_at).toISOString(),
    };
  });

  return {
    customer: resolvedProfile,
    feedbackSummary: {
      pendingFeedbackCount,
      submittedFeedbackCount,
      completedOrdersCount,
    },
    loyaltyAccounts: serializedAccounts,
    recentRestaurants,
    recentPointsActivity: serializedTransactions,
  };
}
