import { SafeCategory, SafeProduct, SafeProductVariant, SafeProductAddon } from '@/types/menu';

export function formatCategory(c: any, productCount?: number): SafeCategory {
  return {
    id: c.id,
    restaurantId: c.restaurant_id,
    name: c.name,
    description: c.description ?? null,
    displayOrder: c.display_order ?? 0,
    isActive: c.is_active,
    ...(typeof productCount === 'number'
      ? { productCount }
      : c._count?.products !== undefined
      ? { productCount: c._count.products }
      : {}),
    createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
    updatedAt: c.updated_at instanceof Date ? c.updated_at.toISOString() : c.updated_at,
  };
}

/**
 * Authoritative single helper to resolve effective variant price.
 * Follows the legacy data policy: if variant price is 0 on a paid product (parent price > 0),
 * it authoritatively falls back to the parent product's base price.
 * For genuinely free products (parent price === 0) or positive variant prices,
 * the variant's own price is preserved.
 */
export function resolveEffectiveVariantPrice(
  rawVariantPrice: number | string | { toString(): string } | null | undefined,
  parentProductPrice?: number | string | { toString(): string } | null | undefined
): number {
  const numericVarPrice =
    typeof rawVariantPrice === 'number'
      ? rawVariantPrice
      : rawVariantPrice !== null && rawVariantPrice !== undefined
      ? Number(rawVariantPrice)
      : NaN;

  const numericParentPrice =
    parentProductPrice !== undefined && parentProductPrice !== null
      ? typeof parentProductPrice === 'number'
        ? parentProductPrice
        : Number(parentProductPrice)
      : undefined;

  if (numericVarPrice === 0 && numericParentPrice !== undefined && !isNaN(numericParentPrice) && numericParentPrice > 0) {
    return numericParentPrice;
  }
  return isNaN(numericVarPrice) ? 0 : numericVarPrice;
}

export function formatVariant(
  v: any,
  parentProductPrice?: number | string | { toString(): string } | null | undefined
): SafeProductVariant {
  const numericPrice = resolveEffectiveVariantPrice(v.price, parentProductPrice);
  return {
    id: v.id,
    productId: v.product_id,
    name: v.name,
    price: numericPrice,
    priceFormatted: numericPrice.toFixed(2),
    displayOrder: v.display_order ?? 0,
    isActive: v.is_active,
    isAvailable: v.is_available,
    createdAt: v.created_at instanceof Date ? v.created_at.toISOString() : v.created_at,
    updatedAt: v.updated_at instanceof Date ? v.updated_at.toISOString() : v.updated_at,
  };
}

export function formatAddon(a: any): SafeProductAddon {
  const numericPrice = typeof a.price === 'number' ? a.price : Number(a.price);
  return {
    id: a.id,
    productId: a.product_id,
    name: a.name,
    price: numericPrice,
    priceFormatted: numericPrice.toFixed(2),
    displayOrder: a.display_order ?? 0,
    isActive: a.is_active,
    isAvailable: a.is_available,
    createdAt: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at,
    updatedAt: a.updated_at instanceof Date ? a.updated_at.toISOString() : a.updated_at,
  };
}

export function formatProduct(p: any): SafeProduct {
  const numericPrice = typeof p.price === 'number' ? p.price : Number(p.price);
  return {
    id: p.id,
    restaurantId: p.restaurant_id,
    categoryId: p.category_id,
    ...(p.categories?.name ? { categoryName: p.categories.name } : {}),
    name: p.name,
    description: p.description ?? null,
    price: numericPrice,
    priceFormatted: numericPrice.toFixed(2),
    imageUrl: p.image_url ?? null,
    displayOrder: p.display_order ?? 0,
    isActive: p.is_active,
    isAvailable: p.is_available,
    ...(Array.isArray(p.product_variants)
      ? {
          variants: p.product_variants.map((v: any) => formatVariant(v, numericPrice)),
        }
      : {}),
    ...(Array.isArray(p.product_addons)
      ? { addons: p.product_addons.map(formatAddon) }
      : {}),
    createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
    updatedAt: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
  };
}
