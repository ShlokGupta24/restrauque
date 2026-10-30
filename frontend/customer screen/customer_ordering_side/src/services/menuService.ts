/**
 * Restrauque Customer Live Menu Service
 * Communicates with Next.js backend endpoint:
 * GET /api/v1/customer/menu?qrToken=...&tableId=...
 */
import { apiClient, ApiClientError } from './apiClient.ts';
import { isValidQrTokenFormat } from './qrService.ts';
import type { Category, Product, ProductVariant, ProductAddon } from './contracts/types.ts';

// ----------------------------------------------------------------------------
// Backend Response Schemas matching GET /api/v1/customer/menu
// ----------------------------------------------------------------------------

export interface BackendMenuVariant {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  displayOrder: number;
  isDefault?: boolean;
}

export interface BackendMenuAddon {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  displayOrder: number;
}

export interface BackendMenuProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  priceFormatted: string;
  imageUrl: string | null;
  displayOrder: number;
  variants: BackendMenuVariant[];
  addons: BackendMenuAddon[];
}

export interface BackendMenuCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  products: BackendMenuProduct[];
}

export interface BackendCustomerMenuData {
  restaurant: {
    id: string;
    name: string;
    currency?: string;
  };
  branch: {
    id: string;
    name: string;
    timezone?: string;
  } | null;
  table: {
    id: string;
    tableNumber?: string;
    capacity?: number;
    status?: string;
  } | null;
  categories: BackendMenuCategory[];
}

export interface NormalizedMenu {
  categories: Category[];
  products: Product[];
  restaurant: BackendCustomerMenuData['restaurant'];
  branch: BackendCustomerMenuData['branch'];
  table: BackendCustomerMenuData['table'];
  restaurantId: string;
  tableId: string;
  totalProductsCount: number;
}

/**
 * Normalizes backend customer menu payload into the frontend Category and Product models.
 */
export function normalizeCustomerMenu(data: BackendCustomerMenuData): NormalizedMenu {
  if (!data || !data.restaurant || !Array.isArray(data.categories)) {
    throw new ApiClientError(
      'Malformed menu response received from server.',
      500,
      'INVALID_MENU_PAYLOAD'
    );
  }

  const rawCategories = data.categories;
  const normalizedProducts: Product[] = [];

  // Sort categories by displayOrder
  const sortedRawCategories = [...rawCategories].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const normalizedCategories: Category[] = [
    // Prepend synthetic 'All' tab for filter navigation
    {
      id: 'cat-all',
      name: 'All Items',
      description: 'All dishes and beverages',
      displayOrder: -1,
    },
  ];

  for (const cat of sortedRawCategories) {
    normalizedCategories.push({
      id: cat.id,
      name: cat.name,
      description: cat.description || undefined,
      displayOrder: cat.displayOrder,
    });

    const rawProducts = Array.isArray(cat.products) ? cat.products : [];
    // Sort products by displayOrder
    const sortedProducts = [...rawProducts].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );

    for (const p of sortedProducts) {
      const rawBasePrice = typeof p.price === 'number' ? p.price : Number(p.price);
      const basePrice = !isNaN(rawBasePrice) && rawBasePrice >= 0 ? rawBasePrice : 0;

      const variants: ProductVariant[] = (Array.isArray(p.variants) ? p.variants : []).map(
        (v, idx) => {
          const rawVarPrice = typeof v.price === 'number' ? v.price : Number(v.price);
          // If variant price is 0 but product has a positive base price, the variant inherits the base price
          const varPrice =
            !isNaN(rawVarPrice) && rawVarPrice > 0
              ? rawVarPrice
              : rawVarPrice === 0 && basePrice > 0
              ? basePrice
              : !isNaN(rawVarPrice) && rawVarPrice >= 0
              ? rawVarPrice
              : basePrice;

          return {
            id: v.id,
            name: v.name,
            price: varPrice,
            // priceDelta is used by the customization stepper (variant price minus base price)
            priceDelta: varPrice - basePrice,
            isDefault: v.isDefault ?? idx === 0,
          };
        }
      );

      const addons: ProductAddon[] = (Array.isArray(p.addons) ? p.addons : []).map((a) => {
        const rawAddonPrice = typeof a.price === 'number' ? a.price : Number(a.price);
        const addonPrice = !isNaN(rawAddonPrice) && rawAddonPrice >= 0 ? rawAddonPrice : 0;
        return {
          id: a.id,
          name: a.name,
          price: addonPrice,
        };
      });

      normalizedProducts.push({
        id: p.id,
        categoryId: cat.id,
        name: p.name,
        description: p.description || '',
        price: basePrice,
        imageUrl: p.imageUrl || '',
        isAvailable: true, // Backend only returns active & available products
        variants,
        addons,
      });
    }
  }

  return {
    categories: normalizedCategories,
    products: normalizedProducts,
    restaurant: data.restaurant,
    branch: data.branch || null,
    table: data.table || null,
    restaurantId: data.restaurant.id,
    tableId: data.table?.id || '',
    totalProductsCount: normalizedProducts.length,
  };
}

/**
 * Fetches the live menu for the scanned QR table context.
 */
export async function fetchCustomerMenu(
  qrToken: string,
  tableId?: string | null,
  signal?: AbortSignal
): Promise<NormalizedMenu> {
  const trimmedToken = qrToken ? qrToken.trim() : '';
  if (!trimmedToken) {
    throw new ApiClientError(
      'QR token is required to load the restaurant menu.',
      400,
      'MISSING_QR_TOKEN'
    );
  }

  if (!isValidQrTokenFormat(trimmedToken)) {
    throw new ApiClientError(
      'Invalid QR token format.',
      400,
      'INVALID_QR_TOKEN'
    );
  }

  const params: Record<string, string> = {
    qrToken: trimmedToken,
  };

  if (tableId && tableId.trim()) {
    params.tableId = tableId.trim();
  }

  const data = await apiClient.get<BackendCustomerMenuData>(
    '/api/v1/customer/menu',
    { params, signal }
  );

  return normalizeCustomerMenu(data);
}
