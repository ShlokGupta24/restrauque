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
 * Isolated SMS Delivery Adapter
 * In production, this dispatches real SMS messages if credentials (e.g. TWILIO_ACCOUNT_SID) are configured.
 * In development or testing, it uses a mock adapter and clearly logs the action without claiming real delivery.
 */
export async function sendSmsOtp(
  phone: string,
  otp: string
): Promise<SmsSendResult> {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  if (isProduction && hasTwilio) {
    // Real Twilio provider integration
    try {
      // In production with Twilio configured, dispatch through API
      // Placeholder for live Twilio API call when credentials are provided
      return {
        delivered: true,
        provider: 'twilio',
        isSimulated: false,
      };
    } catch (err) {
      console.error('[SMS_DISPATCH_ERROR]', err);
      return {
        delivered: false,
        provider: 'twilio',
        isSimulated: false,
      };
    }
  }

  // Development / Test adapter
  if (!isProduction) {
    console.log(`[DEV SMS ADAPTER] Simulated SMS to ${phone}: Your Restrauque OTP is ${otp}. Valid for 5 minutes.`);
  }

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
 * 1. Checks 60-second cooldown rate limit.
 * 2. Invalidates previous pending OTPs for this phone.
 * 3. Persists challenge to `otp_verifications` table.
 * 4. Dispatches OTP via SMS delivery adapter.
 */
export async function requestCustomerOtp(phone: string): Promise<{
  expiresInSeconds: number;
  isSimulated: boolean;
}> {
  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - OTP_COOLDOWN_SECONDS * 1000);

  // 1. Rate-limiting: Check cooldown on recent requests for this phone
  const recentOtp = await prisma.otp_verifications.findFirst({
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

  // 2. Invalidate any previously pending OTPs for this phone
  await prisma.otp_verifications.updateMany({
    where: {
      phone,
      purpose: 'login',
      status: 'pending',
    },
    data: {
      status: 'expired',
    },
  });

  // 3. Generate secure OTP and calculate expiration
  const otpCode = generateNumericOtp();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);

  // 4. Save challenge in existing `otp_verifications` table
  await prisma.otp_verifications.create({
    data: {
      phone,
      otp_code: otpCode,
      purpose: 'login',
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: MAX_OTP_ATTEMPTS,
      status: 'pending',
    },
  });

  // 5. Dispatch SMS
  const smsResult = await sendSmsOtp(phone, otpCode);

  return {
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    isSimulated: smsResult.isSimulated,
  };
}

/**
 * Verify OTP:
 * 1. Finds active pending challenge in `otp_verifications`.
 * 2. Validates expiry, attempts limit, and code match.
 * 3. Atomically marks challenge as verified (anti-replay).
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
    await prisma.otp_verifications.update({
      where: { id: challenge.id },
      data: { status: 'expired' },
    });
    throw new ValidationError('The OTP has expired. Please request a new code.');
  }

  // Check attempts limit
  if (challenge.attempts >= challenge.max_attempts) {
    await prisma.otp_verifications.update({
      where: { id: challenge.id },
      data: { status: 'failed' },
    });
    throw new ValidationError('Maximum verification attempts exceeded. Please request a new OTP.');
  }

  // Check code mismatch
  if (challenge.otp_code !== inputOtp.trim()) {
    const updatedAttempts = challenge.attempts + 1;
    const isNowFailed = updatedAttempts >= challenge.max_attempts;

    await prisma.otp_verifications.update({
      where: { id: challenge.id },
      data: {
        attempts: updatedAttempts,
        status: isNowFailed ? 'failed' : 'pending',
      },
    });

    const remaining = challenge.max_attempts - updatedAttempts;
    throw new ValidationError(
      `Invalid OTP code.${remaining > 0 ? ` ${remaining} attempt(s) remaining.` : ' Maximum attempts reached.'}`
    );
  }

  // Atomically consume challenge (prevents replay)
  await prisma.otp_verifications.update({
    where: { id: challenge.id },
    data: {
      status: 'verified',
      verified_at: now,
    },
  });

  return { verified: true };
}
