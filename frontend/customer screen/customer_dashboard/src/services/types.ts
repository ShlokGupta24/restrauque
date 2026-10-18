export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  memberSince: string;
  avatarUrl?: string;
  preferences: {
    dietaryPreference: 'all' | 'veg' | 'non-veg';
    spiceLevel: 'mild' | 'medium' | 'spicy';
    emailReceipts: boolean;
    smsAlerts: boolean;
    promotionalOffers: boolean;
  };
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  variantName?: string;
  imageUrl?: string;
}

export type OrderStatus = 'completed' | 'preparing' | 'ready' | 'cancelled';
export type ReviewEligibilityState = 'eligible' | 'submitted' | 'unavailable';

export interface OrderBill {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CustomerOrder {
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  restaurantThemeColor?: string;
  tableLabel: string;
  orderedAt: string;
  completedAt?: string;
  status: OrderStatus;
  statusLabel: string;
  items: OrderItem[];
  bill: OrderBill;
  paymentMethod: string;
  reviewStatus: ReviewEligibilityState;
}

export interface ItemReviewAspect {
  productId: string;
  productName: string;
  rating?: number;
  comment?: string;
}

export interface CustomerReview {
  reviewId: string;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  overallRating: number;
  overallComment: string;
  items: ItemReviewAspect[];
  submittedAt: string;
  pointsEarned: number;
}

export interface LoyaltyRewardItem {
  id: string;
  title: string;
  costPoints: number;
  description: string;
  minOrderValue?: number;
  code: string;
}

export interface LoyaltyTransaction {
  id: string;
  date: string;
  type: 'earn' | 'redeem';
  description: string;
  points: number;
  orderNumber?: string;
}

export interface RestaurantLoyaltyWallet {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  tier: string;
  availablePoints: number;
  pointsEarned: number;
  pointsRedeemed: number;
  expiryDetails: string;
  availableRewards: LoyaltyRewardItem[];
  transactions: LoyaltyTransaction[];
}

export interface DashboardMetrics {
  totalOrders: number;
  totalLoyaltyPoints: number;
  reviewsCompleted: number;
  reviewsPending: number;
  favoriteRestaurants: string[];
}
