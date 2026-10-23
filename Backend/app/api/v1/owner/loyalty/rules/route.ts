import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { updateLoyaltyRulesSchema } from '@/lib/validation/feedback';
import {
  getOrCreateRestaurantLoyaltyProgram,
  updateRestaurantLoyaltyRules,
} from '@/lib/loyalty/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate owner and resolve authorized restaurant
    const { searchParams } = new URL(request.url);
    const requestedRestaurantId = searchParams.get('restaurantId');

    const authContext = await requireAuthorizedRestaurant(request, requestedRestaurantId);
    const restaurantId = authContext.restaurant.id;

    // 2. Retrieve loyalty program rules for this restaurant
    const program = await getOrCreateRestaurantLoyaltyProgram(restaurantId);

    return successResponse(
      {
        restaurantId,
        restaurantName: authContext.restaurant.name,
        loyaltyProgram: program,
      },
      200
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 1. Authenticate owner and resolve authorized restaurant
    const { searchParams } = new URL(request.url);
    const requestedRestaurantId = searchParams.get('restaurantId');

    const authContext = await requireAuthorizedRestaurant(request, requestedRestaurantId);
    const restaurantId = authContext.restaurant.id;

    // 2. Parse and validate updated loyalty rules
    const body = await request.json();
    const validatedInput = updateLoyaltyRulesSchema.parse(body);

    // 3. Update loyalty rules strictly for the authorized restaurant
    const updated = await updateRestaurantLoyaltyRules(restaurantId, validatedInput);

    return successResponse(
      {
        restaurantId,
        restaurantName: authContext.restaurant.name,
        loyaltyProgram: updated,
      },
      200
    );
  } catch (error) {
    return handleApiError(error);
  }
}
