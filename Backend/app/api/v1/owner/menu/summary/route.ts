import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const [
      activeCategories,
      inactiveCategories,
      activeProducts,
      inactiveProducts,
      availableProducts,
      unavailableProducts,
    ] = await Promise.all([
      prisma.categories.count({
        where: { restaurant_id: restaurantId, is_active: true },
      }),
      prisma.categories.count({
        where: { restaurant_id: restaurantId, is_active: false },
      }),
      prisma.products.count({
        where: { restaurant_id: restaurantId, is_active: true },
      }),
      prisma.products.count({
        where: { restaurant_id: restaurantId, is_active: false },
      }),
      prisma.products.count({
        where: { restaurant_id: restaurantId, is_available: true },
      }),
      prisma.products.count({
        where: { restaurant_id: restaurantId, is_available: false },
      }),
    ]);

    return successResponse({
      totalCategories: activeCategories + inactiveCategories,
      activeCategories,
      inactiveCategories,
      totalProducts: activeProducts + inactiveProducts,
      activeProducts,
      inactiveProducts,
      availableProducts,
      unavailableProducts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
