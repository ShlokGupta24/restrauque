import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { ownerRewardRedemptionsQuerySchema } from '@/lib/validation/loyalty';
import { getOwnerRewardRedemptions } from '@/lib/loyalty/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const rawParams = await Promise.resolve(context.params);
    const rewardId = validateUuid(rawParams.id, 'id');

    const { searchParams } = new URL(request.url);

    // 1. Parse and validate query parameters
    const queryInput = {
      restaurantId: searchParams.get('restaurantId') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const validatedQuery = ownerRewardRedemptionsQuerySchema.parse(queryInput);

    // 2. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, validatedQuery.restaurantId);
    const restaurantId = authContext.restaurant.id;

    // 3. Retrieve tenant-scoped reward redemptions
    const result = await getOwnerRewardRedemptions(restaurantId, rewardId, validatedQuery);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
