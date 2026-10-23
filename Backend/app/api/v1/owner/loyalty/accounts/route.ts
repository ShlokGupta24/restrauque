import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { ownerLoyaltyAccountsQuerySchema } from '@/lib/validation/loyalty';
import { getOwnerLoyaltyAccounts } from '@/lib/loyalty/service';
import { handleApiError } from '@/lib/http/errors';
import { successResponse } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Parse and validate query parameters
    const queryInput = {
      restaurantId: searchParams.get('restaurantId') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const validatedQuery = ownerLoyaltyAccountsQuerySchema.parse(queryInput);

    // 2. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, validatedQuery.restaurantId);
    const restaurantId = authContext.restaurant.id;

    // 3. Query tenant-isolated customer loyalty accounts and metrics
    const result = await getOwnerLoyaltyAccounts(restaurantId, validatedQuery);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
