/**
 * Domain types matching Neon schema and UI/UX design specifications.
 * No internal database UUIDs or internal tables are exposed to the user.
 */

export interface RestaurantPublicInfo {
  id: string;
  name: string;
  branchName: string;
  tableLabel: string;
  tableId?: string;
  tableNumber?: string;
  tableStatus?: 'available' | 'occupied' | 'reserved' | 'maintenance';
  tableCapacity?: number;
  branchId?: string;
  timezone?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  iconUrl?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  priceDelta: number; // e.g. +20 for Large
  price?: number;
  isDefault?: boolean;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number; // e.g. +20 for Extra Shot
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  variants?: ProductVariant[];
  addons?: ProductAddon[];
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // unique cart row id (e.g. productId + variantId + addonsHash)
  productId: string;
  productName: string;
  imageUrl: string;
  basePrice: number;
  variant?: {
    id: string;
    name: string;
    priceDelta: number;
  };
  addons: SelectedAddon[];
  quantity: number;
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
}

export interface CustomerAuthSession {
  phone: string;
  customerName?: string;
  isAuthenticated: boolean;
  expiresAt?: number;
  userId?: string;
}

export interface BillBreakdown {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  appliedCoupon?: {
    code: string;
    discountValue: number;
  };
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';

export interface OrderConfirmationDetails {
  orderId: string;
  orderNumber: string; // e.g. #NBC1234
  restaurantName: string;
  tableLabel: string;
  orderedAt: string;
  status: OrderStatus;
  statusLabel: string;
  items: Array<{
    productId?: string;
    imageUrl?: string;
    name: string;
    quantity: number;
    price: number;
    variantName?: string;
  }>;
  bill: BillBreakdown;
  paymentMethod: string;
}

export interface FeedbackAspectPayload {
  aspect: string; // e.g. 'item_review' (max 50 chars in Neon schema)
  sentiment: 'positive' | 'negative' | 'neutral';
  aspect_value: string; // Customer written review text (max 100 chars in Neon schema)
}

export interface ItemFeedbackSubmission {
  productId: string;
  productName?: string;
  rating?: number; // 1 to 5 stars for each dish
  comment?: string;
}

export interface FeedbackSubmission {
  orderId: string;
  overallRating: number; // 1 to 5
  overallComment?: string;
  items?: ItemFeedbackSubmission[];
  aspects?: FeedbackAspectPayload[];
}

