import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { SafeUser, AuthRole } from '@/types/auth';

const SESSION_EXPIRY_DAYS = 7;

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifySessionTokenHash(token: string, storedHash: string): boolean {
  const computedHash = hashSessionToken(token);
  if (computedHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

export async function createDatabaseSession(
  userId: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<{ sessionId: string; sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  const session = await prisma.user_sessions.create({
    data: {
      user_id: userId,
      session_token_hash: sessionTokenHash,
      expires_at: expiresAt,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      status: 'active',
    },
  });

  return {
    sessionId: session.id,
    sessionToken,
    expiresAt,
  };
}

export async function validateDatabaseSession(
  sessionId: string,
  sessionToken?: string
): Promise<{ user: SafeUser; sessionId: string } | null> {
  const session = await prisma.user_sessions.findUnique({
    where: { id: sessionId },
    include: {
      users: true,
    },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired or revoked
  if (session.status !== 'active' || session.expires_at < new Date() || session.revoked_at) {
    return null;
  }

  // Check if user is active
  if (session.users.status !== 'active') {
    return null;
  }

  // Cryptographically verify session token hash against stored hash if token is supplied
  if (sessionToken && !verifySessionTokenHash(sessionToken, session.session_token_hash)) {
    return null;
  }

  // Update last_used_at asynchronously (fail-safe)
  prisma.user_sessions
    .update({
      where: { id: sessionId },
      data: { last_used_at: new Date() },
    })
    .catch(() => {});

  const safeUser: SafeUser = {
    id: session.users.id,
    email: session.users.email,
    name: session.users.name,
    phone: session.users.phone,
    role: session.users.role as AuthRole,
    status: session.users.status,
    createdAt: session.users.created_at.toISOString(),
    updatedAt: session.users.updated_at.toISOString(),
  };

  return {
    user: safeUser,
    sessionId: session.id,
  };
}

export async function revokeDatabaseSession(sessionId: string): Promise<boolean> {
  try {
    await prisma.user_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'revoked',
        revoked_at: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}
