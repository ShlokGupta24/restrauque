import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { revokeCustomerDatabaseSession } from '@/lib/auth/session';
import { clearAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await requireCustomer(request);

    // Revoke customer session in customer_sessions table
    await revokeCustomerDatabaseSession(sessionId);

    const response = successResponse({
      message: 'Customer logged out successfully',
    });

    // Clear HTTP-only cookie
    clearAuthCookie(response);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
