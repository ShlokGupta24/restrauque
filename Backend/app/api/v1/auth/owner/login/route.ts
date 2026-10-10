import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ownerLoginSchema } from '@/lib/validation/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError, AuthenticationError } from '@/lib/http/errors';
import type { SafeUser } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedData = ownerLoginSchema.parse(rawBody);

    // Look up user by normalized email in users table
    const user = await prisma.users.findUnique({
      where: { email: validatedData.email },
    });

    // Timing-safe generic error for non-existent user OR non-owner accounts
    // Customer accounts attempting to sign in here are explicitly rejected with generic error
    if (!user || user.role !== 'RESTAURANT_OWNER') {
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

    // Issue JWT binding user ID, session ID, and unhashed session token
    const token = await createJwtToken({
      userId: user.id,
      sessionId,
      sessionToken,
      email: user.email,
      phone: user.phone,
      role: 'RESTAURANT_OWNER',
    });

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: 'RESTAURANT_OWNER',
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
