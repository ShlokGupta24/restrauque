import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/guard';
import { revokeDatabaseSession, revokeCustomerDatabaseSession } from '@/lib/auth/session';
import { clearAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user, sessionId } = await authenticateRequest(request);

    // Invalidate session in the appropriate database table
    if (user.role === 'CUSTOMER') {
      const revoked = await revokeCustomerDatabaseSession(sessionId);
      if (!revoked) {
        await revokeDatabaseSession(sessionId);
      }
    } else {
      await revokeDatabaseSession(sessionId);
    }

    const response = successResponse({
      message: 'Logged out successfully',
    });

    // Clear HTTP-only cookie
    clearAuthCookie(response);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
