import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { customerFeedbackQuerySchema } from '@/lib/validation/feedback';
import { getCustomerFeedbackHistory } from '@/lib/customer/feedback';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate customer - customer ID derived strictly from active session
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = {
      status: searchParams.get('status') || undefined,
      restaurantId: searchParams.get('restaurantId') || undefined,
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    };

    const validatedQuery = customerFeedbackQuerySchema.parse(queryInput);

    // 3. Retrieve customer feedback history
    const result = await getCustomerFeedbackHistory(customerId, validatedQuery);

    // 4. Return standardized success response
    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
