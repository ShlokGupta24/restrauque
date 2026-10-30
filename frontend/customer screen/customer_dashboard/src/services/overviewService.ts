/**
 * Restrauque Customer Dashboard Overview Service
 * Communicates with Next.js backend API: GET /api/v1/customer/dashboard/overview
 * Uses typed apiClient with credentials: 'include' for HttpOnly session cookie authentication.
 */

import { apiClient } from './apiClient';

export interface CustomerProfileSummary {
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
  customer: CustomerProfileSummary;
  feedbackSummary: CustomerFeedbackSummary;
  loyaltyAccounts: CustomerLoyaltyAccountSummary[];
  recentRestaurants: RecentVisitedRestaurant[];
  recentPointsActivity: RecentPointsActivityItem[];
}

/**
 * Fetch the authenticated customer's dashboard overview from the backend API.
 */
export async function fetchCustomerDashboardOverview(
  signal?: AbortSignal
): Promise<CustomerDashboardOverviewResponse> {
  return await apiClient.get<CustomerDashboardOverviewResponse>(
    '/api/v1/customer/dashboard/overview',
    { signal }
  );
}
