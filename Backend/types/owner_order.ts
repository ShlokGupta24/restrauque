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
  status: string;
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
  status: string;
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
