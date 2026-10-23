import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateCategorySchema } from '@/lib/validation/menu';
import { formatCategory } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError, ValidationError } from '@/lib/http/errors';
import { CATALOG_BOUNDS } from '@/lib/validation/menu';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    validateUuid(categoryId, 'categoryId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const category = await prisma.categories.findFirst({
      where: {
        id: categoryId,
        restaurant_id: restaurantId,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return successResponse({
      category: formatCategory(category),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    validateUuid(categoryId, 'categoryId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const existingCategory = await prisma.categories.findFirst({
      where: {
        id: categoryId,
        restaurant_id: restaurantId,
      },
    });

    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    const rawBody = await request.json();
    const validatedData = updateCategorySchema.parse(rawBody);

    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          // If activating a previously inactive category, check active category capacity limit with container-level row lock
          if (validatedData.isActive === true && !existingCategory.is_active) {
            if (typeof (tx as any).$executeRaw === 'function') {
              await (tx as any).$executeRaw`SELECT id FROM restaurants WHERE id = ${restaurantId}::uuid FOR UPDATE`;
            }

            const activeCount = await tx.categories.count({
              where: {
                restaurant_id: restaurantId,
                is_active: true,
              },
            });

            if (activeCount >= CATALOG_BOUNDS.MAX_CATEGORIES) {
              throw new ValidationError(
                `Category limit reached. A restaurant cannot have more than ${CATALOG_BOUNDS.MAX_CATEGORIES} active categories.`
              );
            }
          }

          // If renaming, check for uniqueness conflicts in this restaurant
          if (validatedData.name && validatedData.name.toLowerCase() !== existingCategory.name.toLowerCase()) {
            const duplicate = await tx.categories.findFirst({
              where: {
                restaurant_id: restaurantId,
                name: { equals: validatedData.name, mode: 'insensitive' },
                NOT: { id: categoryId },
              },
            });

            if (duplicate) {
              throw new ConflictError(
                `A category named "${validatedData.name}" already exists in this restaurant`
              );
            }
          }

          return tx.categories.update({
            where: { id: categoryId },
            data: {
              ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
              ...(validatedData.description !== undefined ? { description: validatedData.description } : {}),
              ...(validatedData.displayOrder !== undefined ? { display_order: validatedData.displayOrder } : {}),
              ...(validatedData.isActive !== undefined ? { is_active: validatedData.isActive } : {}),
              updated_at: new Date(),
            },
            include: {
              _count: {
                select: { products: true },
              },
            },
          });
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 }
      );

      return successResponse({
        category: formatCategory(updated),
      });
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A category named "${validatedData.name}" already exists in this restaurant`
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
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await params;
    validateUuid(categoryId, 'categoryId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const category = await prisma.categories.findFirst({
      where: {
        id: categoryId,
        restaurant_id: restaurantId,
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if category has associated products
    const productCount = await prisma.products.count({
      where: { category_id: categoryId },
    });

    if (productCount > 0) {
      // Unsafe to permanently delete: deactivate and archive to preserve product relations and history
      const deactivated = await prisma.categories.update({
        where: { id: categoryId },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      return successResponse({
        deleted: false,
        archived: true,
        category: formatCategory(deactivated),
        message: 'Category contains existing products. It has been deactivated and archived instead of permanently deleted.',
      });
    }

    // Safe to permanently delete when no products reference it
    await prisma.categories.delete({
      where: { id: categoryId },
    });

    return successResponse({
      deleted: true,
      archived: false,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
