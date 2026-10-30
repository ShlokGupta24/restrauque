import crypto from 'crypto';
import QRCode from 'qrcode';

const QR_SECRET =
  process.env.QR_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  'restrauque-secure-qr-hmac-salt-key-default-256';

/**
 * Deterministically derives a 256-bit cryptographically secure, URL-safe QR token
 * for a specific table and QR code record using HMAC-SHA256 with the server-side secret.
 */
export function deriveDeterministicQrToken(tableId: string, qrCodeId: string): string {
  const hmac = crypto.createHmac('sha256', QR_SECRET);
  hmac.update(`restrauque:qr:${tableId.toLowerCase().trim()}:${qrCodeId.toLowerCase().trim()}`);
  return hmac.digest('base64url');
}

/**
 * Generates a cryptographically secure, URL-safe random QR token with 256 bits of entropy.
 * If tableId and qrCodeId are supplied, generates a deterministically recoverable token.
 */
export function generateSecureQrToken(tableId?: string, qrCodeId?: string): string {
  if (tableId && qrCodeId) {
    return deriveDeterministicQrToken(tableId, qrCodeId);
  }
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
 * Fails safely and clearly in production if required origin configuration is missing.
 */
export function buildPublicQrUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!baseUrl && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing required NEXT_PUBLIC_APP_URL or APP_URL production configuration for QR URL generation'
    );
  }
  const effectiveBaseUrl = baseUrl || 'http://localhost:3000';
  return `${effectiveBaseUrl.replace(/\/+$/, '')}/qr/${encodeURIComponent(token)}`;
}

/**
 * Generates a PNG Data URL representing the QR code for display or preview.
 */
export async function generateQrCodeDataUrl(
  content: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
    ...options,
  });
}

/**
 * Generates an SVG string representing the QR code for crisp scaling and printing.
 */
export async function generateQrCodeSvg(
  content: string,
  options?: QRCode.QRCodeToStringOptions
): Promise<string> {
  return QRCode.toString(content, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
    ...options,
  });
}

/**
 * Generates a binary PNG Buffer representing the QR code for file downloads.
 */
export async function generateQrCodeBuffer(
  content: string,
  options?: QRCode.QRCodeToBufferOptions
): Promise<Buffer> {
  return QRCode.toBuffer(content, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
    ...options,
  });
}
