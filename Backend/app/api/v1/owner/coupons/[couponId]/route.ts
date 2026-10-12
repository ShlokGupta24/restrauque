import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateCouponSchema } from '@/lib/validation/coupon';
import { formatCoupon } from '@/lib/coupons/format';
import { successResponse } from '@/lib/http/response';
import {
  handleApiError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/owner/coupons/[couponId]
 *
 * Retrieves a single coupon by ID, scoped to the authorized restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const { couponId } = await params;
    validateUuid(couponId, 'couponId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const coupon = await prisma.coupons.findFirst({
      where: {
        id: couponId,
        restaurant_id: restaurantId,
      },
    });

    if (!coupon) {
      throw new NotFoundError('Coupon not found');
    }

    return successResponse({
      coupon: formatCoupon(coupon),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/owner/coupons/[couponId]
 *
 * Partially updates an existing coupon.
 * Validates effective date combinations, usage limits against current usage count,
 * and maintains tenant isolation and code uniqueness.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const { couponId } = await params;
    validateUuid(couponId, 'couponId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const existing = await prisma.coupons.findFirst({
      where: {
        id: couponId,
        restaurant_id: restaurantId,
      },
    });

    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    const rawBody = await request.json();
    const validatedData = updateCouponSchema.parse(rawBody);

    // 1. Code uniqueness check if updating code
    if (validatedData.code && validatedData.code !== existing.code) {
      const duplicate = await prisma.coupons.findFirst({
        where: {
          restaurant_id: restaurantId,
          code: validatedData.code,
          NOT: { id: couponId },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          `A coupon with code "${validatedData.code}" already exists for this restaurant`
        );
      }
    }

    // 2. Validate effective discount type and maximum discount amount combination
    const effectiveDiscountType = validatedData.discountType ?? existing.discount_type;
    const effectiveMaxDiscount =
      validatedData.maximumDiscountAmount !== undefined
        ? validatedData.maximumDiscountAmount
        : existing.maximum_discount_amount !== null
        ? Number(existing.maximum_discount_amount)
        : null;

    if (effectiveDiscountType === 'fixed' && effectiveMaxDiscount !== null) {
      throw new ValidationError(
        'Maximum discount amount is only applicable for percentage discounts'
      );
    }

    // 3. Validate effective percentage discount value
    const effectiveDiscountValue =
      validatedData.discountValue !== undefined
        ? validatedData.discountValue
        : Number(existing.discount_value);

    if (effectiveDiscountType === 'percentage' && effectiveDiscountValue > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100%');
    }

    // 4. Validate effective date relationships
    const effectiveValidFrom = validatedData.validFrom
      ? new Date(validatedData.validFrom)
      : existing.valid_from;

    const effectiveValidUntil =
      validatedData.validUntil !== undefined
        ? validatedData.validUntil
          ? new Date(validatedData.validUntil)
          : null
        : existing.valid_until;

    if (effectiveValidUntil && effectiveValidUntil < effectiveValidFrom) {
      throw new ValidationError('validUntil cannot precede validFrom');
    }

    // 5. Validate usageLimit is not lower than existing usage_count
    const currentUsageCount = existing.usage_count ?? 0;
    if (
      validatedData.usageLimit !== undefined &&
      validatedData.usageLimit !== null &&
      validatedData.usageLimit < currentUsageCount
    ) {
      throw new ConflictError(
        `Cannot set usage limit (${validatedData.usageLimit}) lower than current redemption count (${currentUsageCount})`
      );
    }

    try {
      const updated = await prisma.coupons.update({
        where: { id: couponId },
        data: {
          ...(validatedData.code !== undefined ? { code: validatedData.code } : {}),
          ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
          ...(validatedData.description !== undefined
            ? { description: validatedData.description }
            : {}),
          ...(validatedData.discountType !== undefined
            ? { discount_type: validatedData.discountType }
            : {}),
          ...(validatedData.discountValue !== undefined
            ? { discount_value: validatedData.discountValue }
            : {}),
          ...(validatedData.minimumOrderAmount !== undefined
            ? { minimum_order_amount: validatedData.minimumOrderAmount }
            : {}),
          ...(validatedData.maximumDiscountAmount !== undefined
            ? { maximum_discount_amount: validatedData.maximumDiscountAmount }
            : {}),
          ...(validatedData.usageLimit !== undefined
            ? { usage_limit: validatedData.usageLimit }
            : {}),
          ...(validatedData.validFrom !== undefined
            ? { valid_from: new Date(validatedData.validFrom) }
            : {}),
          ...(validatedData.validUntil !== undefined
            ? {
                valid_until: validatedData.validUntil ? new Date(validatedData.validUntil) : null,
              }
            : {}),
          ...(validatedData.isActive !== undefined ? { is_active: validatedData.isActive } : {}),
          updated_at: new Date(),
        },
      });

      return successResponse({
        coupon: formatCoupon(updated),
      });
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

/**
 * DELETE /api/v1/owner/coupons/[couponId]
 *
 * Implements safe deletion:
 * - If historical orders reference this coupon (in order_coupons), deactivates/archives it (is_active = false).
 * - If unreferenced, hard deletes it from the database.
 * - Handles race conditions where an order is placed concurrently by catching FK constraint violations
 *   and falling back to safe archival.
 * - Repeated deletion of already archived coupons returns a deterministic response.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  try {
    const { couponId } = await params;
    validateUuid(couponId, 'couponId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const coupon = await prisma.coupons.findFirst({
      where: {
        id: couponId,
        restaurant_id: restaurantId,
      },
    });

    if (!coupon) {
      throw new NotFoundError('Coupon not found');
    }

    // Check if historical order_coupons reference this coupon
    const orderCouponsCount = await prisma.order_coupons.count({
      where: { coupon_id: couponId },
    });

    if (orderCouponsCount > 0) {
      if (!coupon.is_active) {
        return successResponse({
          deleted: false,
          archived: true,
          coupon: formatCoupon(coupon),
          message: 'Coupon is already archived.',
        });
      }

      const archived = await prisma.coupons.update({
        where: { id: couponId },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      return successResponse({
        deleted: false,
        archived: true,
        coupon: formatCoupon(archived),
        message:
          'Coupon has historical order references. It has been deactivated and archived instead of permanently deleted.',
      });
    }

    // If coupon is unreferenced in order_coupons, attempt hard delete
    try {
      await prisma.coupons.delete({
        where: { id: couponId },
      });

      return successResponse({
        deleted: true,
        archived: false,
        message: 'Coupon deleted successfully.',
      });
    } catch (dbError) {
      // Catch foreign key constraint violation (P2003) if a concurrent order referenced the coupon
      if (
        dbError instanceof Prisma.PrismaClientKnownRequestError &&
        dbError.code === 'P2003'
      ) {
        const archived = await prisma.coupons.update({
          where: { id: couponId },
          data: {
            is_active: false,
            updated_at: new Date(),
          },
        });

        return successResponse({
          deleted: false,
          archived: true,
          coupon: formatCoupon(archived),
          message:
            'Coupon was referenced by a concurrent order and has been archived instead of deleted.',
        });
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
