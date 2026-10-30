import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { validateUuid } from '@/lib/auth/tenancy';
import { getCustomerLoyaltySummary } from '@/lib/loyalty/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ValidationError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate customer
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Extract and validate restaurantId from query
    const { searchParams } = new URL(request.url);
    const restaurantIdParam = searchParams.get('restaurantId');

    if (!restaurantIdParam) {
      throw new ValidationError('restaurantId query parameter is required');
    }

    const restaurantId = validateUuid(restaurantIdParam, 'restaurantId');

    // 3. Retrieve customer loyalty summary for this restaurant
    const summary = await getCustomerLoyaltySummary(customerId, restaurantId);

    return successResponse(summary, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
