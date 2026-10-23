/**
 * Restrauque Customer Dashboard Loyalty Service
 * Communicates with Next.js backend API:
 *   - GET /api/v1/customer/loyalty?restaurantId=:restaurantId
 *   - GET /api/v1/customer/dashboard/overview (multi-restaurant account discovery)
 *
 * Uses typed apiClient with credentials: 'include' for HttpOnly session cookie authentication.
 * Never persists tokens in browser storage.
 */

import { apiClient } from './apiClient';
import {
  fetchCustomerDashboardOverview,
} from './overviewService';

export interface LoyaltyTransactionItem {
  id: string;
  transactionType: string;
  stars: number;
  description: string | null;
  createdAt: string;
}

export interface CustomerLoyaltyWalletSummary {
  accountId: string;
  customerId: string;
  restaurantId: string;
  programName: string;
  starsBalance: number;
  lifetimeStarsEarned: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
  recentTransactions: LoyaltyTransactionItem[];
}

export interface CustomerDetailedWallet extends CustomerLoyaltyWalletSummary {
  restaurantName: string;
}

export interface CustomerLoyaltyWalletsResult {
  wallets: CustomerDetailedWallet[];
  totalInformationalPoints: number;
}

/**
 * Fetch a customer's authoritative loyalty wallet and recent transactions for a specific restaurant.
 * Note: restaurantId query parameter is strictly required by the backend.
 */
export async function fetchCustomerLoyaltyWallet(
  restaurantId: string,
  signal?: AbortSignal
): Promise<CustomerLoyaltyWalletSummary> {
  const cleanId = restaurantId?.trim();
  if (!cleanId) {
    throw new Error('restaurantId is required to retrieve customer loyalty wallet');
  }

  return await apiClient.get<CustomerLoyaltyWalletSummary>(
    '/api/v1/customer/loyalty',
    {
      params: { restaurantId: cleanId },
      signal,
    }
  );
}

/**
 * Fetch all loyalty accounts for the authenticated customer across all partner restaurants.
 * Discovers accounts via the dashboard overview and enriches each with live transaction history.
 */
export async function fetchCustomerLoyaltyWallets(
  signal?: AbortSignal
): Promise<CustomerLoyaltyWalletsResult> {
  // 1. Fetch overview to discover all registered loyalty accounts for this customer
  const overview = await fetchCustomerDashboardOverview(signal);
  const accounts = overview.loyaltyAccounts || [];

  if (accounts.length === 0) {
    return {
      wallets: [],
      totalInformationalPoints: 0,
    };
  }

  // 2. Concurrently fetch authoritative wallet details and transactions for each restaurant
  const walletPromises = accounts.map(async (acc) => {
    try {
      const details = await fetchCustomerLoyaltyWallet(acc.restaurantId, signal);
      return {
        ...details,
        restaurantName: acc.restaurantName,
      };
    } catch {
      // Graceful fallback to overview account data if individual restaurant detail fails
      return {
        accountId: acc.accountId,
        customerId: overview.customer.id,
        restaurantId: acc.restaurantId,
        restaurantName: acc.restaurantName,
        programName: acc.programName,
        starsBalance: acc.pointsBalance ?? acc.starsBalance,
        lifetimeStarsEarned: acc.lifetimePointsEarned ?? acc.lifetimeStarsEarned,
        lifetimeStarsRedeemed: acc.lifetimePointsRedeemed ?? acc.lifetimeStarsRedeemed,
        tier: acc.tier,
        status: acc.status,
        recentTransactions: [],
      };
    }
  });

  const wallets = await Promise.all(walletPromises);

  // Authoritative combined informational total
  const totalInformationalPoints = wallets.reduce(
    (acc, w) => acc + (w.starsBalance || 0),
    0
  );

  return {
    wallets,
    totalInformationalPoints,
  };
}
