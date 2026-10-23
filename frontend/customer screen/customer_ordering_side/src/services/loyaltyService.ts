/**
 * Restrauque Customer Loyalty Service (loyaltyService)
 *
 * Communicates with Next.js backend loyalty endpoints using typed apiClient:
 * - GET /api/v1/customer/loyalty?restaurantId=[uuid] -> getCustomerLoyaltySummary
 *
 * Requirements & Guardrails:
 * - Customer authentication enforced by backend HttpOnly cookie.
 * - restaurantId must be a valid UUID; rejects missing or invalid restaurant IDs immediately.
 * - Strict schema conformance; returns only server-authoritative balance, tier, and transactions.
 * - Does not invent points, tiers, rewards, or fake transactions.
 * - Never silently falls back to mock fixtures in production.
 */

import { apiClient, ApiClientError } from './apiClient.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export interface LoyaltyTransaction {
  id: string;
  transactionType: string;
  stars: number;
  description: string | null;
  createdAt: string;
}

export interface CustomerLoyaltySummary {
  accountId: string;
  customerId: string;
  restaurantId: string;
  programName: string;
  starsBalance: number;
  lifetimeStarsEarned: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
  recentTransactions: LoyaltyTransaction[];
}

/**
 * Retrieves the customer's authoritative loyalty account summary for a specific restaurant.
 * GET /api/v1/customer/loyalty?restaurantId=[uuid]
 */
export async function fetchCustomerLoyalty(
  restaurantId: string,
  signal?: AbortSignal
): Promise<CustomerLoyaltySummary> {
  const cleanRestaurantId = typeof restaurantId === 'string' ? restaurantId.trim() : '';

  if (!cleanRestaurantId || !isValidUuid(cleanRestaurantId)) {
    throw new ApiClientError(
      'Invalid restaurantId: must be a valid UUID.',
      400,
      'INVALID_RESTAURANT_ID'
    );
  }

  const result = await apiClient.get<CustomerLoyaltySummary>('/api/v1/customer/loyalty', {
    params: { restaurantId: cleanRestaurantId },
    signal,
  });

  if (
    !result ||
    typeof result.starsBalance !== 'number' ||
    !result.accountId ||
    !result.restaurantId ||
    !Array.isArray(result.recentTransactions)
  ) {
    throw new ApiClientError(
      'Malformed loyalty summary response received from server.',
      500,
      'MALFORMED_RESPONSE'
    );
  }

  return result;
}
