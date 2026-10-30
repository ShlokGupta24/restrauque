import { AppError, ValidationError } from '@/lib/http/errors';

export interface OtpRequestResult {
  messageId: string;
  status: 'pending' | 'sent';
  isSimulated: boolean;
}

export interface OtpProvider {
  readonly name: string;
  readonly managesCodeGeneration: boolean;
  requestOtp(phoneNumber: string, code?: string): Promise<OtpRequestResult>;
  verifyOtp(phoneNumber: string, code: string): Promise<boolean>;
}

export class ProviderTrialRestrictionError extends AppError {
  constructor(
    message = 'SMS delivery is restricted by the Twilio trial account. Customer numbers cannot receive OTPs until the Twilio account is upgraded or the recipient number is verified in the Twilio Console.'
  ) {
    super(message, 403, 'PROVIDER_TRIAL_RESTRICTION');
    this.name = 'ProviderTrialRestrictionError';
  }
}

export class ProviderConfigurationError extends AppError {
  constructor(
    message = 'SMS delivery service is unavailable due to missing or invalid provider configuration.'
  ) {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ProviderConfigurationError';
  }
}

/**
 * Sanitizes phone numbers for logging (e.g. +91*****43210) to protect customer privacy.
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length <= 6) return '***';
  return phone.slice(0, 3) + '*****' + phone.slice(-4);
}

/**
 * Twilio Verify Provider
 * Uses Twilio's official Verify V2 API.
 * - Handles code generation and delivery via international carrier routes.
 * - Verifies submitted codes through Twilio's authoritative VerificationCheck endpoint.
 * - Maps Twilio trial restrictions, rate limits, and compliance errors safely.
 */
export class TwilioVerifyProvider implements OtpProvider {
  readonly name = 'twilio_verify';
  readonly managesCodeGeneration = true;

  private accountSid: string;
  private authToken: string;
  private verifySid: string;

  constructor(accountSid?: string, authToken?: string, verifySid?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.verifySid = verifySid || process.env.TWILIO_VERIFY_SERVICE_SID || '';

    if (!this.accountSid || !this.authToken || !this.verifySid) {
      throw new ProviderConfigurationError(
        'Twilio Verify is not fully configured. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID are required.'
      );
    }
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
  }

  async requestOtp(phoneNumber: string): Promise<OtpRequestResult> {
    const authHeader = this.getAuthHeader();
    const url = `https://verify.twilio.com/v2/Services/${this.verifySid}/Verifications`;

    const body = new URLSearchParams({
      To: phoneNumber,
      Channel: 'sms',
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (err) {
      console.error(
        '[TWILIO_VERIFY_NETWORK_ERROR] Network request to Twilio Verify failed:',
        err instanceof Error ? err.message : 'Unknown network error'
      );
      throw new AppError(
        'Unable to reach SMS verification provider. Please check network connection and try again.',
        502,
        'BAD_GATEWAY'
      );
    }

    if (!res.ok) {
      let errorData: { code?: number; message?: string; status?: number } = {};
      try {
        errorData = await res.json();
      } catch {
        // Non-JSON response
      }

      console.error('[TWILIO_VERIFY_DISPATCH_FAILURE]', {
        status: res.status,
        code: errorData.code,
        recipient: maskPhoneNumber(phoneNumber),
      });

      // Twilio Error 21608: Trial account unverified recipient
      // Twilio Verify Error 60200: Can also occur for unverified trial recipient numbers
      if (
        errorData.code === 21608 ||
        (errorData.code === 60200 &&
          (errorData.message?.toLowerCase().includes('trial') ||
            errorData.message?.toLowerCase().includes('unverified')))
      ) {
        throw new ProviderTrialRestrictionError(
          'SMS delivery is restricted by the Twilio trial account. Customer numbers cannot receive OTPs until the Twilio account is upgraded or the recipient number is verified in the Twilio Console.'
        );
      }

      // Twilio Error 60203: Max send attempts reached
      if (errorData.code === 60203 || res.status === 429) {
        throw new AppError(
          'Too many verification requests sent to this phone number. Please wait a few minutes before trying again.',
          429,
          'TOO_MANY_REQUESTS',
          { retryAfter: 600 }
        );
      }

      // Twilio Error 21211 or 21614: Invalid phone number format / not SMS capable
      if (errorData.code === 21211 || errorData.code === 21614) {
        throw new ValidationError('The specified phone number is invalid or cannot receive SMS messages.');
      }

      // Twilio Error 21408: Geographic permission not enabled
      if (errorData.code === 21408) {
        throw new AppError(
          'SMS delivery to this country or region has not been enabled in the provider console. Please enable SMS Geographic Permissions in Twilio.',
          502,
          'PROVIDER_GEO_RESTRICTED'
        );
      }

      // Twilio Error 20003: Provider authentication failure
      if (errorData.code === 20003 || res.status === 401) {
        throw new AppError(
          'SMS provider authentication failed. Please verify server provider credentials.',
          503,
          'SERVICE_UNAVAILABLE'
        );
      }

      // Twilio Error 20404: Service SID not found
      if (errorData.code === 20404 || res.status === 404) {
        throw new AppError(
          'Twilio Verify service was not found. Please verify TWILIO_VERIFY_SERVICE_SID configuration.',
          503,
          'SERVICE_UNAVAILABLE'
        );
      }

      // Safe fallback for other provider errors
      throw new AppError(
        'Failed to dispatch verification code via SMS provider. Please try again later.',
        502,
        'BAD_GATEWAY'
      );
    }

    const data = await res.json();
    return {
      messageId: data.sid,
      status: data.status === 'pending' ? 'pending' : 'sent',
      isSimulated: false,
    };
  }

  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    const authHeader = this.getAuthHeader();
    const url = `https://verify.twilio.com/v2/Services/${this.verifySid}/VerificationCheck`;

    const body = new URLSearchParams({
      To: phoneNumber,
      Code: code.trim(),
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (err) {
      console.error(
        '[TWILIO_VERIFY_CHECK_NETWORK_ERROR]',
        err instanceof Error ? err.message : 'Unknown network error'
      );
      return false;
    }

    if (!res.ok) {
      let errorData: { code?: number; message?: string } = {};
      try {
        errorData = await res.json();
      } catch {
        // Non-JSON response
      }

      // Twilio Error 60202: Max verification check attempts reached
      if (errorData.code === 60202) {
        throw new ValidationError('Maximum verification attempts exceeded on provider. Please request a new OTP.');
      }

      return false;
    }

    const data = await res.json();
    return data.status === 'approved';
  }
}

/**
 * Twilio Programmable Messaging Provider
 * Used when TWILIO_PHONE_NUMBER is configured instead of Twilio Verify.
 * System manages local OTP generation and verification; Twilio delivers the SMS payload.
 */
export class TwilioMessagingProvider implements OtpProvider {
  readonly name = 'twilio_messaging';
  readonly managesCodeGeneration = false;

  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid?: string, authToken?: string, fromNumber?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = fromNumber || process.env.TWILIO_PHONE_NUMBER || '';

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new ProviderConfigurationError(
        'Twilio Messaging is not fully configured. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required.'
      );
    }
  }

  async requestOtp(phoneNumber: string, code?: string): Promise<OtpRequestResult> {
    if (!code) {
      throw new AppError('An OTP code is required for programmable SMS delivery.', 500);
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: phoneNumber,
      From: this.fromNumber,
      Body: `Your Restrauque verification code is: ${code}. Valid for 5 minutes.`,
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
    } catch (err) {
      console.error('[TWILIO_MESSAGING_NETWORK_ERROR]', err instanceof Error ? err.message : 'Unknown');
      throw new AppError('Unable to reach SMS provider. Please try again later.', 502, 'BAD_GATEWAY');
    }

    if (!res.ok) {
      let errorData: { code?: number; message?: string } = {};
      try {
        errorData = await res.json();
      } catch {}

      if (errorData.code === 21608) {
        throw new ProviderTrialRestrictionError(
          'SMS delivery is restricted by the Twilio trial account. Customer numbers cannot receive OTPs until the Twilio account is upgraded or the recipient number is verified in the Twilio Console.'
        );
      }

      throw new AppError(
        'Failed to dispatch SMS verification code via Twilio.',
        502,
        'BAD_GATEWAY'
      );
    }

    const data = await res.json();
    return {
      messageId: data.sid,
      status: 'sent',
      isSimulated: false,
    };
  }

  async verifyOtp(_phoneNumber: string, _code: string): Promise<boolean> {
    // For programmable SMS, verification is performed locally against stored keyed HMAC in otp.ts
    return false;
  }
}

/**
 * Mock OTP Provider
 * Strictly opt-in for automated unit/integration testing or local dev simulation.
 * PROHIBITED in production environments unless explicitly in dummy-credential testing mode.
 */
export class MockOtpProvider implements OtpProvider {
  readonly name = 'dev_mock';
  readonly managesCodeGeneration = false;

  constructor() {
    const isDummy = (process.env.TWILIO_ACCOUNT_SID || '').startsWith('AC_dummy');
    if (process.env.NODE_ENV === 'production' && !isDummy && process.env.SMS_PROVIDER === 'mock') {
      throw new AppError(
        'Mock OTP provider is strictly prohibited in production environment.',
        500,
        'SECURITY_CONFIGURATION_ERROR'
      );
    }
  }

  async requestOtp(phoneNumber: string, code?: string): Promise<OtpRequestResult> {
    const isDummy = (process.env.TWILIO_ACCOUNT_SID || '').startsWith('AC_dummy');
    if (process.env.NODE_ENV === 'production' && !isDummy && process.env.SMS_PROVIDER === 'mock') {
      throw new AppError(
        'Mock OTP provider cannot be executed in production environment.',
        500,
        'SECURITY_CONFIGURATION_ERROR'
      );
    }

    console.log(
      `[DEV SMS ADAPTER] Simulated SMS to ${maskPhoneNumber(phoneNumber)}: Your Restrauque OTP is ${code || '******'}. Valid for 5 minutes.`
    );

    return {
      messageId: `mock_otp_msg_${Date.now()}`,
      status: 'sent',
      isSimulated: true,
    };
  }

  async verifyOtp(_phoneNumber: string, _code: string): Promise<boolean> {
    return false;
  }
}

// In-memory test override for deterministic provider injection in tests
let testProviderOverride: OtpProvider | null = null;

export function setOtpProviderForTesting(provider: OtpProvider | null): void {
  testProviderOverride = provider;
}

export function getActiveOtpProvider(): OtpProvider {
  if (testProviderOverride) {
    return testProviderOverride;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const isDummyCredentials = accountSid.startsWith('AC_dummy');

  // If dummy test credentials are provided, return mock provider directly
  if (isDummyCredentials) {
    return new MockOtpProvider();
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const hasTwilioVerify = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  );
  const hasTwilioMessaging = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  // 1. Production Mode: MUST use a real, configured telecom provider
  if (isProduction) {
    if (process.env.SMS_PROVIDER === 'mock') {
      throw new AppError(
        'Server security configuration error: SMS_PROVIDER="mock" is strictly prohibited in production.',
        500,
        'SECURITY_CONFIGURATION_ERROR'
      );
    }

    if (hasTwilioVerify) {
      return new TwilioVerifyProvider();
    }

    if (hasTwilioMessaging) {
      return new TwilioMessagingProvider();
    }

    throw new ProviderConfigurationError(
      'SMS delivery service is unavailable. No approved SMS provider is configured in production.'
    );
  }

  // 2. Test / Non-Production Mode:
  if (
    process.env.SMS_PROVIDER === 'twilio' &&
    process.env.NODE_ENV !== 'test'
  ) {
    if (hasTwilioVerify) {
      return new TwilioVerifyProvider();
    }
    if (hasTwilioMessaging) {
      return new TwilioMessagingProvider();
    }
  }

  // Fallback to explicit dev/test mock provider
  return new MockOtpProvider();
}
