import { apiClient } from './apiClient';

export type EarningMode = 'visit_and_review' | 'review_only' | 'visit_only';

export interface LoyaltyRuleSummary {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  earningMode: EarningMode | string;
  starsPerVisit: number;
  starsPerReview: number;
  redemptionRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerLoyaltyRulesResponse {
  restaurantId: string;
  restaurantName: string;
  loyaltyProgram: LoyaltyRuleSummary;
}

export interface UpdateLoyaltyRulesInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  earningMode?: EarningMode;
  starsPerVisit?: number;
  starsPerReview?: number;
  redemptionRate?: number;
}

export interface GetLoyaltyRulesOptions {
  restaurantId?: string;
  signal?: AbortSignal;
}

export interface UpdateLoyaltyRulesOptions {
  restaurantId?: string;
  signal?: AbortSignal;
}

export interface OwnerLoyaltyAccountItem {
  id: string;
  customerId: string;
  customerName: string;
  starsBalance: number;
  lifetimeStarsEarned: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerLoyaltyAccountsSummary {
  totalEnrolledAccounts: number;
  activeAccounts: number;
  totalPointsInCirculation: number;
  totalLifetimePointsEarned: number;
  totalLifetimePointsRedeemed: number;
}

export interface LoyaltyPaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface OwnerLoyaltyAccountsResponse {
  restaurantId: string;
  summary: OwnerLoyaltyAccountsSummary;
  accounts: OwnerLoyaltyAccountItem[];
  pagination: LoyaltyPaginationInfo;
}

export interface OwnerLoyaltyTransactionItem {
  id: string;
  transactionType: string;
  stars: number;
  description: string | null;
  orderId: string | null;
  orderNumber: string | null;
  feedbackId: string | null;
  createdAt: string;
}

export interface OwnerLoyaltyAccountDetail {
  id: string;
  customerId: string;
  customerName: string;
  restaurantId: string;
  loyaltyProgramId: string;
  programName: string;
  starsBalance: number;
  lifetimeStarsEarned: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerLoyaltyAccountDetailResponse {
  restaurantId: string;
  account: OwnerLoyaltyAccountDetail;
  transactions: OwnerLoyaltyTransactionItem[];
  pagination: LoyaltyPaginationInfo;
}

export interface GetLoyaltyAccountsOptions {
  restaurantId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  signal?: AbortSignal;
}

export interface GetLoyaltyAccountDetailOptions {
  restaurantId?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

export const loyaltyService = {
  /**
   * Fetches the current loyalty program rules for an authorized restaurant.
   * Server-side tenancy verifies ownership and resolves primary restaurant if restaurantId is omitted.
   */
  getLoyaltyRules: async (options?: GetLoyaltyRulesOptions): Promise<OwnerLoyaltyRulesResponse> => {
    const qs = options?.restaurantId
      ? `?restaurantId=${encodeURIComponent(options.restaurantId)}`
      : '';
    return apiClient.get<OwnerLoyaltyRulesResponse>(`/api/v1/owner/loyalty/rules${qs}`, {
      signal: options?.signal,
    });
  },

  /**
   * Updates loyalty program rules for an authorized restaurant.
   * Validated server-side against updateLoyaltyRulesSchema.
   */
  updateLoyaltyRules: async (
    data: UpdateLoyaltyRulesInput,
    options?: UpdateLoyaltyRulesOptions
  ): Promise<OwnerLoyaltyRulesResponse> => {
    const qs = options?.restaurantId
      ? `?restaurantId=${encodeURIComponent(options.restaurantId)}`
      : '';
    return apiClient.put<OwnerLoyaltyRulesResponse>(
      `/api/v1/owner/loyalty/rules${qs}`,
      data,
      { signal: options?.signal }
    );
  },

  /**
   * Fetches the paginated list of enrolled customer loyalty accounts and summary KPIs.
   * Scoped to authorized restaurant.
   */
  getLoyaltyAccounts: async (
    options?: GetLoyaltyAccountsOptions
  ): Promise<OwnerLoyaltyAccountsResponse> => {
    const params = new URLSearchParams();
    if (options?.restaurantId) params.append('restaurantId', options.restaurantId);
    if (options?.page !== undefined) params.append('page', String(options.page));
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.search) params.append('search', options.search.trim());
    if (options?.status && options.status !== 'all') params.append('status', options.status.trim());

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<OwnerLoyaltyAccountsResponse>(
      `/api/v1/owner/loyalty/accounts${qs}`,
      { signal: options?.signal }
    );
  },

  /**
   * Fetches an individual customer loyalty account profile and transaction ledger.
   * Scoped to authorized restaurant.
   */
  getLoyaltyAccountDetail: async (
    accountId: string,
    options?: GetLoyaltyAccountDetailOptions
  ): Promise<OwnerLoyaltyAccountDetailResponse> => {
    const cleanId = encodeURIComponent(accountId.trim());
    const params = new URLSearchParams();
    if (options?.restaurantId) params.append('restaurantId', options.restaurantId);
    if (options?.page !== undefined) params.append('page', String(options.page));
    if (options?.limit !== undefined) params.append('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<OwnerLoyaltyAccountDetailResponse>(
      `/api/v1/owner/loyalty/accounts/${cleanId}${qs}`,
      { signal: options?.signal }
    );
  },
};
