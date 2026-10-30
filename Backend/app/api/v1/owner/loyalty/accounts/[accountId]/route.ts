import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { ownerLoyaltyAccountDetailQuerySchema } from '@/lib/validation/loyalty';
import { getOwnerLoyaltyAccountDetail } from '@/lib/loyalty/service';
import { handleApiError } from '@/lib/http/errors';
import { successResponse } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ accountId: string }> | { accountId: string };
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const rawParams = await Promise.resolve(context.params);
    const accountId = validateUuid(rawParams.accountId, 'accountId');

    const { searchParams } = new URL(request.url);

    // 1. Parse and validate query parameters
    const queryInput = {
      restaurantId: searchParams.get('restaurantId') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const validatedQuery = ownerLoyaltyAccountDetailQuerySchema.parse(queryInput);

    // 2. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, validatedQuery.restaurantId);
    const restaurantId = authContext.restaurant.id;

    // 3. Query tenant-isolated customer loyalty account details and ledger
    const result = await getOwnerLoyaltyAccountDetail(restaurantId, accountId, validatedQuery);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
