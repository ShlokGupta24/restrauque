import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateRewardSchema } from '@/lib/validation/loyalty';
import { updateOwnerLoyaltyReward } from '@/lib/loyalty/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const rawParams = await Promise.resolve(context.params);
    const rewardId = validateUuid(rawParams.id, 'id');

    const { searchParams } = new URL(request.url);
    const requestedRestaurantId = searchParams.get('restaurantId') || undefined;

    // 1. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, requestedRestaurantId);
    const restaurantId = authContext.restaurant.id;

    // 2. Parse and validate update payload
    const body = await request.json();
    const validatedBody = updateRewardSchema.parse(body);

    // 3. Update reward scoped strictly to the authorized restaurant
    const result = await updateOwnerLoyaltyReward(restaurantId, rewardId, validatedBody);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
