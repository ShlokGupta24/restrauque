import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { registerSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError } from '@/lib/http/errors';
import type { SafeUser, AuthRole } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedData = registerSchema.parse(rawBody);

    // Check for existing account by email to provide friendly conflict error
    const existingUser = await prisma.users.findUnique({
      where: { email: validatedData.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists');
    }

    // Hash password with bcrypt salt 12
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user record in PostgreSQL
    const user = await prisma.users.create({
      data: {
        email: validatedData.email,
        password_hash: hashedPassword,
        name: validatedData.name,
        phone: validatedData.phone || null,
        role: validatedData.role,
        status: 'active',
      },
    });

    // Establish secure session
    const ipAddress = request.headers.get('x-forwarded-for') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const { sessionId } = await createDatabaseSession(user.id, ipAddress, userAgent);

    const token = await createJwtToken({
      userId: user.id,
      sessionId,
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

    const response = successResponse(
      {
        user: safeUser,
        token,
      },
      201
    );

    // Set secure HTTP-only cookie
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
