import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { getCustomerDashboardOverview } from '@/lib/customer/overview';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate customer - customer ID derived strictly from active session
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Retrieve customer dashboard overview data
    const overview = await getCustomerDashboardOverview(customerId, {
      id: authContext.user.id,
      name: authContext.user.name,
      phone: authContext.user.phone,
    });

    // 3. Return standardized success response
    return successResponse(overview, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
