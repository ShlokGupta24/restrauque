import { SafeCategory, SafeProduct } from '@/types/menu';

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
    createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
    updatedAt: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
  };
}
