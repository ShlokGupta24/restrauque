import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { createAddonSchema, CATALOG_BOUNDS } from '@/lib/validation/menu';
import { formatAddon } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError, ValidationError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    validateUuid(productId, 'productId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // Verify parent product exists and belongs to the authenticated restaurant
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Retrieve all add-ons (active and inactive) sorted deterministically
    const addons = await prisma.product_addons.findMany({
      where: {
        product_id: productId,
      },
      orderBy: [
        { display_order: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });

    return successResponse({
      addons: addons.map(formatAddon),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    validateUuid(productId, 'productId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // Verify parent product exists and belongs to the authenticated restaurant
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const rawBody = await request.json();
    const validatedData = createAddonSchema.parse(rawBody);

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          // Enforce active add-on capacity limit per product with container-level row lock
          if (validatedData.isActive !== false) {
            if (typeof (tx as any).$executeRaw === 'function') {
              await (tx as any).$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
            }

            const activeAddonCount = await tx.product_addons.count({
              where: {
                product_id: productId,
                is_active: true,
              },
            });

            if (activeAddonCount >= CATALOG_BOUNDS.MAX_ADDONS_PER_PRODUCT) {
              throw new ValidationError(
                `Add-on limit reached. A product cannot have more than ${CATALOG_BOUNDS.MAX_ADDONS_PER_PRODUCT} active add-ons.`
              );
            }
          }

          // Check for duplicate add-on name within this product
          const existing = await tx.product_addons.findFirst({
            where: {
              product_id: productId,
              name: { equals: validatedData.name, mode: 'insensitive' },
            },
          });

          if (existing) {
            throw new ConflictError(
              `An add-on named "${validatedData.name}" already exists for this product`
            );
          }

          return tx.product_addons.create({
            data: {
              product_id: productId,
              name: validatedData.name,
              price: new Prisma.Decimal((validatedData.price ?? 0).toFixed(2)),
              display_order: validatedData.displayOrder ?? 0,
              is_available: validatedData.isAvailable ?? true,
              is_active: validatedData.isActive ?? true,
            },
          });
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 }
      );

      return successResponse(
        {
          addon: formatAddon(created),
        },
        201
      );
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `An add-on named "${validatedData.name}" already exists for this product`
        );
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
