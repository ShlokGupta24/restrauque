/**
 * Restrauque Customer Order Service
 * Manages order creation, idempotent submissions, order details, and order history.
 *
 * Backend endpoints:
 * - POST /api/v1/customer/orders
 * - GET  /api/v1/customer/orders/[orderId]
 * - GET  /api/v1/customer/orders
 */
import { apiClient, ApiClientError } from './apiClient.ts';
import { isValidQrTokenFormat } from './qrService.ts';
import { isValidUuid } from './orderPreviewService.ts';
import type { OrderPreviewItemInput } from './orderPreviewService.ts';

// ----------------------------------------------------------------------------
// Types matching backend createOrderSchema & formatCustomerOrder
// ----------------------------------------------------------------------------

export interface CreateOrderRequest {
  qrToken: string;
  tableId?: string | null;
  idempotencyKey?: string | null;
  expectedTotal?: number | null;
  items: OrderPreviewItemInput[];
  couponCode?: string | null;
  notes?: string | null;
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

export interface CustomerOrderItem {
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

export interface CustomerOrderPricing {
  subtotal: number;
  subtotalFormatted: string;
  discountAmount: number;
  discountAmountFormatted: string;
  taxAmount: number;
  taxAmountFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
  currency: string;
}

export interface CustomerOrderStatusHistory {
  status: string;
  notes: string | null;
  changedAt: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
  orderType: string;
  table: {
    id: string;
    tableNumber?: string;
  } | null;
  branchName?: string;
  restaurantName?: string;
  pricing: CustomerOrderPricing;
  notes: string | null;
  orderedAt: string;
  completedAt: string | null;
  items: CustomerOrderItem[];
  statusHistory: CustomerOrderStatusHistory[];
}

export interface CustomerOrderHistorySummaryItem {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  totalPriceFormatted: string;
}

export interface CustomerOrderHistoryItem {
  id: string;
  orderNumber: string;
  status: 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
  orderType: string;
  restaurant: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  table: { id: string; tableNumber: string } | null;
  pricing: CustomerOrderPricing;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
  itemCount: number;
  itemsSummary: CustomerOrderHistorySummaryItem[];
  orderedAt: string;
  completedAt: string | null;
  hasFeedback: boolean;
}

export interface CustomerOrdersPagination {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface CustomerOrdersStatusSummary {
  totalOrders: number;
  pending: number;
  preparing: number;
  served: number;
  completed: number;
  cancelled: number;
}

export interface CustomerOrdersResponse {
  orders: CustomerOrderHistoryItem[];
  pagination: CustomerOrdersPagination;
  summary: CustomerOrdersStatusSummary;
}

export interface CustomerOrdersQueryParams {
  limit?: number;
  cursor?: string;
  status?: 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
  dateFrom?: string;
  dateTo?: string;
}

// ----------------------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------------------

/**
 * Generates a RFC 4122 v4 UUID suitable for order submission idempotency.
 */
export function generateIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Recovers active order ID from query parameters or session storage across refreshes.
 */
export function extractStoredOrderId(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get('orderId') || params.get('order_id');
      if (fromParam && isValidUuid(fromParam.trim())) {
        return fromParam.trim();
      }
      const fromSession = sessionStorage.getItem('restrauque_active_order_id');
      if (fromSession && isValidUuid(fromSession.trim())) {
        return fromSession.trim();
      }
    }
  } catch {
    // SSR or storage restriction fallback
  }
  return null;
}

export interface PendingOrderAttempt {
  idempotencyKey: string;
  payload: CreateOrderRequest;
  userId?: string;
  restaurantId?: string;
  qrToken?: string;
  createdAt?: number;
}

/**
 * Persists an in-flight order attempt bound to the active customer and venue context.
 */
export function storePendingOrderAttempt(attempt: PendingOrderAttempt): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('restrauque_pending_order_attempt', JSON.stringify(attempt));
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves a pending in-flight order attempt only if it matches the current customer and venue context.
 * Discards and purges the attempt if it belongs to a different customer or venue.
 */
export function getPendingOrderAttempt(context: {
  userId?: string;
  qrToken?: string;
  restaurantId?: string;
}): { idempotencyKey: string; payload: CreateOrderRequest } | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = sessionStorage.getItem('restrauque_pending_order_attempt');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.idempotencyKey || !parsed.payload) return null;

    // Strict customer session binding
    if (parsed.userId && context.userId && parsed.userId !== context.userId) {
      sessionStorage.removeItem('restrauque_pending_order_attempt');
      return null;
    }
    // Strict QR venue context binding
    if (parsed.qrToken && context.qrToken && parsed.qrToken !== context.qrToken) {
      sessionStorage.removeItem('restrauque_pending_order_attempt');
      return null;
    }
    // Strict restaurant context binding
    if (parsed.restaurantId && context.restaurantId && parsed.restaurantId !== context.restaurantId) {
      sessionStorage.removeItem('restrauque_pending_order_attempt');
      return null;
    }

    return { idempotencyKey: parsed.idempotencyKey, payload: parsed.payload };
  } catch {
    return null;
  }
}

/**
 * Clears the stored pending order attempt upon verified success or confirmed rejection.
 */
export function clearPendingOrderAttempt(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('restrauque_pending_order_attempt');
    }
  } catch {
    // ignore
  }
}

/**
 * Normalizes backend formatCustomerOrder output into CustomerOrder.
 */
export function normalizeCustomerOrder(data: any): CustomerOrder {
  if (!data || !data.id || !data.orderNumber) {
    throw new ApiClientError(
      'Malformed order payload received from server.',
      500,
      'INVALID_ORDER_PAYLOAD'
    );
  }

  const pricing = data.pricing || {};

  return {
    id: data.id,
    orderNumber: data.orderNumber,
    status: data.status,
    orderType: data.orderType || 'dine_in',
    table: data.table
      ? {
          id: data.table.id,
          tableNumber: data.table.tableNumber || '',
        }
      : null,
    branchName: data.branchName || '',
    restaurantName: data.restaurantName || '',
    pricing: {
      subtotal: Number(pricing.subtotal) || 0,
      subtotalFormatted: pricing.subtotalFormatted || (Number(pricing.subtotal) || 0).toFixed(2),
      discountAmount: Number(pricing.discountAmount) || 0,
      discountAmountFormatted: pricing.discountAmountFormatted || (Number(pricing.discountAmount) || 0).toFixed(2),
      taxAmount: Number(pricing.taxAmount) || 0,
      taxAmountFormatted: pricing.taxAmountFormatted || (Number(pricing.taxAmount) || 0).toFixed(2),
      totalAmount: Number(pricing.totalAmount) || 0,
      totalAmountFormatted: pricing.totalAmountFormatted || (Number(pricing.totalAmount) || 0).toFixed(2),
      currency: pricing.currency || 'INR',
    },
    notes: data.notes || null,
    orderedAt: data.orderedAt,
    completedAt: data.completedAt || null,
    items: Array.isArray(data.items)
      ? data.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          variantId: it.variantId || null,
          variantName: it.variantName || null,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice) || 0,
          unitPriceFormatted: it.unitPriceFormatted || (Number(it.unitPrice) || 0).toFixed(2),
          totalPrice: Number(it.totalPrice) || 0,
          totalPriceFormatted: it.totalPriceFormatted || (Number(it.totalPrice) || 0).toFixed(2),
          specialInstructions: it.specialInstructions || null,
          addons: Array.isArray(it.addons)
            ? it.addons.map((a: any) => ({
                id: a.id,
                productAddonId: a.productAddonId || null,
                addonName: a.addonName,
                quantity: a.quantity,
                unitPrice: Number(a.unitPrice) || 0,
                unitPriceFormatted: a.unitPriceFormatted || (Number(a.unitPrice) || 0).toFixed(2),
                totalPrice: Number(a.totalPrice) || 0,
                totalPriceFormatted: a.totalPriceFormatted || (Number(a.totalPrice) || 0).toFixed(2),
              }))
            : [],
        }))
      : [],
    statusHistory: Array.isArray(data.statusHistory)
      ? data.statusHistory.map((h: any) => ({
          status: h.status,
          notes: h.notes || null,
          changedAt: h.changedAt,
        }))
      : [],
  };
}

/**
 * Normalizes backend GET /api/v1/customer/orders response into CustomerOrdersResponse.
 */
export function normalizeCustomerOrdersResponse(data: any): CustomerOrdersResponse {
  if (!data || !Array.isArray(data.orders)) {
    throw new ApiClientError(
      'Malformed orders list received from server.',
      500,
      'INVALID_ORDERS_RESPONSE'
    );
  }

  const orders: CustomerOrderHistoryItem[] = data.orders.map((ord: any) => {
    const pricing = ord.pricing || {};
    return {
      id: ord.id,
      orderNumber: ord.orderNumber,
      status: ord.status,
      orderType: ord.orderType || 'dine_in',
      restaurant: ord.restaurant ? { id: ord.restaurant.id, name: ord.restaurant.name } : null,
      branch: ord.branch ? { id: ord.branch.id, name: ord.branch.name } : null,
      table: ord.table ? { id: ord.table.id, tableNumber: ord.table.tableNumber } : null,
      pricing: {
        subtotal: Number(pricing.subtotal) || 0,
        subtotalFormatted: pricing.subtotalFormatted || (Number(pricing.subtotal) || 0).toFixed(2),
        discountAmount: Number(pricing.discountAmount) || 0,
        discountAmountFormatted: pricing.discountAmountFormatted || (Number(pricing.discountAmount) || 0).toFixed(2),
        taxAmount: Number(pricing.taxAmount) || 0,
        taxAmountFormatted: pricing.taxAmountFormatted || (Number(pricing.taxAmount) || 0).toFixed(2),
        totalAmount: Number(pricing.totalAmount) || 0,
        totalAmountFormatted: pricing.totalAmountFormatted || (Number(pricing.totalAmount) || 0).toFixed(2),
        currency: pricing.currency || 'INR',
      },
      paymentStatus: ord.paymentStatus || 'unpaid',
      itemCount: ord.itemCount || 0,
      itemsSummary: Array.isArray(ord.itemsSummary)
        ? ord.itemsSummary.map((it: any) => ({
            id: it.id,
            productName: it.productName,
            quantity: it.quantity,
            totalPrice: Number(it.totalPrice) || 0,
            totalPriceFormatted: it.totalPriceFormatted || (Number(it.totalPrice) || 0).toFixed(2),
          }))
        : [],
      orderedAt: ord.orderedAt,
      completedAt: ord.completedAt || null,
      hasFeedback: Boolean(ord.hasFeedback),
    };
  });

  return {
    orders,
    pagination: {
      limit: data.pagination?.limit ?? 10,
      hasNextPage: Boolean(data.pagination?.hasNextPage),
      nextCursor: data.pagination?.nextCursor || null,
    },
    summary: {
      totalOrders: Number(data.summary?.totalOrders) || orders.length,
      pending: Number(data.summary?.pending) || 0,
      preparing: Number(data.summary?.preparing) || 0,
      served: Number(data.summary?.served) || 0,
      completed: Number(data.summary?.completed) || 0,
      cancelled: Number(data.summary?.cancelled) || 0,
    },
  };
}

// ----------------------------------------------------------------------------
// API Service Methods
// ----------------------------------------------------------------------------

/**
 * Submits an order creation request to POST /api/v1/customer/orders.
 * Enforces strict client-side validation and idempotency key safety.
 */
export async function submitOrder(
  request: CreateOrderRequest,
  signal?: AbortSignal
): Promise<CustomerOrder> {
  const trimmedToken = request.qrToken ? request.qrToken.trim() : '';
  if (!trimmedToken) {
    throw new ApiClientError('QR token is required to submit an order.', 400, 'MISSING_QR_TOKEN');
  }

  if (!isValidQrTokenFormat(trimmedToken)) {
    throw new ApiClientError('Invalid QR token format.', 400, 'INVALID_QR_TOKEN');
  }

  if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
    throw new ApiClientError('Order must contain at least one item.', 400, 'EMPTY_CART');
  }

  if (request.items.length > 50) {
    throw new ApiClientError('Order cannot exceed 50 items.', 400, 'EXCEEDS_MAX_ITEMS');
  }

  // Validate items strictly against backend orderItemInputSchema
  for (const it of request.items) {
    if (!it.productId || !isValidUuid(it.productId)) {
      throw new ApiClientError(
        `Cannot place order: Item ID "${it.productId}" is not a valid catalog identifier.`,
        400,
        'INVALID_PRODUCT_ID'
      );
    }
    if (it.variantId && !isValidUuid(it.variantId)) {
      throw new ApiClientError(
        `Cannot place order: Variant ID "${it.variantId}" is not a valid identifier.`,
        400,
        'INVALID_VARIANT_ID'
      );
    }
    if (it.addonIds && Array.isArray(it.addonIds)) {
      if (it.addonIds.length > 10) {
        throw new ApiClientError('Cannot select more than 10 add-ons per item.', 400, 'EXCEEDS_MAX_ADDONS');
      }
      for (const addonId of it.addonIds) {
        if (!isValidUuid(addonId)) {
          throw new ApiClientError(
            `Cannot place order: Add-on ID "${addonId}" is not a valid identifier.`,
            400,
            'INVALID_ADDON_ID'
          );
        }
      }
    }
    if (typeof it.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99) {
      throw new ApiClientError('Item quantity must be an integer between 1 and 99.', 400, 'INVALID_QUANTITY');
    }
    if (it.specialInstructions && it.specialInstructions.length > 255) {
      throw new ApiClientError('Special instructions cannot exceed 255 characters.', 400, 'SPECIAL_INSTRUCTIONS_TOO_LONG');
    }
  }

  // Construct strict payload matching backend createOrderSchema.strict()
  const payload: Record<string, unknown> = {
    qrToken: trimmedToken,
    items: request.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || null,
      addonIds: it.addonIds || [],
      quantity: it.quantity,
      specialInstructions: it.specialInstructions || null,
    })),
  };

  if (request.tableId) {
    const trimmedTableId = request.tableId.trim();
    if (!isValidUuid(trimmedTableId)) {
      throw new ApiClientError(
        `Cannot place order: Table ID "${request.tableId}" is not a valid UUID identifier.`,
        400,
        'INVALID_TABLE_ID'
      );
    }
    payload.tableId = trimmedTableId;
  }
  // Every order-creation request includes an idempotency key even though backend schema makes it optional
  const idempotencyKey = (request.idempotencyKey && request.idempotencyKey.trim())
    ? request.idempotencyKey.trim()
    : generateIdempotencyKey();

  if (idempotencyKey.length > 100) {
    throw new ApiClientError('Idempotency key cannot exceed 100 characters.', 400, 'INVALID_IDEMPOTENCY_KEY');
  }
  payload.idempotencyKey = idempotencyKey;

  if (request.expectedTotal !== undefined && request.expectedTotal !== null) {
    if (typeof request.expectedTotal !== 'number' || isNaN(request.expectedTotal) || request.expectedTotal < 0) {
      throw new ApiClientError('Expected total must be a non-negative number.', 400, 'INVALID_EXPECTED_TOTAL');
    }
    payload.expectedTotal = request.expectedTotal;
  }

  if (request.couponCode && request.couponCode.trim()) {
    const trimmedCoupon = request.couponCode.trim();
    if (trimmedCoupon.length > 50) {
      throw new ApiClientError('Coupon code cannot exceed 50 characters.', 400, 'INVALID_COUPON_CODE');
    }
    payload.couponCode = trimmedCoupon;
  }

  if (request.notes && request.notes.trim()) {
    const trimmedNotes = request.notes.trim();
    if (trimmedNotes.length > 500) {
      throw new ApiClientError('Notes cannot exceed 500 characters.', 400, 'NOTES_TOO_LONG');
    }
    payload.notes = trimmedNotes;
  }

  const responseData = await apiClient.post<any>(
    '/api/v1/customer/orders',
    payload,
    { signal }
  );

  return normalizeCustomerOrder(responseData);
}

/**
 * Fetches single order details from GET /api/v1/customer/orders/[orderId].
 */
export async function fetchOrderById(
  orderId: string,
  signal?: AbortSignal
): Promise<CustomerOrder> {
  const trimmed = orderId ? orderId.trim() : '';
  if (!trimmed || !isValidUuid(trimmed)) {
    throw new ApiClientError('Valid order UUID is required.', 400, 'INVALID_ORDER_ID');
  }

  const responseData = await apiClient.get<any>(
    `/api/v1/customer/orders/${encodeURIComponent(trimmed)}`,
    { signal }
  );

  return normalizeCustomerOrder(responseData);
}

/**
 * Fetches paginated customer orders history from GET /api/v1/customer/orders.
 */
export async function fetchCustomerOrders(
  params?: CustomerOrdersQueryParams,
  signal?: AbortSignal
): Promise<CustomerOrdersResponse> {
  const queryParams: Record<string, string | number | boolean | undefined | null> = {};

  if (params?.limit) queryParams.limit = params.limit;
  if (params?.cursor) queryParams.cursor = params.cursor;
  if (params?.status) queryParams.status = params.status;
  if (params?.dateFrom) queryParams.dateFrom = params.dateFrom;
  if (params?.dateTo) queryParams.dateTo = params.dateTo;

  const responseData = await apiClient.get<any>(
    '/api/v1/customer/orders',
    { params: queryParams, signal }
  );

  return normalizeCustomerOrdersResponse(responseData);
}
