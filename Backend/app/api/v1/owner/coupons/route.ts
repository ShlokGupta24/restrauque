import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { createCouponSchema, couponQuerySchema } from '@/lib/validation/coupon';
import { formatCoupon } from '@/lib/coupons/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/owner/coupons
 *
 * Lists all coupons belonging to the authorized restaurant.
 * Supports pagination, search, and active-status filtering.
 * Returns restaurant-wide summary counters for total, active, inactive, and expired coupons.
 */
export async function GET(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const { searchParams } = new URL(request.url);
    const queryInput = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const validatedQuery = couponQuerySchema.parse(queryInput);

    const where: Prisma.couponsWhereInput = {
      restaurant_id: restaurantId,
    };

    if (validatedQuery.isActive !== undefined) {
      where.is_active = validatedQuery.isActive;
    }

    if (validatedQuery.search) {
      const term = validatedQuery.search;
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }

    const page = validatedQuery.page ?? 1;
    const limit = validatedQuery.limit ?? 20;
    const skip = (page - 1) * limit;

    const now = new Date();

    const [
      couponsList,
      totalFilteredCount,
      totalCoupons,
      activeCoupons,
      inactiveCoupons,
      expiredCoupons,
    ] = await Promise.all([
      prisma.coupons.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.coupons.count({ where }),
      prisma.coupons.count({
        where: { restaurant_id: restaurantId },
      }),
      prisma.coupons.count({
        where: { restaurant_id: restaurantId, is_active: true },
      }),
      prisma.coupons.count({
        where: { restaurant_id: restaurantId, is_active: false },
      }),
      prisma.coupons.count({
        where: { restaurant_id: restaurantId, valid_until: { lt: now } },
      }),
    ]);

    const totalPages = Math.ceil(totalFilteredCount / limit) || 1;

    return successResponse({
      coupons: couponsList.map((c) => formatCoupon(c, now)),
      pagination: {
        page,
        limit,
        totalCount: totalFilteredCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summary: {
        totalCoupons,
        activeCoupons,
        inactiveCoupons,
        expiredCoupons,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/owner/coupons
 *
 * Creates a new restaurant-scoped coupon.
 * Normalizes code to trimmed uppercase and enforces uniqueness per restaurant.
 */
export async function POST(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const rawBody = await request.json();
    const validatedData = createCouponSchema.parse(rawBody);

    // Pre-check for duplicate code within this restaurant
    const existing = await prisma.coupons.findFirst({
      where: {
        restaurant_id: restaurantId,
        code: validatedData.code,
      },
    });

    if (existing) {
      throw new ConflictError(
        `A coupon with code "${validatedData.code}" already exists for this restaurant`
      );
    }

    try {
      const created = await prisma.coupons.create({
        data: {
          restaurant_id: restaurantId,
          code: validatedData.code,
          name: validatedData.name,
          description: validatedData.description ?? null,
          discount_type: validatedData.discountType,
          discount_value: validatedData.discountValue,
          minimum_order_amount: validatedData.minimumOrderAmount ?? 0,
          maximum_discount_amount: validatedData.maximumDiscountAmount ?? null,
          usage_limit: validatedData.usageLimit ?? null,
          usage_count: 0,
          valid_from: validatedData.validFrom ? new Date(validatedData.validFrom) : new Date(),
          valid_until: validatedData.validUntil ? new Date(validatedData.validUntil) : null,
          is_active: validatedData.isActive ?? true,
        },
      });

      return successResponse(
        {
          coupon: formatCoupon(created),
        },
        201
      );
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A coupon with code "${validatedData.code}" already exists for this restaurant`
        );
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
