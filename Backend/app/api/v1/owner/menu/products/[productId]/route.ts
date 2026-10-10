import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateProductSchema } from '@/lib/validation/menu';
import { formatProduct } from '@/lib/menu/format';
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

    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
      include: {
        categories: {
          select: { name: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return successResponse({
      product: formatProduct(product),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    validateUuid(productId, 'productId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const existingProduct = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product not found');
    }

    const rawBody = await request.json();
    const validatedData = updateProductSchema.parse(rawBody);

    // If changing category, ensure target category belongs to this restaurant
    if (validatedData.categoryId && validatedData.categoryId !== existingProduct.category_id) {
      const category = await prisma.categories.findFirst({
        where: {
          id: validatedData.categoryId,
          restaurant_id: restaurantId,
        },
      });

      if (!category) {
        throw new ValidationError(
          'The specified category does not exist or does not belong to this restaurant'
        );
      }
    }

    // If changing name, check uniqueness in this restaurant
    if (validatedData.name && validatedData.name.toLowerCase() !== existingProduct.name.toLowerCase()) {
      const duplicate = await prisma.products.findFirst({
        where: {
          restaurant_id: restaurantId,
          name: { equals: validatedData.name, mode: 'insensitive' },
          NOT: { id: productId },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          `A product named "${validatedData.name}" already exists in this restaurant`
        );
      }
    }

    try {
      const updated = await prisma.products.update({
        where: { id: productId },
        data: {
          ...(validatedData.categoryId !== undefined ? { category_id: validatedData.categoryId } : {}),
          ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
          ...(validatedData.description !== undefined ? { description: validatedData.description } : {}),
          ...(validatedData.price !== undefined
            ? { price: new Prisma.Decimal(validatedData.price.toFixed(2)) }
            : {}),
          ...(validatedData.imageUrl !== undefined ? { image_url: validatedData.imageUrl } : {}),
          ...(validatedData.displayOrder !== undefined ? { display_order: validatedData.displayOrder } : {}),
          ...(validatedData.isActive !== undefined ? { is_active: validatedData.isActive } : {}),
          ...(validatedData.isAvailable !== undefined ? { is_available: validatedData.isAvailable } : {}),
          updated_at: new Date(),
        },
        include: {
          categories: {
            select: { name: true },
          },
        },
      });

      return successResponse({
        product: formatProduct(updated),
      });
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A product named "${validatedData.name}" already exists in this restaurant`
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
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    validateUuid(productId, 'productId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        restaurant_id: restaurantId,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check if product has historical order references
    const orderItemsCount = await prisma.order_items.count({
      where: { product_id: productId },
    });

    if (orderItemsCount > 0) {
      // Unsafe to permanently delete: deactivate and archive to preserve historical order records
      const deactivated = await prisma.products.update({
        where: { id: productId },
        data: {
          is_active: false,
          is_available: false,
          updated_at: new Date(),
        },
        include: {
          categories: {
            select: { name: true },
          },
        },
      });

      return successResponse({
        deleted: false,
        archived: true,
        product: formatProduct(deactivated),
        message: 'Product has existing order history. It has been deactivated and archived instead of permanently deleted to preserve reporting history.',
      });
    }

    // Safe to permanently delete when no orders reference it
    await prisma.products.delete({
      where: { id: productId },
    });

    return successResponse({
      deleted: true,
      archived: false,
      message: 'Product deleted successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
