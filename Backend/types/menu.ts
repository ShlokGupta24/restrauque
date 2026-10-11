export interface SafeCategory {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SafeProductVariant {
  id: string;
  productId: string;
  name: string;
  price: number;
  priceFormatted: string;
  displayOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafeProductAddon {
  id: string;
  productId: string;
  name: string;
  price: number;
  priceFormatted: string;
  displayOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafeProduct {
  id: string;
  restaurantId: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description: string | null;
  price: number;
  priceFormatted: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  isAvailable: boolean;
  variants?: SafeProductVariant[];
  addons?: SafeProductAddon[];
  createdAt: string;
  updatedAt: string;
}

export interface CategorySummaryCounts {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
}

export interface ProductSummaryCounts {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  availableProducts: number;
  unavailableProducts: number;
}

export interface MenuDashboardSummary extends CategorySummaryCounts, ProductSummaryCounts {}
