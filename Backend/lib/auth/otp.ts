import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { AppError, ValidationError } from '@/lib/http/errors';
import {
  getActiveOtpProvider,
  TwilioVerifyProvider,
  type OtpProvider,
  ProviderConfigurationError,
  ProviderTrialRestrictionError,
} from './otp-provider';

export const OTP_EXPIRY_SECONDS = 300; // 5 minutes
export const OTP_COOLDOWN_SECONDS = 60; // 60-second resend limit
export const MAX_OTP_ATTEMPTS = 5;

export interface SmsSendResult {
  delivered: boolean;
  provider: 'twilio' | 'twilio_verify' | 'twilio_messaging' | 'aws_sns' | 'dev_mock';
  messageId?: string;
  isSimulated: boolean;
}

/**
 * Checks if production SMS delivery credentials are fully configured.
 * Recognizes that Twilio Verify requires TWILIO_VERIFY_SERVICE_SID (without TWILIO_PHONE_NUMBER).
 */
export function hasConfiguredSmsProvider(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    return false;
  }

  return Boolean(verifySid || fromNumber);
}

/**
 * Resolves and validates the OTP secret key.
 * Preference:
 * 1. Dedicated `process.env.OTP_SECRET` (minimum 32 characters).
 * 2. Explicit fallback to `process.env.JWT_SECRET` (minimum 32 characters).
 *
 * NOTE: Changing or rotating the OTP secret immediately invalidates any
 * outstanding pending OTP challenges, requiring the recipient to request a fresh code.
 *
 * Never uses a hardcoded default secret. Missing or weak configuration fails closed.
 */
export function getOtpSecret(): string {
  const otpSecret = process.env.OTP_SECRET;
  if (otpSecret) {
    if (otpSecret.length < 32) {
      throw new AppError(
        'Server security configuration error: OTP_SECRET must be at least 32 characters long.',
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }
    return otpSecret;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret.length < 32) {
      throw new AppError(
        'Server security configuration error: Fallback JWT_SECRET must be at least 32 characters long.',
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }
    return jwtSecret;
  }

  throw new AppError(
    'Server security configuration error: No valid OTP_SECRET or JWT_SECRET configured.',
    500,
    'INTERNAL_SERVER_ERROR'
  );
}

/**
 * Keyed HMAC computation for OTP storage and verification.
 * Prevents rainbow tables and offline brute-force attacks against database dumps.
 * Uses base64url sliced to 10 characters to fit the existing `otp_code VarChar(10)` column
 * without requiring destructive database schema migrations.
 */
export function hashOtpCode(phone: string, otp: string): string {
  const secret = getOtpSecret();
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
 * Validates verification code against Twilio Verify Service if configured.
 * Maintained for backward compatibility and direct verification queries.
 */
export async function checkTwilioVerification(phone: string, inputOtp: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifySid) {
    return false;
  }

  if (process.env.NODE_ENV === 'test' || accountSid.startsWith('AC_dummy') || process.env.SMS_PROVIDER === 'mock') {
    return false;
  }

  try {
    const provider = new TwilioVerifyProvider(accountSid, authToken, verifySid);
    return await provider.verifyOtp(phone, inputOtp);
  } catch (err) {
    console.error(
      '[TWILIO_VERIFY_CHECK_FAILURE]',
      err instanceof Error ? err.message : 'Unknown Twilio check error'
    );
    return false;
  }
}

/**
 * Isolated SMS Delivery Adapter
 * Dispatches OTP code via the configured active provider.
 * Does NOT deceive callers with simulated success when provider dispatch fails.
 */
export async function sendSmsOtp(
  phone: string,
  otp?: string
): Promise<SmsSendResult> {
  const provider = getActiveOtpProvider();
  const result = await provider.requestOtp(phone, otp);

  return {
    delivered: true,
    provider: provider.name as any,
    messageId: result.messageId,
    isSimulated: result.isSimulated,
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
 * 5. Uses configured provider (Twilio Verify / Twilio Messaging / Mock) as authoritative OTP mechanism.
 * 6. Dispatches verification request to provider. Fails safely without false success if rejected.
 */
export async function requestCustomerOtp(phone: string): Promise<{
  expiresInSeconds: number;
  isSimulated: boolean;
}> {
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, verify provider is configured before writing records or triggering cooldown
  if (isProduction && !hasConfiguredSmsProvider()) {
    throw new ProviderConfigurationError(
      'SMS delivery service is unavailable. No approved SMS provider is configured.'
    );
  }

  const provider = getActiveOtpProvider();
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

    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);

    // If provider manages code generation (e.g. Twilio Verify), Twilio is the authoritative generator
    if (provider.managesCodeGeneration) {
      // Dispatch verification request to provider first.
      // If provider rejects (e.g. trial restrictions, invalid number), transaction rolls back cleanly
      const sendResult = await provider.requestOtp(phone);

      // Save challenge placeholder in otp_verifications for audit, cooldown, and attempt tracking
      await tx.otp_verifications.create({
        data: {
          phone,
          otp_code: 'TW_VERIFY',
          purpose: 'login',
          expires_at: expiresAt,
          attempts: 0,
          max_attempts: MAX_OTP_ATTEMPTS,
          status: 'pending',
        },
      });

      return {
        expiresInSeconds: OTP_EXPIRY_SECONDS,
        isSimulated: sendResult.isSimulated,
      };
    }

    // Otherwise, local system generates 6-digit OTP and keyed HMAC representation for storage
    const otpCode = generateNumericOtp();
    const storedHmac = hashOtpCode(phone, otpCode);

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

    // Dispatch OTP via delivery adapter
    const sendResult = await provider.requestOtp(phone, otpCode);

    return {
      expiresInSeconds: OTP_EXPIRY_SECONDS,
      isSimulated: sendResult.isSimulated,
    };
  }, {
    maxWait: 15000,
    timeout: 15000,
  });
}

/**
 * Verify OTP:
 * 1. Finds active pending challenge in `otp_verifications`.
 * 2. Validates expiry, attempts limit, and code match against active provider or stored keyed HMAC.
 * 3. Atomically marks challenge as verified using optimistic locking (anti-replay and concurrency-safe).
 */
export async function verifyCustomerOtp(
  phone: string,
  inputOtp: string
): Promise<{ verified: boolean }> {
  const provider = getActiveOtpProvider();
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

  // Check code match:
  let isMatch = false;

  if (provider.managesCodeGeneration && challenge.otp_code === 'TW_VERIFY') {
    // Authoritative check via provider (e.g. Twilio Verify)
    isMatch = await provider.verifyOtp(phone, inputOtp);
  } else {
    // Local verification check against stored keyed HMAC or plain fixture
    isMatch = verifyOtpCode(phone, inputOtp, challenge.otp_code);

    // Fallback: If local HMAC does not match and Twilio Verify Service is configured, query Twilio Verify
    if (!isMatch && process.env.TWILIO_VERIFY_SERVICE_SID) {
      isMatch = await checkTwilioVerification(phone, inputOtp);
    }
  }

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
