import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '@/lib/config/env';
import type { SessionPayload } from '@/types/auth';

const TOKEN_EXPIRY = '7d';
const ISSUER = 'restrauque-backend';
const AUDIENCE = 'restrauque-app';

function getSecretKey(): Uint8Array {
  const env = getEnv();
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function createJwtToken(payload: SessionPayload): Promise<string> {
  const secret = getSecretKey();

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

export async function verifyJwtToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (
      !payload.userId ||
      !payload.sessionId ||
      !payload.sessionToken ||
      !payload.role
    ) {
      return null;
    }

    return {
      userId: payload.userId as string,
      sessionId: payload.sessionId as string,
      sessionToken: payload.sessionToken as string,
      role: payload.role as SessionPayload['role'],
      email: (payload.email as string) || null,
      phone: (payload.phone as string) || null,
    };
  } catch {
    return null;
  }
}
