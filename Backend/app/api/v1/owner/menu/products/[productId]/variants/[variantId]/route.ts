import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateVariantSchema, CATALOG_BOUNDS } from '@/lib/validation/menu';
import { formatVariant } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError, ValidationError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  try {
    const { productId, variantId } = await params;
    validateUuid(productId, 'productId');
    validateUuid(variantId, 'variantId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // Verify parent product belongs to the authenticated restaurant
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify variant belongs to the specified product
    const variant = await prisma.product_variants.findFirst({
      where: {
        id: variantId,
        product_id: productId,
      },
    });

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }

    return successResponse({
      variant: formatVariant(variant, product.price),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  try {
    const { productId, variantId } = await params;
    validateUuid(productId, 'productId');
    validateUuid(variantId, 'variantId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // Verify parent product belongs to the authenticated restaurant
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify variant exists and belongs to the specified product
    const existingVariant = await prisma.product_variants.findFirst({
      where: {
        id: variantId,
        product_id: productId,
      },
    });

    if (!existingVariant) {
      throw new NotFoundError('Variant not found');
    }

    const rawBody = await request.json();
    const validatedData = updateVariantSchema.parse(rawBody);

    if (validatedData.price !== undefined && validatedData.price === 0 && Number(product.price) > 0) {
      throw new ValidationError(
        `Variant price cannot be 0 for a paid product (Base price: ${Number(product.price)}). Please provide the full price for this variant.`
      );
    }

    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          // If activating a previously inactive variant, check active variant capacity limit with container-level row lock
          if (validatedData.isActive === true && !existingVariant.is_active) {
            if (typeof (tx as any).$executeRaw === 'function') {
              await (tx as any).$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
            }

            const activeCount = await tx.product_variants.count({
              where: {
                product_id: productId,
                is_active: true,
              },
            });

            if (activeCount >= CATALOG_BOUNDS.MAX_VARIANTS_PER_PRODUCT) {
              throw new ValidationError(
                `Variant limit reached. A product cannot have more than ${CATALOG_BOUNDS.MAX_VARIANTS_PER_PRODUCT} active variants.`
              );
            }
          }

          // If changing name, verify uniqueness within this product
          if (
            validatedData.name &&
            validatedData.name.toLowerCase() !== existingVariant.name.toLowerCase()
          ) {
            const duplicate = await tx.product_variants.findFirst({
              where: {
                product_id: productId,
                name: { equals: validatedData.name, mode: 'insensitive' },
                NOT: { id: variantId },
              },
            });

            if (duplicate) {
              throw new ConflictError(
                `A variant named "${validatedData.name}" already exists for this product`
              );
            }
          }

          return tx.product_variants.update({
            where: { id: variantId },
            data: {
              ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
              ...(validatedData.price !== undefined
                ? { price: new Prisma.Decimal(validatedData.price.toFixed(2)) }
                : {}),
              ...(validatedData.displayOrder !== undefined
                ? { display_order: validatedData.displayOrder }
                : {}),
              ...(validatedData.isActive !== undefined ? { is_active: validatedData.isActive } : {}),
              ...(validatedData.isAvailable !== undefined
                ? { is_available: validatedData.isAvailable }
                : {}),
              updated_at: new Date(),
            },
          });
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 }
      );

      return successResponse({
        variant: formatVariant(updated, product.price),
      });
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; variantId: string }> }
) {
  try {
    const { productId, variantId } = await params;
    validateUuid(productId, 'productId');
    validateUuid(variantId, 'variantId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // Verify parent product belongs to the authenticated restaurant
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify variant belongs to the specified product
    const variant = await prisma.product_variants.findFirst({
      where: {
        id: variantId,
        product_id: productId,
      },
    });

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }

    // Check if variant has historical order references
    const orderItemsCount = await prisma.order_items.count({
      where: { variant_id: variantId },
    });

    if (orderItemsCount > 0) {
      // Unsafe to permanently delete: deactivate and archive to preserve historical order records
      const deactivated = await prisma.product_variants.update({
        where: { id: variantId },
        data: {
          is_active: false,
          is_available: false,
          updated_at: new Date(),
        },
      });

      return successResponse({
        deleted: false,
        archived: true,
        variant: formatVariant(deactivated, product.price),
        message:
          'Variant has existing order history. It has been deactivated and archived instead of permanently deleted to preserve historical order records.',
      });
    }

    // Safe to permanently delete when no orders reference it
    try {
      await prisma.product_variants.delete({
        where: { id: variantId },
      });

      return successResponse({
        deleted: true,
        archived: false,
        message: 'Variant deleted successfully.',
      });
    } catch (dbError) {
      // Race condition safety: if an order was placed concurrently during delete check
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003') {
        const deactivated = await prisma.product_variants.update({
          where: { id: variantId },
          data: {
            is_active: false,
            is_available: false,
            updated_at: new Date(),
          },
        });

        return successResponse({
          deleted: false,
          archived: true,
          variant: formatVariant(deactivated, product.price),
          message:
            'Variant was referenced by a concurrent order. It has been deactivated and archived instead of permanently deleted.',
        });
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
