import { AppError } from '@/lib/http/errors';
import {
  SmsNotificationProvider,
  SmsDispatchResult,
} from './types';

/**
 * Masks phone numbers for secure logging (e.g. +91*****43210).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length <= 6) return '***';
  return phone.slice(0, 3) + '*****' + phone.slice(-4);
}

/**
 * Twilio Programmable SMS Notification Provider
 * Delivers transactional order completion messages via Twilio REST API.
 */
export class TwilioSmsNotificationProvider implements SmsNotificationProvider {
  readonly name = 'twilio_sms';

  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private messagingServiceSid: string;

  constructor(
    accountSid?: string,
    authToken?: string,
    fromNumber?: string,
    messagingServiceSid?: string
  ) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = fromNumber || process.env.TWILIO_PHONE_NUMBER || '';
    this.messagingServiceSid = messagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID || '';

    if (!this.accountSid || !this.authToken || (!this.fromNumber && !this.messagingServiceSid)) {
      throw new AppError(
        'Twilio SMS is not fully configured. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID are required.',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }
  }

  async sendSms(to: string, message: string): Promise<SmsDispatchResult> {
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const bodyParams: Record<string, string> = {
      To: to,
      Body: message,
    };

    if (this.messagingServiceSid) {
      bodyParams.MessagingServiceSid = this.messagingServiceSid;
    } else {
      bodyParams.From = this.fromNumber;
    }

    const body = new URLSearchParams(bodyParams);

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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown network error';
      console.error('[SMS_DISPATCH_NETWORK_ERROR] Network request to Twilio failed:', errorMessage);
      return {
        messageId: '',
        status: 'failed',
        isSimulated: false,
        error: `Network error: ${errorMessage}`,
      };
    }

    if (!res.ok) {
      let errorData: { code?: number; message?: string } = {};
      try {
        errorData = await res.json();
      } catch {}

      console.error('[SMS_DISPATCH_FAILURE]', {
        status: res.status,
        code: errorData.code,
        recipient: maskPhoneNumber(to),
      });

      const failureReason = errorData.message || `Twilio error status ${res.status}`;
      return {
        messageId: '',
        status: 'failed',
        isSimulated: false,
        error: failureReason,
      };
    }

    const data = await res.json();
    return {
      messageId: data.sid || '',
      status: data.status === 'queued' ? 'queued' : 'sent',
      isSimulated: false,
    };
  }
}

/**
 * Mock SMS Notification Provider
 * Used in test mode and local dev simulation without calling external telecom networks.
 */
export class MockSmsNotificationProvider implements SmsNotificationProvider {
  readonly name = 'dev_mock_sms';

  async sendSms(to: string, message: string): Promise<SmsDispatchResult> {
    console.log(`[DEV SMS NOTIFICATION] To: ${maskPhoneNumber(to)} | Body: "${message}"`);
    return {
      messageId: `mock_sms_${Date.now()}`,
      status: 'sent',
      isSimulated: true,
    };
  }
}

// Test injection hook
let testSmsProviderOverride: SmsNotificationProvider | null = null;

export function setSmsNotificationProviderForTesting(provider: SmsNotificationProvider | null): void {
  testSmsProviderOverride = provider;
}

export function getActiveSmsNotificationProvider(): SmsNotificationProvider {
  if (testSmsProviderOverride) {
    return testSmsProviderOverride;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const isDummy = accountSid.startsWith('AC_dummy');

  if (isDummy || process.env.NODE_ENV === 'test') {
    return new MockSmsNotificationProvider();
  }

  const hasTwilioCredentials = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );

  if (hasTwilioCredentials) {
    return new TwilioSmsNotificationProvider();
  }

  // Graceful fallback for non-production environments
  return new MockSmsNotificationProvider();
}
