/**
 * Restrauque Customer Authentication Service
 * Communicates with Next.js backend auth endpoints using typed apiClient:
 * - POST /api/v1/auth/customer/otp/request
 * - POST /api/v1/auth/customer/otp/verify
 * - GET  /api/v1/auth/me
 * - POST /api/v1/auth/customer/logout
 */
import { apiClient, ApiClientError } from './apiClient.ts';

export interface SafeUser {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  role: 'CUSTOMER' | 'RESTAURANT_OWNER' | 'ADMIN' | 'STAFF';
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOtpRequestResponse {
  message: string;
  phone: string;
  expiresInSeconds: number;
  retryAfter?: number;
  simulated?: boolean;
}

export interface CustomerOtpVerifyResponse {
  user: SafeUser;
  token: string;
}

export interface CustomerMeResponse {
  user: SafeUser;
}

export interface CustomerLogoutResponse {
  message: string;
}

/**
 * Normalizes input phone to standard E.164 (+91 for 10-digit Indian mobile numbers).
 */
export function formatCustomerPhone(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // 10-digit Indian mobile number (starts with 6, 7, 8, or 9)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // 12-digit Indian number starting with 91
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // General international digits
  return `+${cleaned}`;
}

/**
 * Checks whether the input is a valid 10-digit Indian mobile number.
 */
export function isValidCustomerPhone(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^91[6-9]\d{9}$/.test(digits);
  }
  return false;
}

/**
 * Request an OTP challenge from the backend for the given mobile number.
 */
export async function requestCustomerOtp(
  phone: string,
  signal?: AbortSignal
): Promise<CustomerOtpRequestResponse> {
  const formatted = formatCustomerPhone(phone);
  if (!formatted || formatted.length < 10) {
    throw new ApiClientError(
      'Please enter a valid 10-digit mobile number.',
      400,
      'INVALID_PHONE'
    );
  }

  return await apiClient.post<CustomerOtpRequestResponse>(
    '/api/v1/auth/customer/otp/request',
    { phone: formatted },
    { signal }
  );
}

/**
 * Verify an OTP challenge with the backend and establish customer session.
 * Maps frontend OTP to backend 'otp' property (not 'otpCode') and supports optional signup name.
 */
export async function verifyCustomerOtp(
  phone: string,
  otp: string,
  name?: string,
  signal?: AbortSignal
): Promise<CustomerOtpVerifyResponse> {
  const formattedPhone = formatCustomerPhone(phone);
  const trimmedOtp = otp ? otp.trim() : '';

  if (!/^\d{6}$/.test(trimmedOtp)) {
    throw new ApiClientError(
      'OTP code must be a 6-digit number.',
      400,
      'INVALID_OTP_FORMAT'
    );
  }

  const payload: { phone: string; otp: string; name?: string } = {
    phone: formattedPhone,
    otp: trimmedOtp,
  };

  if (name && name.trim().length >= 2) {
    payload.name = name.trim();
  }

  return await apiClient.post<CustomerOtpVerifyResponse>(
    '/api/v1/auth/customer/otp/verify',
    payload,
    { signal }
  );
}

/**
 * Restores existing authenticated customer session from HttpOnly cookie via GET /api/v1/auth/me.
 * Returns SafeUser if authenticated, or null if unauthenticated (HTTP 401).
 * Re-throws network or unexpected errors.
 */
export async function restoreCustomerSession(
  signal?: AbortSignal
): Promise<SafeUser | null> {
  try {
    const data = await apiClient.get<CustomerMeResponse>(
      '/api/v1/auth/me',
      { signal }
    );
    if (data && data.user && data.user.status === 'active') {
      return data.user;
    }
    return null;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      // HTTP 401 UNAUTHORIZED represents a normal signed-out state
      if (err.status === 401) {
        return null;
      }
      if (err.code === 'ABORTED') {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Invalidates customer session in backend database and clears HttpOnly session cookie.
 */
export async function logoutCustomer(
  signal?: AbortSignal
): Promise<CustomerLogoutResponse> {
  try {
    return await apiClient.post<CustomerLogoutResponse>(
      '/api/v1/auth/customer/logout',
      {},
      { signal }
    );
  } catch (err: unknown) {
    // If the server returns 401, session was already invalid/expired
    if (err instanceof ApiClientError && err.status === 401) {
      return { message: 'Customer already logged out.' };
    }
    throw err;
  }
}
