import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { createAddonSchema } from '@/lib/validation/menu';
import { formatAddon } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError } from '@/lib/http/errors';
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

    // Check for duplicate add-on name within this product
    const existing = await prisma.product_addons.findFirst({
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

    try {
      const created = await prisma.product_addons.create({
        data: {
          product_id: productId,
          name: validatedData.name,
          price: new Prisma.Decimal((validatedData.price ?? 0).toFixed(2)),
          display_order: validatedData.displayOrder ?? 0,
          is_available: validatedData.isAvailable ?? true,
          is_active: validatedData.isActive ?? true,
        },
      });

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
