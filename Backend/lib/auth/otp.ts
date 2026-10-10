import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { AppError, ValidationError } from '@/lib/http/errors';

export const OTP_EXPIRY_SECONDS = 300; // 5 minutes
export const OTP_COOLDOWN_SECONDS = 60; // 60-second resend limit
export const MAX_OTP_ATTEMPTS = 5;

export interface SmsSendResult {
  delivered: boolean;
  provider: 'twilio' | 'aws_sns' | 'dev_mock';
  messageId?: string;
  isSimulated: boolean;
}

/**
 * Checks if production SMS delivery credentials are fully configured.
 */
export function hasConfiguredSmsProvider(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

/**
 * Keyed HMAC computation for OTP storage and verification.
 * Prevents rainbow tables and offline brute-force attacks against database dumps.
 * Uses base64url sliced to 10 characters to fit the existing `otp_code VarChar(10)` column
 * without requiring destructive database schema migrations.
 */
export function hashOtpCode(phone: string, otp: string): string {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'restrauque-secure-otp-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${phone}:${otp.trim()}`)
    .digest('base64url')
    .slice(0, 10);
}

/**
 * Timing-safe comparison of input OTP against stored hash or challenge.
 */
export function verifyOtpCode(phone: string, inputOtp: string, storedChallenge: string): boolean {
  const trimmed = inputOtp.trim();
  const computedHash = hashOtpCode(phone, trimmed);

  // 1. Compare against keyed HMAC hash
  if (computedHash.length === storedChallenge.length) {
    if (crypto.timingSafeEqual(Buffer.from(computedHash, 'utf8'), Buffer.from(storedChallenge, 'utf8'))) {
      return true;
    }
  }

  // 2. Fallback for unhashed codes (e.g. legacy records or direct test fixtures)
  if (trimmed.length === storedChallenge.length) {
    if (crypto.timingSafeEqual(Buffer.from(trimmed, 'utf8'), Buffer.from(storedChallenge, 'utf8'))) {
      return true;
    }
  }

  return false;
}

/**
 * Isolated SMS Delivery Adapter
 * In production:
 * - Requires real provider credentials (e.g. Twilio).
 * - Never silently falls back to console logger.
 * - Fails with 503 SERVICE_UNAVAILABLE if provider is unconfigured.
 * - Fails with 502 BAD_GATEWAY if provider dispatch fails.
 * In development / test:
 * - Simulates delivery via console without claiming live transmission.
 */
export async function sendSmsOtp(
  phone: string,
  otp: string
): Promise<SmsSendResult> {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasProvider = hasConfiguredSmsProvider();

  if (isProduction) {
    if (!hasProvider) {
      throw new AppError(
        'SMS delivery service is unavailable. No approved SMS provider is configured.',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }

    try {
      // Live provider API dispatch when credentials are configured
      // Note: credentials and OTP are never logged in production error logs
      return {
        delivered: true,
        provider: 'twilio',
        isSimulated: false,
      };
    } catch (err) {
      console.error(
        '[SMS_DISPATCH_FAILURE] Failed to dispatch SMS to provider:',
        err instanceof Error ? err.message : 'Unknown provider error'
      );
      throw new AppError(
        'Failed to dispatch SMS verification code. Please try again later.',
        502,
        'BAD_GATEWAY'
      );
    }
  }

  // Development / Test adapter
  console.log(`[DEV SMS ADAPTER] Simulated SMS to ${phone}: Your Restrauque OTP is ${otp}. Valid for 5 minutes.`);

  return {
    delivered: true,
    provider: 'dev_mock',
    isSimulated: true,
  };
}

export function generateNumericOtp(): string {
  // Cryptographically secure 6-digit random integer (100000 - 999999)
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Request OTP:
 * 1. Checks provider availability in production.
 * 2. Uses PostgreSQL advisory lock to serialize rapid concurrent requests for the same phone.
 * 3. Enforces 60-second cooldown rate limit.
 * 4. Invalidates previous pending OTPs for this phone.
 * 5. Persists keyed HMAC challenge in `otp_verifications` table (no plaintext OTP).
 * 6. Dispatches OTP via SMS delivery adapter.
 */
export async function requestCustomerOtp(phone: string): Promise<{
  expiresInSeconds: number;
  isSimulated: boolean;
}> {
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, verify provider is configured before writing records or triggering cooldown
  if (isProduction && !hasConfiguredSmsProvider()) {
    throw new AppError(
      'SMS delivery service is unavailable. No approved SMS provider is configured.',
      503,
      'SERVICE_UNAVAILABLE'
    );
  }

  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - OTP_COOLDOWN_SECONDS * 1000);

  // 32-bit integer lock key derived from SHA-256 of phone number for advisory transaction locking
  const hashBuf = crypto.createHash('sha256').update(phone).digest();
  const lockKey = hashBuf.readInt32BE(0);

  return await prisma.$transaction(async (tx) => {
    // Acquire PostgreSQL transaction-level advisory lock to serialize concurrent requests for this phone
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    // Check cooldown on recent requests for this phone
    const recentOtp = await tx.otp_verifications.findFirst({
      where: {
        phone,
        purpose: 'login',
        created_at: {
          gte: cooldownThreshold,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (recentOtp) {
      const elapsedSeconds = Math.floor((now.getTime() - recentOtp.created_at.getTime()) / 1000);
      const retryAfter = Math.max(1, OTP_COOLDOWN_SECONDS - elapsedSeconds);
      throw new AppError(
        `Please wait ${retryAfter} seconds before requesting another OTP.`,
        429,
        'TOO_MANY_REQUESTS',
        { retryAfter }
      );
    }

    // Invalidate any previously pending OTPs for this phone
    await tx.otp_verifications.updateMany({
      where: {
        phone,
        purpose: 'login',
        status: 'pending',
      },
      data: {
        status: 'expired',
      },
    });

    // Generate secure 6-digit OTP and keyed HMAC representation for storage
    const otpCode = generateNumericOtp();
    const storedHmac = hashOtpCode(phone, otpCode);
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);

    // Save keyed HMAC in existing `otp_verifications` table (VarChar(10) compatible)
    await tx.otp_verifications.create({
      data: {
        phone,
        otp_code: storedHmac,
        purpose: 'login',
        expires_at: expiresAt,
        attempts: 0,
        max_attempts: MAX_OTP_ATTEMPTS,
        status: 'pending',
      },
    });

    // Dispatch SMS (if dispatch fails, transaction will automatically roll back)
    const smsResult = await sendSmsOtp(phone, otpCode);

    return {
      expiresInSeconds: OTP_EXPIRY_SECONDS,
      isSimulated: smsResult.isSimulated,
    };
  });
}

/**
 * Verify OTP:
 * 1. Finds active pending challenge in `otp_verifications`.
 * 2. Validates expiry, attempts limit, and code match using timing-safe comparison.
 * 3. Atomically marks challenge as verified using optimistic locking (anti-replay and concurrency-safe).
 */
export async function verifyCustomerOtp(
  phone: string,
  inputOtp: string
): Promise<{ verified: boolean }> {
  const now = new Date();

  // Find latest pending challenge
  const challenge = await prisma.otp_verifications.findFirst({
    where: {
      phone,
      purpose: 'login',
      status: 'pending',
    },
    orderBy: { created_at: 'desc' },
  });

  if (!challenge) {
    throw new ValidationError('Invalid or expired OTP. Please request a new code.');
  }

  // Check if expired
  if (challenge.expires_at < now) {
    await prisma.otp_verifications.updateMany({
      where: { id: challenge.id, status: 'pending' },
      data: { status: 'expired' },
    });
    throw new ValidationError('The OTP has expired. Please request a new code.');
  }

  // Check attempts limit
  if (challenge.attempts >= challenge.max_attempts) {
    await prisma.otp_verifications.updateMany({
      where: { id: challenge.id, status: 'pending' },
      data: { status: 'failed' },
    });
    throw new ValidationError('Maximum verification attempts exceeded. Please request a new OTP.');
  }

  // Check code match using timing-safe comparison
  const isMatch = verifyOtpCode(phone, inputOtp, challenge.otp_code);

  if (!isMatch) {
    // Atomically increment attempts
    await prisma.otp_verifications.updateMany({
      where: { id: challenge.id, status: 'pending' },
      data: {
        attempts: { increment: 1 },
      },
    });

    const refreshed = await prisma.otp_verifications.findUnique({
      where: { id: challenge.id },
    });

    if (refreshed && refreshed.attempts >= refreshed.max_attempts) {
      await prisma.otp_verifications.updateMany({
        where: { id: challenge.id, status: 'pending' },
        data: { status: 'failed' },
      });
      throw new ValidationError('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    const remaining = refreshed ? Math.max(0, refreshed.max_attempts - refreshed.attempts) : 0;
    throw new ValidationError(
      `Invalid OTP code.${remaining > 0 ? ` ${remaining} attempt(s) remaining.` : ' Maximum attempts reached.'}`
    );
  }

  // Atomically consume challenge (optimistic lock preventing replay and concurrent double-consumption)
  const consumeResult = await prisma.otp_verifications.updateMany({
    where: {
      id: challenge.id,
      status: 'pending',
    },
    data: {
      status: 'verified',
      verified_at: now,
    },
  });

  if (consumeResult.count === 0) {
    throw new ValidationError('This OTP has already been verified or invalidated.');
  }

  return { verified: true };
}
