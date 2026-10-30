import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { customerMenuQuerySchema } from '@/lib/validation/order';
import { resolveQrContext } from '@/lib/qr/resolve';
import { successResponse } from '@/lib/http/response';
import { handleApiError, CatalogSizeLimitExceededError } from '@/lib/http/errors';
import { CATALOG_BOUNDS } from '@/lib/validation/menu';
import { resolveEffectiveVariantPrice } from '@/lib/menu/format';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQrToken = searchParams.get('qrToken') ?? '';
    const rawTableId = searchParams.get('tableId') || undefined;

    // Validate query parameter formats
    const validatedQuery = customerMenuQuerySchema.parse({
      qrToken: rawQrToken,
      tableId: rawTableId,
    });

    // Resolve and verify physical QR, table, branch, and restaurant context
    const context = await resolveQrContext(
      validatedQuery.qrToken,
      validatedQuery.tableId
    );

    // Retrieve active categories and eligible active+available products with variants & addons
    // We fetch (LIMIT + 1) to distinguish between a full menu and an oversized catalog that would be truncated.
    const categories = await prisma.categories.findMany({
      where: {
        restaurant_id: context.restaurant.id,
        is_active: true,
      },
      take: CATALOG_BOUNDS.MAX_CATEGORIES + 1,
      orderBy: {
        display_order: 'asc',
      },
      include: {
        products: {
          where: {
            restaurant_id: context.restaurant.id,
            is_active: true,
            is_available: true,
          },
          take: CATALOG_BOUNDS.MAX_PRODUCTS_PER_CATEGORY + 1,
          orderBy: {
            display_order: 'asc',
          },
          include: {
            product_variants: {
              where: {
                is_active: true,
                is_available: true,
              },
              take: CATALOG_BOUNDS.MAX_VARIANTS_PER_PRODUCT + 1,
              orderBy: {
                display_order: 'asc',
              },
            },
            product_addons: {
              where: {
                is_active: true,
                is_available: true,
              },
              take: CATALOG_BOUNDS.MAX_ADDONS_PER_PRODUCT + 1,
              orderBy: {
                display_order: 'asc',
              },
            },
          },
        },
      },
    });

    // Enforce completeness: fail safe rather than silently omitting items from an oversized catalog
    if (categories.length > CATALOG_BOUNDS.MAX_CATEGORIES) {
      throw new CatalogSizeLimitExceededError(
        'The restaurant menu catalog exceeds the maximum supported category limit and cannot be safely displayed.'
      );
    }

    for (const category of categories) {
      if (category.products.length > CATALOG_BOUNDS.MAX_PRODUCTS_PER_CATEGORY) {
        throw new CatalogSizeLimitExceededError(
          'The restaurant menu catalog exceeds the maximum supported products per category limit and cannot be safely displayed.'
        );
      }

      for (const product of category.products) {
        if (product.product_variants.length > CATALOG_BOUNDS.MAX_VARIANTS_PER_PRODUCT) {
          throw new CatalogSizeLimitExceededError(
            'The restaurant menu catalog exceeds the maximum supported variants per product limit and cannot be safely displayed.'
          );
        }

        if (product.product_addons.length > CATALOG_BOUNDS.MAX_ADDONS_PER_PRODUCT) {
          throw new CatalogSizeLimitExceededError(
            'The restaurant menu catalog exceeds the maximum supported add-ons per product limit and cannot be safely displayed.'
          );
        }
      }
    }

    const publicCategories = categories
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description ?? null,
        displayOrder: cat.display_order,
        products: cat.products.map((p) => {
          const numericPrice = typeof p.price === 'number' ? p.price : Number(p.price);
          return {
            id: p.id,
            name: p.name,
            description: p.description ?? null,
            price: numericPrice,
            priceFormatted: numericPrice.toFixed(2),
            imageUrl: p.image_url ?? null,
            displayOrder: p.display_order,
            variants: p.product_variants.map((v) => {
              const vPrice = resolveEffectiveVariantPrice(v.price, numericPrice);
              return {
                id: v.id,
                name: v.name,
                price: vPrice,
                priceFormatted: vPrice.toFixed(2),
                displayOrder: v.display_order,
              };
            }),
            addons: p.product_addons.map((a) => {
              const aPrice = typeof a.price === 'number' ? a.price : Number(a.price);
              return {
                id: a.id,
                name: a.name,
                price: aPrice,
                priceFormatted: aPrice.toFixed(2),
                displayOrder: a.display_order,
              };
            }),
          };
        }),
      }))
      .filter((cat) => cat.products.length > 0 || cat.displayOrder >= 0);

    return successResponse({
      restaurant: {
        id: context.restaurant.id,
        name: context.restaurant.name,
      },
      branch: {
        id: context.branch.id,
        name: context.branch.name,
        timezone: context.branch.timezone,
      },
      table: {
        id: context.table.id,
        tableNumber: context.table.table_number,
        capacity: context.table.capacity,
        status: context.table.status,
      },
      categories: publicCategories,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
