export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  variants: ProductVariant[];
  addons: ProductAddon[];
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  products: Product[];
}

export interface RestaurantContext {
  id: string;
  name: string;
}

export interface BranchContext {
  id: string;
  name: string;
  timezone: string;
}

export interface TableContext {
  id: string;
  tableNumber: string;
  capacity: number;
  status: string;
}

export interface CartItem {
  id: string; // Unique combination key
  productId: string;
  productName: string;
  imageUrl: string | null;
  variantId?: string | null;
  variantName?: string | null;
  unitPrice: number;
  addons: { id: string; name: string; price: number }[];
  quantity: number;
  specialInstructions?: string;
  lineTotal: number;
}

export interface ServerPricingQuote {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
}

export type PreviewStatus = 'idle' | 'loading' | 'success' | 'auth_required' | 'error';

export interface ServerPreviewState {
  status: PreviewStatus;
  quote: ServerPricingQuote | null;
  errorMessage: string | null;
}

export interface CustomerUser {
  id: string;
  name: string | null;
  phone: string;
  role?: string;
}

export interface ConfirmedOrderItem {
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
  addons: {
    id: string;
    productAddonId: string | null;
    addonName: string;
    quantity: number;
    unitPrice: number;
    unitPriceFormatted: string;
    totalPrice: number;
    totalPriceFormatted: string;
  }[];
}

export interface ConfirmedOrder {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  table: {
    id?: string;
    tableNumber?: string;
  } | null;
  branchName?: string;
  restaurantName?: string;
  pricing: {
    subtotal: number;
    subtotalFormatted: string;
    discountAmount: number;
    discountAmountFormatted: string;
    taxAmount: number;
    taxAmountFormatted: string;
    totalAmount: number;
    totalAmountFormatted: string;
  };
  notes: string | null;
  orderedAt: string;
  completedAt: string | null;
  items: ConfirmedOrderItem[];
  statusHistory: {
    status: string;
    notes: string | null;
    changedAt: string;
  }[];
}

export type DineInViewMode = 'welcome' | 'menu' | 'cart' | 'checkout' | 'confirmation' | 'feedback';
