/**
 * Restrauque Customer Dashboard Order Service
 * Communicates with Next.js backend API:
 *   - GET /api/v1/customer/orders
 *   - GET /api/v1/customer/orders/:orderId
 *
 * Uses typed apiClient with credentials: 'include' for HttpOnly session cookie authentication.
 * Never persists tokens in browser storage.
 */

import { apiClient, QueryParams } from './apiClient';

export type CustomerOrderStatus =
  | 'pending'
  | 'preparing'
  | 'served'
  | 'completed'
  | 'cancelled';

export type CustomerFeedbackFilterStatus = 'awaiting_review' | 'reviewed';

export interface CustomerOrdersQueryParams {
  limit?: number;
  cursor?: string;
  status?: CustomerOrderStatus;
  feedbackStatus?: CustomerFeedbackFilterStatus;
  restaurantId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CustomerOrderSummaryAggregate {
  totalOrders: number;
  pending: number;
  preparing: number;
  served: number;
  completed: number;
  cancelled: number;
}

export interface CustomerOrderPaginationMeta {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface CustomerOrderHistoryItemSummary {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  totalPriceFormatted: string;
}

export interface CustomerOrderPricingBreakdown {
  subtotal: number;
  subtotalFormatted: string;
  discountAmount: number;
  discountAmountFormatted: string;
  loyaltyDiscountAmount: number;
  loyaltyDiscountAmountFormatted: string;
  taxAmount: number;
  taxAmountFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
}

export interface CustomerOrderHistoryItem {
  id: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  orderType: string;
  restaurant: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  table: { id: string; tableNumber?: string } | null;
  pricing: CustomerOrderPricingBreakdown;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
  itemCount: number;
  itemsSummary: CustomerOrderHistoryItemSummary[];
  orderedAt: string;
  completedAt: string | null;
  hasFeedback: boolean;
}

export interface CustomerOrdersResponse {
  orders: CustomerOrderHistoryItem[];
  pagination: CustomerOrderPaginationMeta;
  summary: CustomerOrderSummaryAggregate;
}

export interface CustomerOrderItemAddon {
  id: string;
  productAddonId: string | null;
  addonName: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  totalPrice: number;
  totalPriceFormatted: string;
}

export interface CustomerOrderItemDetail {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  totalPrice: number;
  totalPriceFormatted: string;
  specialInstructions: string | null;
  addons: CustomerOrderItemAddon[];
}

export interface CustomerOrderStatusHistoryEntry {
  status: string;
  notes: string | null;
  changedAt: string;
}

export interface CustomerOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  table: { id: string; tableNumber?: string } | null;
  branchName?: string;
  restaurantName?: string;
  pricing: CustomerOrderPricingBreakdown;
  notes: string | null;
  orderedAt: string;
  completedAt: string | null;
  items: CustomerOrderItemDetail[];
  statusHistory: CustomerOrderStatusHistoryEntry[];
}

/**
 * Fetch a paginated list of orders for the authenticated customer.
 */
export async function fetchCustomerOrders(
  params?: CustomerOrdersQueryParams,
  signal?: AbortSignal
): Promise<CustomerOrdersResponse> {
  const queryParams: QueryParams = {};

  if (params) {
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.cursor) queryParams.cursor = params.cursor;
    if (params.status) queryParams.status = params.status;
    if (params.feedbackStatus) queryParams.feedbackStatus = params.feedbackStatus;
    if (params.restaurantId) queryParams.restaurantId = params.restaurantId;
    if (params.dateFrom) queryParams.dateFrom = params.dateFrom;
    if (params.dateTo) queryParams.dateTo = params.dateTo;
  }

  return await apiClient.get<CustomerOrdersResponse>('/api/v1/customer/orders', {
    params: queryParams,
    signal,
  });
}

/**
 * Fetch a single order detail by ID for the authenticated customer.
 * Enforces customer tenant isolation at backend level.
 */
export async function fetchCustomerOrderDetail(
  orderId: string,
  signal?: AbortSignal
): Promise<CustomerOrderDetail> {
  const cleanId = orderId.trim();
  return await apiClient.get<CustomerOrderDetail>(
    `/api/v1/customer/orders/${encodeURIComponent(cleanId)}`,
    { signal }
  );
}
