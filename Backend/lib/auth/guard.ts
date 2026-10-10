import type { NextRequest } from 'next/server';
import { verifyJwtToken } from './jwt';
import { validateDatabaseSession } from './session';
import { AUTH_COOKIE_NAME } from './cookies';
import { AuthenticationError, ForbiddenError } from '@/lib/http/errors';
import type { SafeUser, AuthRole } from '@/types/auth';

export interface AuthenticatedContext {
  user: SafeUser;
  sessionId: string;
}

export function extractAuthToken(request: Request | NextRequest): string | null {
  // 1. Try Authorization header: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Try Cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${AUTH_COOKIE_NAME}=`)) {
        const token = cookie.substring(AUTH_COOKIE_NAME.length + 1).trim();
        if (token) return token;
      }
    }
  }

  return null;
}

export async function authenticateRequest(
  request: Request | NextRequest
): Promise<AuthenticatedContext> {
  const token = extractAuthToken(request);
  if (!token) {
    throw new AuthenticationError('Authentication required: Missing credentials');
  }

  // Verify JWT signature and claims (including sessionToken)
  const jwtPayload = await verifyJwtToken(token);
  if (!jwtPayload) {
    throw new AuthenticationError('Authentication required: Invalid or expired token');
  }

  // Validate server-side session in database and verify session token hash
  const sessionResult = await validateDatabaseSession(
    jwtPayload.sessionId,
    jwtPayload.sessionToken
  );
  if (!sessionResult) {
    throw new AuthenticationError('Authentication required: Session expired or revoked');
  }

  // Prevent user impersonation: verify user ID matches
  if (sessionResult.user.id !== jwtPayload.userId) {
    throw new AuthenticationError('Authentication mismatch detected');
  }

  return sessionResult;
}

export async function requireRoles(
  request: Request | NextRequest,
  allowedRoles: AuthRole[]
): Promise<AuthenticatedContext> {
  const authContext = await authenticateRequest(request);

  if (!allowedRoles.includes(authContext.user.role)) {
    throw new ForbiddenError(
      `Access forbidden: Requires one of [${allowedRoles.join(', ')}] role`
    );
  }

  return authContext;
}

export async function requireCustomer(
  request: Request | NextRequest
): Promise<AuthenticatedContext> {
  return requireRoles(request, ['CUSTOMER']);
}

export async function requireRestaurantOwner(
  request: Request | NextRequest
): Promise<AuthenticatedContext> {
  return requireRoles(request, ['RESTAURANT_OWNER']);
}
