import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/guard';
import { revokeDatabaseSession } from '@/lib/auth/session';
import { clearAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await authenticateRequest(request);

    // Invalidate session in the database
    await revokeDatabaseSession(sessionId);

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
