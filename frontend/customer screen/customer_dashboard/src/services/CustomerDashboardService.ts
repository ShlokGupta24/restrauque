import {
  CustomerProfile,
  CustomerOrder,
  CustomerReview,
  RestaurantLoyaltyWallet,
  DashboardMetrics,
  ReviewEligibilityState,
  ItemReviewAspect,
} from './types';
import {
  DEMO_CUSTOMER_PROFILE,
  DEMO_RESTAURANTS,
  DEMO_INITIAL_ORDERS,
  DEMO_INITIAL_REVIEWS,
  DEMO_INITIAL_LOYALTY_WALLETS,
  DEMO_REVIEW_REWARD_POINTS,
  RestaurantMeta,
} from '../data/demoCustomerDashboard';

class CustomerDashboardService {
  private profile: CustomerProfile = { ...DEMO_CUSTOMER_PROFILE };
  private orders: CustomerOrder[] = JSON.parse(JSON.stringify(DEMO_INITIAL_ORDERS));
  private reviews: CustomerReview[] = JSON.parse(JSON.stringify(DEMO_INITIAL_REVIEWS));
  private loyaltyWallets: Record<string, RestaurantLoyaltyWallet> = JSON.parse(
    JSON.stringify(DEMO_INITIAL_LOYALTY_WALLETS)
  );

  /**
   * Fetch current customer profile.
   */
  public getProfile(): CustomerProfile {
    return { ...this.profile };
  }

  /**
   * Update customer profile in local frontend demo memory.
   */
  public updateProfile(updates: Partial<CustomerProfile>): CustomerProfile {
    this.profile = {
      ...this.profile,
      ...updates,
      preferences: {
        ...this.profile.preferences,
        ...(updates.preferences || {}),
      },
    };
    return { ...this.profile };
  }

  /**
   * Get all registered restaurant metadata.
   */
  public getAllRestaurants(): RestaurantMeta[] {
    return [...DEMO_RESTAURANTS];
  }

  public getRestaurantById(restaurantId: string): RestaurantMeta | undefined {
    return DEMO_RESTAURANTS.find((r) => r.id === restaurantId);
  }

  /**
   * Retrieve all orders for the customer across all restaurants.
   */
  public getAllOrders(): CustomerOrder[] {
    return this.orders.map((ord) => ({
      ...ord,
      reviewStatus: this.getReviewEligibility(ord.orderId),
    }));
  }

  /**
   * Retrieve orders filtered by restaurant.
   */
  public getOrdersByRestaurant(restaurantId: string): CustomerOrder[] {
    return this.getAllOrders().filter((o) => o.restaurantId === restaurantId);
  }

  /**
   * Retrieve single order by orderId.
   */
  public getOrderById(orderId: string): CustomerOrder | undefined {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) return undefined;
    return {
      ...order,
      reviewStatus: this.getReviewEligibility(order.orderId),
    };
  }

  /**
   * STRICT ONE REVIEW PER ORDER:
   * Deterministic status: 'eligible' | 'submitted' | 'unavailable'
   */
  public getReviewEligibility(orderId: string): ReviewEligibilityState {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) return 'unavailable';

    // Rule 1: Only completed orders are eligible for review
    if (order.status !== 'completed') {
      return 'unavailable';
    }

    // Rule 2: If a review already exists for this orderId, status is strictly 'submitted'
    const alreadyReviewed = this.reviews.some((r) => r.orderId === orderId);
    if (alreadyReviewed) {
      return 'submitted';
    }

    // Rule 3: Completed and not yet reviewed
    return 'eligible';
  }

  /**
   * Retrieve all customer reviews.
   */
  public getAllReviews(): CustomerReview[] {
    return [...this.reviews];
  }

  /**
   * Retrieve reviews filtered by restaurant.
   */
  public getReviewsByRestaurant(restaurantId: string): CustomerReview[] {
    return this.reviews.filter((r) => r.restaurantId === restaurantId);
  }

  /**
   * Retrieve review for a specific order.
   */
  public getReviewByOrderId(orderId: string): CustomerReview | undefined {
    return this.reviews.find((r) => r.orderId === orderId);
  }

  /**
   * Submit an order review.
   * STRICT ONE REVIEW PER ORDER ENFORCEMENT:
   * Throws an error if order is already reviewed or not completed.
   */
  public submitOrderReview(params: {
    orderId: string;
    overallRating: number;
    overallComment: string;
    items?: ItemReviewAspect[];
  }): { success: boolean; review: CustomerReview; awardedPoints: number } {
    const order = this.getOrderById(params.orderId);
    if (!order) {
      throw new Error(`Order ${params.orderId} not found.`);
    }

    if (order.status !== 'completed') {
      throw new Error('Only completed orders can be reviewed.');
    }

    const currentStatus = this.getReviewEligibility(params.orderId);
    if (currentStatus === 'submitted') {
      throw new Error('A review has already been submitted for this order. Duplicate reviews are strictly prohibited.');
    }

    if (params.overallRating < 1 || params.overallRating > 5) {
      throw new Error('Rating must be between 1 and 5 stars.');
    }

    // Standard demo reward: 50 points per eligible review (same points for any 1-5 star review)
    const awardedPoints = DEMO_REVIEW_REWARD_POINTS;

    const newReview: CustomerReview = {
      reviewId: `rev-${order.restaurantSlug}-${Date.now().toString(36)}`,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName,
      overallRating: params.overallRating,
      overallComment: params.overallComment || 'No written comment provided.',
      items: params.items || [],
      submittedAt: 'Just now (Demo)',
      pointsEarned: awardedPoints,
    };

    // Store review
    this.reviews.unshift(newReview);

    // Update order in memory
    const orderIndex = this.orders.findIndex((o) => o.orderId === params.orderId);
    if (orderIndex >= 0) {
      this.orders[orderIndex].reviewStatus = 'submitted';
    }

    // Award loyalty points to the specific restaurant's wallet once
    const wallet = this.loyaltyWallets[order.restaurantId];
    if (wallet) {
      wallet.availablePoints += awardedPoints;
      wallet.pointsEarned += awardedPoints;
      wallet.transactions.unshift({
        id: `txn-rev-${Date.now().toString(36)}`,
        date: 'Today',
        type: 'earn',
        description: `Review bonus (+${awardedPoints} pts) for ${order.orderNumber}`,
        points: awardedPoints,
        orderNumber: order.orderNumber,
      });
    }

    return {
      success: true,
      review: newReview,
      awardedPoints,
    };
  }

  /**
   * Retrieve separate loyalty wallets for all restaurants.
   * Balances are NEVER aggregated into a single spendable pool.
   */
  public getLoyaltyWallets(): RestaurantLoyaltyWallet[] {
    return Object.values(this.loyaltyWallets);
  }

  public getLoyaltyWalletByRestaurant(restaurantId: string): RestaurantLoyaltyWallet | undefined {
    return this.loyaltyWallets[restaurantId];
  }

  /**
   * Compute unified dashboard metrics from the single source of truth.
   */
  public getDashboardMetrics(): DashboardMetrics {
    const allOrders = this.getAllOrders();
    const eligibleOrders = allOrders.filter((o) => o.reviewStatus === 'eligible');
    const totalPoints = Object.values(this.loyaltyWallets).reduce(
      (sum, w) => sum + w.availablePoints,
      0
    );

    const restaurantCounts: Record<string, number> = {};
    allOrders.forEach((o) => {
      restaurantCounts[o.restaurantName] = (restaurantCounts[o.restaurantName] || 0) + 1;
    });
    const favoriteRestaurants = Object.keys(restaurantCounts).sort(
      (a, b) => restaurantCounts[b] - restaurantCounts[a]
    );

    return {
      totalOrders: allOrders.length,
      totalLoyaltyPoints: totalPoints,
      reviewsCompleted: this.reviews.length,
      reviewsPending: eligibleOrders.length,
      favoriteRestaurants,
    };
  }

  /**
   * Helper for restaurant-specific metrics.
   */
  public getRestaurantSummary(restaurantId: string): {
    restaurantName: string;
    points: number;
    pendingReviewsCount: number;
    submittedReviewsCount: number;
    completedOrdersCount: number;
  } {
    const orders = this.getOrdersByRestaurant(restaurantId);
    const reviews = this.getReviewsByRestaurant(restaurantId);
    const wallet = this.getLoyaltyWalletByRestaurant(restaurantId);
    const pendingReviewsCount = orders.filter((o) => o.reviewStatus === 'eligible').length;

    return {
      restaurantName: wallet?.restaurantName || restaurantId,
      points: wallet?.availablePoints || 0,
      pendingReviewsCount,
      submittedReviewsCount: reviews.length,
      completedOrdersCount: orders.filter((o) => o.status === 'completed').length,
    };
  }
}

export const customerDashboardService = new CustomerDashboardService();
