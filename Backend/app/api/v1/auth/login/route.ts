import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { loginSchema } from '@/lib/validation/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError, AuthenticationError } from '@/lib/http/errors';
import type { SafeUser, AuthRole } from '@/types/auth';

export const dynamic = 'force-dynamic';

/**
 * Rate Limiting Architecture Note:
 * In accordance with Phase 1 constraints (no Redis or external queue infrastructure allowed),
 * production deployments should enforce rate-limiting at the edge/reverse-proxy layer
 * (e.g., Cloudflare, AWS WAF, or Nginx: limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m).
 * Application-level distributed rate limiting will be integrated in subsequent phases once Redis is provisioned.
 */

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedData = loginSchema.parse(rawBody);

    // Look up user by normalized email
    const user = await prisma.users.findUnique({
      where: { email: validatedData.email },
    });

    // Generic error for non-existent user (timing-safe failure)
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password against stored hash
    const isPasswordValid = await verifyPassword(
      validatedData.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Ensure user account is active
    if (user.status !== 'active') {
      throw new AuthenticationError('Account is suspended or inactive');
    }

    // Establish secure session with random token
    const ipAddress = request.headers.get('x-forwarded-for') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const { sessionId, sessionToken } = await createDatabaseSession(user.id, ipAddress, userAgent);

    // Role is loaded directly from DB record, never trusted from client
    // Issue JWT binding user ID, session ID, and the unhashed session token
    const token = await createJwtToken({
      userId: user.id,
      sessionId,
      sessionToken,
      email: user.email,
      role: user.role as AuthRole,
    });

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role as AuthRole,
      status: user.status,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };

    const response = successResponse({
      user: safeUser,
      token,
    });

    // Set secure HTTP-only cookie
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
