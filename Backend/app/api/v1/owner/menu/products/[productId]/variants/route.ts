import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { createVariantSchema, CATALOG_BOUNDS } from '@/lib/validation/menu';
import { formatVariant } from '@/lib/menu/format';
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

    // Retrieve all variants (active and inactive) sorted deterministically
    const variants = await prisma.product_variants.findMany({
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
      variants: variants.map((v) => formatVariant(v, product.price)),
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
    const validatedData = createVariantSchema.parse(rawBody);

    if (validatedData.price === 0 && Number(product.price) > 0) {
      throw new ValidationError(
        `Variant price cannot be 0 for a paid product (Base price: ${Number(product.price)}). Please provide the full price for this variant.`
      );
    }

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          // Enforce active variant capacity limit per product with container-level row lock
          if (validatedData.isActive !== false) {
            if (typeof (tx as any).$executeRaw === 'function') {
              await (tx as any).$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
            }

            const activeVariantCount = await tx.product_variants.count({
              where: {
                product_id: productId,
                is_active: true,
              },
            });

            if (activeVariantCount >= CATALOG_BOUNDS.MAX_VARIANTS_PER_PRODUCT) {
              throw new ValidationError(
                `Variant limit reached. A product cannot have more than ${CATALOG_BOUNDS.MAX_VARIANTS_PER_PRODUCT} active variants.`
              );
            }
          }

          // Check for duplicate variant name within this product
          const existing = await tx.product_variants.findFirst({
            where: {
              product_id: productId,
              name: { equals: validatedData.name, mode: 'insensitive' },
            },
          });

          if (existing) {
            throw new ConflictError(
              `A variant named "${validatedData.name}" already exists for this product`
            );
          }

          return tx.product_variants.create({
            data: {
              product_id: productId,
              name: validatedData.name,
              price: new Prisma.Decimal(validatedData.price.toFixed(2)),
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
          variant: formatVariant(created, product.price),
        },
        201
      );
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A variant named "${validatedData.name}" already exists for this product`
        );
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
