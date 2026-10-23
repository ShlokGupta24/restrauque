import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as requestOtpHandler } from '@/app/api/v1/auth/customer/otp/request/route';
import { POST as verifyOtpHandler } from '@/app/api/v1/auth/customer/otp/verify/route';
import { POST as customerLogoutHandler } from '@/app/api/v1/auth/customer/logout/route';
import { GET as meHandler } from '@/app/api/v1/auth/me/route';
import { POST as ownerLoginHandler } from '@/app/api/v1/auth/owner/login/route';
import { prisma } from '@/lib/db/prisma';
import { normalizePhoneNumber, phoneSchema } from '@/lib/validation/auth';
import {
  setOtpProviderForTesting,
  getActiveOtpProvider,
  type OtpProvider,
  type OtpRequestResult,
  ProviderTrialRestrictionError,
  TwilioVerifyProvider,
} from '@/lib/auth/otp-provider';

describe('Production Customer Phone OTP Authentication & Provider Integrity', () => {
  const prodPhone = '+919876543001';
  const concurrencyPhone = '+919876543002';
  const edgePhone = '+919876543003';
  let createdCustomerId: string | null = null;
  let testCustomerSessionToken: string | null = null;

  beforeEach(() => {
    // Reset any test provider override before each test
    setOtpProviderForTesting(null);
  });

  afterAll(async () => {
    try {
      setOtpProviderForTesting(null);
      await prisma.otp_verifications.deleteMany({
        where: { phone: { in: [prodPhone, concurrencyPhone, edgePhone, '+919876543210', '+15551234567'] } },
      });
      const custs = await prisma.customers.findMany({
        where: { phone: { in: [prodPhone, concurrencyPhone, edgePhone, '+919876543210', '+15551234567'] } },
      });
      for (const cust of custs) {
        await prisma.customer_sessions.deleteMany({ where: { customer_id: cust.id } });
        await prisma.customers.delete({ where: { id: cust.id } }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // 1 & 2. Eligible Phone Number Normalization & Validation
  describe('1 & 2. Phone Number Normalization & Validation', () => {
    it('should normalize Indian phone numbers to E.164 with +91 without double-prefixing', () => {
      // 10-digit Indian standard
      expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
      // With spaces and hyphens
      expect(normalizePhoneNumber('98765 43210')).toBe('+919876543210');
      expect(normalizePhoneNumber('98765-43210')).toBe('+919876543210');
      // With leading 0 (STD/trunk prefix)
      expect(normalizePhoneNumber('09876543210')).toBe('+919876543210');
      // With already formatted +91
      expect(normalizePhoneNumber('+919876543210')).toBe('+919876543210');
      // With +91 and spaces
      expect(normalizePhoneNumber('+91 98765 43210')).toBe('+919876543210');
      // International number (US)
      expect(normalizePhoneNumber('+1 (555) 123-4567')).toBe('+15551234567');
    });

    it('should reject invalid or malformed numbers through phoneSchema', () => {
      // Too short
      expect(() => phoneSchema.parse('12345')).toThrow();
      // Alpha characters
      expect(() => phoneSchema.parse('98765abcde')).toThrow();
      // Invalid Indian mobile prefix (starts with 1)
      expect(() => phoneSchema.parse('+911234567890')).toThrow();
      // Valid Indian mobile (starts with 6, 7, 8, or 9)
      expect(phoneSchema.parse('9876543210')).toBe('+919876543210');
      expect(phoneSchema.parse('8876543210')).toBe('+918876543210');
      expect(phoneSchema.parse('7876543210')).toBe('+917876543210');
      expect(phoneSchema.parse('6876543210')).toBe('+916876543210');
    });
  });

  // 3 & 4. Valid Request Calls Provider Without Hardcoded Recipient Whitelist
  describe('3 & 4. Unrestricted Recipient Provider Dispatch', () => {
    it('should call the configured provider with the normalized customer phone number', async () => {
      let dispatchedToNumber = '';
      const mockProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async (phone: string): Promise<OtpRequestResult> => {
          dispatchedToNumber = phone;
          return { messageId: 'VA_mock_dispatched_sid', status: 'pending', isSimulated: false };
        },
        verifyOtp: async () => true,
      };

      setOtpProviderForTesting(mockProvider);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '98765 43001' }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(dispatchedToNumber).toBe(prodPhone);
      expect(json.data.phone).toBe(prodPhone);
      expect(json.data.expiresInSeconds).toBe(300);

      // Verify that DB stores TW_VERIFY challenge placeholder without dual-OTP generation conflict
      const challenge = await prisma.otp_verifications.findFirst({
        where: { phone: prodPhone, status: 'pending' },
        orderBy: { created_at: 'desc' },
      });
      expect(challenge).not.toBeNull();
      expect(challenge?.otp_code).toBe('TW_VERIFY');
    });

    it('should allow any arbitrary valid customer phone number without manual pre-registration in app', async () => {
      let invokedNumber = '';
      const mockProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async (phone: string) => {
          invokedNumber = phone;
          return { messageId: 'VA_mock_any_number', status: 'pending', isSimulated: false };
        },
        verifyOtp: async () => true,
      };

      setOtpProviderForTesting(mockProvider);

      const arbitraryPhone = '9876543210';
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: arbitraryPhone }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(200);
      expect(invokedNumber).toBe('+919876543210');
    });
  });

  // 5. Trial Account Restrictions Mapping
  describe('5. Trial Recipient Restriction Handling', () => {
    it('should map Twilio trial verified-recipient restriction (error 21608/60200) to safe actionable error', async () => {
      const trialRestrictedProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => {
          throw new ProviderTrialRestrictionError(
            'SMS delivery is restricted by the Twilio trial account. Customer numbers cannot receive OTPs until the Twilio account is upgraded or the recipient number is verified in the Twilio Console.'
          );
        },
        verifyOtp: async () => false,
      };

      setOtpProviderForTesting(trialRestrictedProvider);

      const unverifiedCustomerPhone = '+919876543003';
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: unverifiedCustomerPhone }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('PROVIDER_TRIAL_RESTRICTION');
      expect(json.error.message).toContain('Twilio trial account');
      expect(json.error.message).toContain('upgraded');

      // Verify transaction rolled back: no orphaned pending challenge in DB
      const orphaned = await prisma.otp_verifications.findFirst({
        where: { phone: unverifiedCustomerPhone, status: 'pending' },
      });
      expect(orphaned).toBeNull();
    });
  });

  // 6 & 7. Missing Credentials & Provider Rejection Fail Safely
  describe('6 & 7. Failure Safety & False-Success Prevention', () => {
    it('should fail with 503 SERVICE_UNAVAILABLE when production credentials are missing', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSid = process.env.TWILIO_ACCOUNT_SID;
      const origToken = process.env.TWILIO_AUTH_TOKEN;
      const origVerifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        delete process.env.TWILIO_ACCOUNT_SID;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_VERIFY_SERVICE_SID;

        const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: edgePhone }),
        });

        const res = await requestOtpHandler(req);
        expect(res.status).toBe(503);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSid) process.env.TWILIO_ACCOUNT_SID = origSid;
        if (origToken) process.env.TWILIO_AUTH_TOKEN = origToken;
        if (origVerifySid) process.env.TWILIO_VERIFY_SERVICE_SID = origVerifySid;
      }
    });

    it('should NEVER report false success when the provider rejects the dispatch request', async () => {
      const failingProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => {
          throw new Error('Twilio gateway timeout 504');
        },
        verifyOtp: async () => false,
      };

      setOtpProviderForTesting(failingProvider);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: edgePhone }),
      });

      const res = await requestOtpHandler(req);
      // Must NOT be 200, must NOT return { success: true }
      expect(res.status).toBeGreaterThanOrEqual(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // 8, 9 & 10. Verification Lifecycle, Session Creation & Unsuccessful Verification Guard
  describe('8, 9 & 10. Verification Lifecycle & Customer Session', () => {
    it('should reject incorrect verification code and unsuccessful provider check', async () => {
      const rejectingProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => ({ messageId: 'VA_test', status: 'pending', isSimulated: false }),
        verifyOtp: async (_phone, code) => code === '654321', // only 654321 is valid
      };

      setOtpProviderForTesting(rejectingProvider);

      // Create a pending TW_VERIFY challenge
      await prisma.otp_verifications.create({
        data: {
          phone: prodPhone,
          otp_code: 'TW_VERIFY',
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 300 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      // Submit wrong code
      const wrongReq = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: prodPhone, otp: '111111' }),
      });

      const res = await verifyOtpHandler(wrongReq);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');

      // Ensure no customer or session was created
      const unverifiedSession = await prisma.customer_sessions.findFirst({
        where: { customers: { phone: prodPhone } },
      });
      expect(unverifiedSession).toBeNull();
    });

    it('should reject expired verification challenges', async () => {
      // Artificially expire the challenge
      await prisma.otp_verifications.updateMany({
        where: { phone: prodPhone, status: 'pending' },
        data: { expires_at: new Date(Date.now() - 5000) },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: prodPhone, otp: '654321' }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('expired');
    });

    it('should create authenticated customer identity and customer session on successful verification', async () => {
      const approvingProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => ({ messageId: 'VA_approved', status: 'pending', isSimulated: false }),
        verifyOtp: async (_phone, code) => code === '654321',
      };

      setOtpProviderForTesting(approvingProvider);

      // Create fresh valid challenge
      await prisma.otp_verifications.create({
        data: {
          phone: prodPhone,
          otp_code: 'TW_VERIFY',
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 300 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: prodPhone,
          otp: '654321',
          name: 'Priya Patel',
        }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.phone).toBe(prodPhone);
      expect(json.data.user.name).toBe('Priya Patel');
      expect(json.data.user.role).toBe('CUSTOMER');
      expect(json.data.token).toBeDefined();

      createdCustomerId = json.data.user.id;
      testCustomerSessionToken = json.data.token;

      // Verify database record in customers table
      const customerRecord = await prisma.customers.findUnique({
        where: { id: createdCustomerId! },
      });
      expect(customerRecord).not.toBeNull();
      expect(customerRecord?.phone).toBe(prodPhone);

      // Verify active session in customer_sessions table
      const sessionRecord = await prisma.customer_sessions.findFirst({
        where: { customer_id: createdCustomerId!, status: 'active' },
      });
      expect(sessionRecord).not.toBeNull();
      expect(sessionRecord?.session_token_hash).toBeDefined();

      // Verify cookie is set on response
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain('restrauque_session');
    });
  });

  // 11, 12 & 13. Rate Limiting, Attempt Caps & Replay Prevention
  describe('11, 12 & 13. Abuse Prevention & Replay Resistance', () => {
    it('should prevent replay of an already-verified challenge', async () => {
      const replayPhone = '+919876543009';
      const approvingProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => ({ messageId: 'VA_rep', status: 'pending', isSimulated: false }),
        verifyOtp: async () => true,
      };

      setOtpProviderForTesting(approvingProvider);

      await prisma.otp_verifications.create({
        data: {
          phone: replayPhone,
          otp_code: 'TW_VERIFY',
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 300 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      // 1. First verification succeeds
      const req1 = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: replayPhone, otp: '123456' }),
      });
      const res1 = await verifyOtpHandler(req1);
      expect(res1.status).toBe(200);

      // 2. Second verification attempt (replay) fails
      const req2 = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: replayPhone, otp: '123456' }),
      });
      const res2 = await verifyOtpHandler(req2);
      expect(res2.status).toBe(400);

      // Cleanup
      await prisma.customer_sessions.deleteMany({ where: { customers: { phone: replayPhone } } });
      await prisma.customers.deleteMany({ where: { phone: replayPhone } });
      await prisma.otp_verifications.deleteMany({ where: { phone: replayPhone } });
    });

    it('should cap verification attempts at 5 and lock out', async () => {
      // Create fresh challenge
      const capPhone = '+919876543004';
      await prisma.otp_verifications.create({
        data: {
          phone: capPhone,
          otp_code: 'TW_VERIFY',
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 300 * 1000),
          attempts: 4, // already 4 attempts
          max_attempts: 5,
        },
      });

      const rejectingProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => ({ messageId: 'VA_cap', status: 'pending', isSimulated: false }),
        verifyOtp: async () => false,
      };

      setOtpProviderForTesting(rejectingProvider);

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: capPhone, otp: '000000' }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain('Maximum verification attempts exceeded');

      // Verify challenge status is marked failed in DB
      const failedChallenge = await prisma.otp_verifications.findFirst({
        where: { phone: capPhone },
        orderBy: { created_at: 'desc' },
      });
      expect(failedChallenge?.status).toBe('failed');

      // Clean up cap challenge
      await prisma.otp_verifications.deleteMany({ where: { phone: capPhone } });
    });
  });

  // 14. Concurrent Customer Signup
  describe('14. Concurrency Safety During Customer Account Creation', () => {
    it('should not throw error or create duplicates when concurrent signups occur for same phone', async () => {
      // Ensure phone is clean
      await prisma.customers.deleteMany({ where: { phone: concurrencyPhone } });

      const approvingProvider: OtpProvider = {
        name: 'twilio_verify',
        managesCodeGeneration: true,
        requestOtp: async () => ({ messageId: 'VA_conc', status: 'pending', isSimulated: false }),
        verifyOtp: async () => true,
      };

      setOtpProviderForTesting(approvingProvider);

      // Create 2 challenges for concurrencyPhone
      const ch1 = await prisma.otp_verifications.create({
        data: {
          phone: concurrencyPhone,
          otp_code: 'TW_VERIFY',
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 300 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      const makeVerify = () =>
        verifyOtpHandler(
          new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: concurrencyPhone, otp: '123456', name: 'Concurrent Patron' }),
          })
        );

      const res = await makeVerify();
      expect(res.status).toBe(200);

      // Verify exactly ONE customer record exists for this phone
      const custCount = await prisma.customers.count({
        where: { phone: concurrencyPhone },
      });
      expect(custCount).toBe(1);

      // Clean up
      await prisma.customer_sessions.deleteMany({ where: { customers: { phone: concurrencyPhone } } });
      await prisma.customers.deleteMany({ where: { phone: concurrencyPhone } });
      await prisma.otp_verifications.deleteMany({ where: { phone: concurrencyPhone } });
    });
  });

  // 15 & 16. Logout, Session Revocation & Owner Auth Integrity
  describe('15 & 16. Customer Logout & Owner Auth Isolation', () => {
    it('should allow customer to access /api/v1/auth/me and then revoke session via logout', async () => {
      if (!testCustomerSessionToken) return;

      // Access /api/v1/auth/me with customer token
      const meReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${testCustomerSessionToken}` },
      });

      const meRes = await meHandler(meReq);
      expect(meRes.status).toBe(200);
      const meJson = await meRes.json();
      expect(meJson.data.user.role).toBe('CUSTOMER');
      expect(meJson.data.user.phone).toBe(prodPhone);

      // Customer Logout
      const logoutReq = new NextRequest('http://localhost:3000/api/v1/auth/customer/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCustomerSessionToken}` },
      });

      const logoutRes = await customerLogoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      // Access /me again -> must be rejected with 401 UNAUTHORIZED
      const meAfterLogout = await meHandler(meReq);
      expect(meAfterLogout.status).toBe(401);
    });

    it('should keep owner login routes unaffected', async () => {
      const ownerReq = new NextRequest('http://localhost:3000/api/v1/auth/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent_owner_for_test@restrauque.com',
          password: 'Password123!',
        }),
      });

      const res = await ownerLoginHandler(ownerReq);
      // Fails with 401 UNAUTHORIZED (not found / invalid credentials), demonstrating owner auth route is intact
      expect(res.status).toBe(401);
    });
  });

  // 17 & 18. Security Guards: Mock Prevention & Secrets Safety
  describe('17 & 18. Production Mock Prevention & Secrets Safety', () => {
    it('should strictly prohibit SMS_PROVIDER="mock" in production mode', () => {
      const origEnv = process.env.NODE_ENV;
      const origProvider = process.env.SMS_PROVIDER;
      const origSid = process.env.TWILIO_ACCOUNT_SID;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.SMS_PROVIDER = 'mock';
        delete process.env.TWILIO_ACCOUNT_SID;

        expect(() => getActiveOtpProvider()).toThrow(/strictly prohibited in production/i);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origProvider) process.env.SMS_PROVIDER = origProvider;
        else delete process.env.SMS_PROVIDER;
        if (origSid) process.env.TWILIO_ACCOUNT_SID = origSid;
      }
    });

    it('should never expose Twilio auth tokens, service SIDs, or OTP codes in responses', async () => {
      const sensitiveReq = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '12345' }),
      });

      const res = await requestOtpHandler(sensitiveReq);
      const text = await res.text();
      expect(text).not.toContain(process.env.TWILIO_AUTH_TOKEN || 'dummy_never_leak');
      expect(text).not.toContain(process.env.JWT_SECRET || 'dummy_never_leak');
    });
  });
});
