import crypto from 'crypto';

/**
 * Generates a cryptographically secure, URL-safe random QR token with 256 bits of entropy.
 */
export function generateSecureQrToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Computes a deterministic SHA-256 hexadecimal hash of the secret QR token.
 * Only this hash is persisted to the database.
 */
export function hashQrToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Validates whether the incoming token matches acceptable string format and length.
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  // URL-safe base64 / alphanumeric tokens between 20 and 128 characters
  return /^[A-Za-z0-9_-]{20,128}$/.test(token);
}

/**
 * Performs a constant-time comparison between two hex-encoded hashes.
 */
export function constantTimeHashCompare(hashA: string, hashB: string): boolean {
  if (typeof hashA !== 'string' || typeof hashB !== 'string') return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Constructs the public QR scanning URL.
 */
export function buildPublicQrUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/+$/, '')}/qr/${encodeURIComponent(token)}`;
}
