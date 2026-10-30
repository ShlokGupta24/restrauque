import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateAddonSchema, CATALOG_BOUNDS } from '@/lib/validation/menu';
import { formatAddon } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError, ValidationError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; addonId: string }> }
) {
  try {
    const { productId, addonId } = await params;
    validateUuid(productId, 'productId');
    validateUuid(addonId, 'addonId');

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

    // Verify add-on belongs to the specified product
    const addon = await prisma.product_addons.findFirst({
      where: {
        id: addonId,
        product_id: productId,
      },
    });

    if (!addon) {
      throw new NotFoundError('Add-on not found');
    }

    return successResponse({
      addon: formatAddon(addon),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; addonId: string }> }
) {
  try {
    const { productId, addonId } = await params;
    validateUuid(productId, 'productId');
    validateUuid(addonId, 'addonId');

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

    // Verify add-on exists and belongs to the specified product
    const existingAddon = await prisma.product_addons.findFirst({
      where: {
        id: addonId,
        product_id: productId,
      },
    });

    if (!existingAddon) {
      throw new NotFoundError('Add-on not found');
    }

    const rawBody = await request.json();
    const validatedData = updateAddonSchema.parse(rawBody);

    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          // If activating a previously inactive add-on, check active add-on capacity limit with container-level row lock
          if (validatedData.isActive === true && !existingAddon.is_active) {
            if (typeof (tx as any).$executeRaw === 'function') {
              await (tx as any).$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
            }

            const activeCount = await tx.product_addons.count({
              where: {
                product_id: productId,
                is_active: true,
              },
            });

            if (activeCount >= CATALOG_BOUNDS.MAX_ADDONS_PER_PRODUCT) {
              throw new ValidationError(
                `Add-on limit reached. A product cannot have more than ${CATALOG_BOUNDS.MAX_ADDONS_PER_PRODUCT} active add-ons.`
              );
            }
          }

          // If changing name, verify uniqueness within this product
          if (
            validatedData.name &&
            validatedData.name.toLowerCase() !== existingAddon.name.toLowerCase()
          ) {
            const duplicate = await tx.product_addons.findFirst({
              where: {
                product_id: productId,
                name: { equals: validatedData.name, mode: 'insensitive' },
                NOT: { id: addonId },
              },
            });

            if (duplicate) {
              throw new ConflictError(
                `An add-on named "${validatedData.name}" already exists for this product`
              );
            }
          }

          return tx.product_addons.update({
            where: { id: addonId },
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
        addon: formatAddon(updated),
      });
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string; addonId: string }> }
) {
  try {
    const { productId, addonId } = await params;
    validateUuid(productId, 'productId');
    validateUuid(addonId, 'addonId');

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

    // Verify add-on belongs to the specified product
    const addon = await prisma.product_addons.findFirst({
      where: {
        id: addonId,
        product_id: productId,
      },
    });

    if (!addon) {
      throw new NotFoundError('Add-on not found');
    }

    // Check if add-on has historical order references
    const orderAddonsCount = await prisma.order_item_addons.count({
      where: { product_addon_id: addonId },
    });

    if (orderAddonsCount > 0) {
      // Unsafe to permanently delete: deactivate and archive to preserve historical order records
      const deactivated = await prisma.product_addons.update({
        where: { id: addonId },
        data: {
          is_active: false,
          is_available: false,
          updated_at: new Date(),
        },
      });

      return successResponse({
        deleted: false,
        archived: true,
        addon: formatAddon(deactivated),
        message:
          'Add-on has existing order history. It has been deactivated and archived instead of permanently deleted to preserve historical order records.',
      });
    }

    // Safe to permanently delete when no orders reference it
    try {
      await prisma.product_addons.delete({
        where: { id: addonId },
      });

      return successResponse({
        deleted: true,
        archived: false,
        message: 'Add-on deleted successfully.',
      });
    } catch (dbError) {
      // Race condition safety: if an order was placed concurrently during delete check
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2003') {
        const deactivated = await prisma.product_addons.update({
          where: { id: addonId },
          data: {
            is_active: false,
            is_available: false,
            updated_at: new Date(),
          },
        });

        return successResponse({
          deleted: false,
          archived: true,
          addon: formatAddon(deactivated),
          message:
            'Add-on was referenced by a concurrent order. It has been deactivated and archived instead of permanently deleted.',
        });
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
