import {
  EmailNotificationProvider,
  EmailDispatchResult,
} from './types';

/**
 * Masks email addresses for secure logging (e.g. j***e@example.com).
 */
export function maskEmailAddress(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Pluggable Email Notification Provider
 * Verifies explicit configuration and safely reports deployment prerequisites when unconfigured.
 */
export class StandardEmailNotificationProvider implements EmailNotificationProvider {
  readonly name = 'standard_email';
  readonly isConfigured: boolean;

  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey?: string, fromEmail?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || '';
    this.fromEmail = fromEmail || process.env.EMAIL_FROM || 'orders@restrauque.com';
    this.isConfigured = Boolean(this.apiKey && this.fromEmail);
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent: string
  ): Promise<EmailDispatchResult> {
    if (!this.isConfigured) {
      console.warn(
        `[EMAIL_DISPATCH_SKIPPED] Email delivery skipped: No email provider configured. Recipient: ${maskEmailAddress(to)}`
      );
      return {
        messageId: '',
        status: 'failed',
        isSimulated: false,
        error: 'Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM in environment.',
      };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to,
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (!res.ok) {
        let errJson: any = {};
        try {
          errJson = await res.json();
        } catch {}
        console.error('[EMAIL_DISPATCH_FAILURE]', {
          status: res.status,
          recipient: maskEmailAddress(to),
        });
        return {
          messageId: '',
          status: 'failed',
          isSimulated: false,
          error: errJson.message || `Email provider returned status ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        messageId: data.id || `email_${Date.now()}`,
        status: 'sent',
        isSimulated: false,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown network error';
      console.error('[EMAIL_DISPATCH_NETWORK_ERROR]', errorMessage);
      return {
        messageId: '',
        status: 'failed',
        isSimulated: false,
        error: `Network error: ${errorMessage}`,
      };
    }
  }
}

/**
 * Mock Email Notification Provider
 * Used in test mode and local dev simulation.
 */
export class MockEmailNotificationProvider implements EmailNotificationProvider {
  readonly name = 'dev_mock_email';
  readonly isConfigured = true;

  async sendEmail(
    to: string,
    subject: string,
    _htmlContent: string,
    textContent: string
  ): Promise<EmailDispatchResult> {
    console.log(`[DEV EMAIL NOTIFICATION] To: ${maskEmailAddress(to)} | Subject: "${subject}" | Content: "${textContent.slice(0, 80)}..."`);
    return {
      messageId: `mock_email_${Date.now()}`,
      status: 'sent',
      isSimulated: true,
    };
  }
}

// Test injection hook
let testEmailProviderOverride: EmailNotificationProvider | null = null;

export function setEmailNotificationProviderForTesting(provider: EmailNotificationProvider | null): void {
  testEmailProviderOverride = provider;
}

export function getActiveEmailNotificationProvider(): EmailNotificationProvider {
  if (testEmailProviderOverride) {
    return testEmailProviderOverride;
  }

  if (process.env.NODE_ENV === 'test') {
    return new MockEmailNotificationProvider();
  }

  return new StandardEmailNotificationProvider();
}
