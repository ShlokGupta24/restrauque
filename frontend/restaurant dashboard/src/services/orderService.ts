import { apiClient } from './apiClient';

export type BackendOrderStatus = 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';
export type BackendPaymentStatusFilter = 'pending' | 'paid' | 'not_recorded';

export interface OwnerOrderPricing {
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

export interface OwnerOrderCustomer {
  id: string;
  name: string;
  phone: string;
}

export interface OwnerOrderTable {
  id: string;
  tableNumber: string;
  capacity?: number;
}

export interface OwnerOrderBranch {
  id: string;
  name: string;
}

export interface OwnerOrderPaymentSummary {
  status: 'pending' | 'paid' | 'not_recorded';
  paymentMethod: string | null;
  amount: number | null;
}

export interface OwnerOrderSummary {
  id: string;
  orderNumber: string;
  orderedAt: string;
  completedAt: string | null;
  orderType: string;
  status: BackendOrderStatus;
  pricing: OwnerOrderPricing;
  customer: OwnerOrderCustomer | null;
  table: OwnerOrderTable | null;
  branch: OwnerOrderBranch;
  payment: OwnerOrderPaymentSummary;
  itemsCount: number;
}

export interface OwnerOrderItemAddon {
  id: string;
  productAddonId: string | null;
  addonName: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
  totalPrice: number;
  totalPriceFormatted: string;
}

export interface OwnerOrderItem {
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
  addons: OwnerOrderItemAddon[];
}

export interface OwnerOrderCoupon {
  couponCode: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
}

export interface OwnerOrderPaymentDetail {
  id: string | null;
  status: 'pending' | 'paid' | 'not_recorded';
  paymentMethod: string | null;
  amount: number | null;
  transactionReference: string | null;
  paidAt: string | null;
}

export interface OwnerOrderStatusHistoryEntry {
  id: string;
  status: string;
  changedAt: string;
  notes: string | null;
}

export interface OwnerOrderDetail {
  id: string;
  orderNumber: string;
  orderType: string;
  status: BackendOrderStatus;
  orderedAt: string;
  completedAt: string | null;
  notes: string | null;
  branch: OwnerOrderBranch;
  table: OwnerOrderTable | null;
  customer: OwnerOrderCustomer | null;
  items: OwnerOrderItem[];
  pricing: OwnerOrderPricing;
  appliedCoupon: OwnerOrderCoupon | null;
  payment: OwnerOrderPaymentDetail;
  statusHistory: OwnerOrderStatusHistoryEntry[];
}

export interface OwnerOrdersPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface OwnerOrdersMetricsSummary {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  servedOrders: number;
}

export interface OwnerOrdersListResponse {
  orders: OwnerOrderSummary[];
  pagination: OwnerOrdersPagination;
  summary: OwnerOrdersMetricsSummary;
}

export interface UpdateOrderStatusInput {
  status: BackendOrderStatus;
  notes?: string | null;
  expectedCurrentStatus?: BackendOrderStatus;
}

export const ALLOWED_STATUS_TRANSITIONS: Record<BackendOrderStatus, BackendOrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

export const orderService = {
  getOrders: async (params?: {
    page?: number;
    limit?: number;
    branchId?: string;
    status?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<OwnerOrdersListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.paymentStatus && params.paymentStatus !== 'all') {
      query.append('paymentStatus', params.paymentStatus);
    }
    if (params?.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params?.dateTo) query.append('dateTo', params.dateTo);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<OwnerOrdersListResponse>(`/api/v1/owner/orders${qs}`);
  },

  getOrderDetail: async (orderId: string): Promise<OwnerOrderDetail> => {
    return apiClient.get<OwnerOrderDetail>(
      `/api/v1/owner/orders/${encodeURIComponent(orderId)}`
    );
  },

  updateOrderStatus: async (
    orderId: string,
    data: UpdateOrderStatusInput
  ): Promise<OwnerOrderSummary> => {
    return apiClient.patch<OwnerOrderSummary>(
      `/api/v1/owner/orders/${encodeURIComponent(orderId)}/status`,
      data
    );
  },
};
