export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  defaultBranchId: string;
  currency: string;
  currencySymbol: string;
  locale: string;
}

export interface Branch {
  id: string;
  restaurantId: string;
  name: string;
  city: string;
  area: string;
  isDefault: boolean;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'not_available';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addons?: { name: string; price: number }[];
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  orderType: string;
  orderedAt: string;
  completedAt?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: OrderItem[];
  appliedCouponCode?: string;
  appliedDiscountAmount?: number;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  variantsCount?: number;
  addonsCount?: number;
}

export type TableOperationalStatus = 'available' | 'reserved' | 'occupied' | 'cleaning';

export interface RestaurantTable {
  id: string;
  branchId: string;
  tableNumber: string;
  capacity: number;
  operationalStatus: TableOperationalStatus;
  isActive: boolean;
  qrActive: boolean;
  qrCodeUrl?: string;
  qrPayloadUrl?: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  usageCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface OverviewMetrics {
  totalRevenue: number;
  revenueChangePct: number;
  totalOrders: number;
  averageOrderValue: number;
  returningCustomers: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  averageRating: number;
  totalCustomersCount: number;
}

export interface DailyRevenueMetric {
  day: string;
  revenue: number;
}

export interface TopSellingProduct {
  name: string;
  unitsSold: number;
  isHighlight?: boolean;
}
