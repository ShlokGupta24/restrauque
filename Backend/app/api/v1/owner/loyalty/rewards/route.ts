import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { ownerRewardsQuerySchema, createRewardSchema } from '@/lib/validation/loyalty';
import {
  getOwnerLoyaltyRewards,
  createOwnerLoyaltyReward,
} from '@/lib/loyalty/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Parse and validate query parameters
    const queryInput = {
      restaurantId: searchParams.get('restaurantId') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const validatedQuery = ownerRewardsQuerySchema.parse(queryInput);

    // 2. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, validatedQuery.restaurantId);
    const restaurantId = authContext.restaurant.id;

    // 3. Retrieve tenant-scoped rewards catalogue
    const result = await getOwnerLoyaltyRewards(restaurantId, validatedQuery);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedRestaurantId = searchParams.get('restaurantId') || undefined;

    // 1. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, requestedRestaurantId);
    const restaurantId = authContext.restaurant.id;

    // 2. Parse and validate reward creation payload
    const body = await request.json();
    const validatedBody = createRewardSchema.parse(body);

    // 3. Create reward scoped strictly to the authorized restaurant
    const result = await createOwnerLoyaltyReward(restaurantId, validatedBody);

    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
