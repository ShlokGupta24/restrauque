import { apiClient } from './apiClient';

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

export interface MenuSummaryResponse {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  availableProducts: number;
  unavailableProducts: number;
}

export interface CategoryListResponse {
  categories: SafeCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
  };
}

export interface ProductListResponse {
  products: SafeProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    availableProducts: number;
    unavailableProducts: number;
  };
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateProductInput {
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface UpdateProductInput {
  categoryId?: string;
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface ProductImageUploadResponse {
  secureUrl: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface CreateVariantInput {
  name: string;
  price: number;
  displayOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface UpdateVariantInput {
  name?: string;
  price?: number;
  displayOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface CreateAddonInput {
  name: string;
  price?: number;
  displayOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface UpdateAddonInput {
  name?: string;
  price?: number;
  displayOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface DeleteOperationResult {
  deleted: boolean;
  archived: boolean;
  message: string;
  category?: SafeCategory;
  product?: SafeProduct;
  variant?: SafeProductVariant;
  addon?: SafeProductAddon;
}

export const menuService = {
  // Menu Summary
  getMenuSummary: async (): Promise<MenuSummaryResponse> => {
    return apiClient.get<MenuSummaryResponse>('/api/v1/owner/menu/summary');
  },

  // Categories
  getCategories: async (params?: {
    isActive?: boolean | string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<CategoryListResponse> => {
    const query = new URLSearchParams();
    if (params?.isActive !== undefined && params.isActive !== 'all') {
      query.append('isActive', String(params.isActive));
    }
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<CategoryListResponse>(`/api/v1/owner/menu/categories${qs}`);
  },

  getCategory: async (categoryId: string): Promise<{ category: SafeCategory }> => {
    return apiClient.get<{ category: SafeCategory }>(
      `/api/v1/owner/menu/categories/${encodeURIComponent(categoryId)}`
    );
  },

  createCategory: async (data: CreateCategoryInput): Promise<{ category: SafeCategory }> => {
    return apiClient.post<{ category: SafeCategory }>('/api/v1/owner/menu/categories', data);
  },

  updateCategory: async (
    categoryId: string,
    data: UpdateCategoryInput
  ): Promise<{ category: SafeCategory }> => {
    return apiClient.patch<{ category: SafeCategory }>(
      `/api/v1/owner/menu/categories/${encodeURIComponent(categoryId)}`,
      data
    );
  },

  deleteCategory: async (categoryId: string): Promise<DeleteOperationResult> => {
    return apiClient.delete<DeleteOperationResult>(
      `/api/v1/owner/menu/categories/${encodeURIComponent(categoryId)}`
    );
  },

  // Products
  getProducts: async (params?: {
    categoryId?: string;
    isActive?: boolean | string;
    isAvailable?: boolean | string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<ProductListResponse> => {
    const query = new URLSearchParams();
    if (params?.categoryId && params.categoryId !== 'all') {
      query.append('categoryId', params.categoryId);
    }
    if (params?.isActive !== undefined && params.isActive !== 'all') {
      query.append('isActive', String(params.isActive));
    }
    if (params?.isAvailable !== undefined && params.isAvailable !== 'all') {
      query.append('isAvailable', String(params.isAvailable));
    }
    if (params?.search) query.append('search', params.search);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.sortOrder) query.append('sortOrder', params.sortOrder);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<ProductListResponse>(`/api/v1/owner/menu/products${qs}`);
  },

  getProduct: async (productId: string): Promise<{ product: SafeProduct }> => {
    return apiClient.get<{ product: SafeProduct }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}`
    );
  },

  createProduct: async (data: CreateProductInput): Promise<{ product: SafeProduct }> => {
    return apiClient.post<{ product: SafeProduct }>('/api/v1/owner/menu/products', data);
  },

  updateProduct: async (
    productId: string,
    data: UpdateProductInput
  ): Promise<{ product: SafeProduct }> => {
    return apiClient.patch<{ product: SafeProduct }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}`,
      data
    );
  },

  deleteProduct: async (productId: string): Promise<DeleteOperationResult> => {
    return apiClient.delete<DeleteOperationResult>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}`
    );
  },

  uploadProductImage: async (file: File): Promise<ProductImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<ProductImageUploadResponse>(
      '/api/v1/owner/menu/products/upload',
      formData
    );
  },

  // Variants
  getVariants: async (productId: string): Promise<{ variants: SafeProductVariant[] }> => {
    return apiClient.get<{ variants: SafeProductVariant[] }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/variants`
    );
  },

  createVariant: async (
    productId: string,
    data: CreateVariantInput
  ): Promise<{ variant: SafeProductVariant }> => {
    return apiClient.post<{ variant: SafeProductVariant }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/variants`,
      data
    );
  },

  updateVariant: async (
    productId: string,
    variantId: string,
    data: UpdateVariantInput
  ): Promise<{ variant: SafeProductVariant }> => {
    return apiClient.patch<{ variant: SafeProductVariant }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(
        variantId
      )}`,
      data
    );
  },

  deleteVariant: async (
    productId: string,
    variantId: string
  ): Promise<DeleteOperationResult> => {
    return apiClient.delete<DeleteOperationResult>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(
        variantId
      )}`
    );
  },

  // Add-ons
  getAddons: async (productId: string): Promise<{ addons: SafeProductAddon[] }> => {
    return apiClient.get<{ addons: SafeProductAddon[] }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/addons`
    );
  },

  createAddon: async (
    productId: string,
    data: CreateAddonInput
  ): Promise<{ addon: SafeProductAddon }> => {
    return apiClient.post<{ addon: SafeProductAddon }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/addons`,
      data
    );
  },

  updateAddon: async (
    productId: string,
    addonId: string,
    data: UpdateAddonInput
  ): Promise<{ addon: SafeProductAddon }> => {
    return apiClient.patch<{ addon: SafeProductAddon }>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/addons/${encodeURIComponent(
        addonId
      )}`,
      data
    );
  },

  deleteAddon: async (
    productId: string,
    addonId: string
  ): Promise<DeleteOperationResult> => {
    return apiClient.delete<DeleteOperationResult>(
      `/api/v1/owner/menu/products/${encodeURIComponent(productId)}/addons/${encodeURIComponent(
        addonId
      )}`
    );
  },
};
