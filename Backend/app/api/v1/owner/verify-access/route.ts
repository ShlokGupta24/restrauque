import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant, requireAuthorizedBranch } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ValidationError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const branchId = searchParams.get('branchId');

    if (!restaurantId) {
      throw new ValidationError('Query parameter restaurantId is required');
    }

    if (branchId) {
      const context = await requireAuthorizedBranch(request, restaurantId, branchId);
      return successResponse({
        authorized: true,
        restaurant: context.restaurant,
        branch: context.branch,
      });
    }

    const context = await requireAuthorizedRestaurant(request, restaurantId);
    return successResponse({
      authorized: true,
      restaurant: context.restaurant,
      branches: context.branches,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
