import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as requestOtpHandler } from '@/app/api/v1/auth/customer/otp/request/route';
import { POST as verifyOtpHandler } from '@/app/api/v1/auth/customer/otp/verify/route';
import { POST as customerLogoutHandler } from '@/app/api/v1/auth/customer/logout/route';
import { GET as meHandler } from '@/app/api/v1/auth/me/route';
import { GET as customerProtectedHandler } from '@/app/api/v1/auth/test-protected/customer/route';
import { GET as ownerProtectedHandler } from '@/app/api/v1/auth/test-protected/owner/route';
import { prisma } from '@/lib/db/prisma';

describe('Customer Phone & OTP Authentication Flow', () => {
  const testPhone = '+919988776655';
  let createdCustomerId: string;
  let customerToken: string;

  afterAll(async () => {
    try {
      // Clean up OTP verifications for test phone
      await prisma.otp_verifications.deleteMany({
        where: { phone: testPhone },
      });
      // Clean up customer sessions and customer record
      if (createdCustomerId) {
        await prisma.customer_sessions.deleteMany({
          where: { customer_id: createdCustomerId },
        });
        await prisma.customers.delete({
          where: { id: createdCustomerId },
        }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('POST /api/v1/auth/customer/otp/request', () => {
    it('should reject invalid phone numbers', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '12345' }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully request an OTP for a valid phone number and persist challenge in DB', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.phone).toBe(testPhone);
      expect(json.data.expiresInSeconds).toBe(300);

      // Verify OTP is recorded in database as a protected keyed HMAC, NEVER plaintext 6 digits
      const challenge = await prisma.otp_verifications.findFirst({
        where: { phone: testPhone, status: 'pending' },
        orderBy: { created_at: 'desc' },
      });
      expect(challenge).not.toBeNull();
      expect(challenge?.otp_code).toHaveLength(10);
      expect(challenge?.otp_code).not.toMatch(/^\d{6}$/);
    });

    it('should strictly NOT expose OTP in production environment responses', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSid = process.env.TWILIO_ACCOUNT_SID;
      const origToken = process.env.TWILIO_AUTH_TOKEN;
      const origPhone = process.env.TWILIO_PHONE_NUMBER;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.TWILIO_ACCOUNT_SID = 'AC_dummy_sid_for_test';
        process.env.TWILIO_AUTH_TOKEN = 'dummy_token_for_test';
        process.env.TWILIO_PHONE_NUMBER = '+15551234567';

        // Wait or bypass cooldown for test: update previous challenge created_at to 2 minutes ago
        await prisma.otp_verifications.updateMany({
          where: { phone: testPhone },
          data: { created_at: new Date(Date.now() - 120 * 1000) },
        });

        const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhone }),
        });

        const res = await requestOtpHandler(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.devOtp).toBeUndefined();
        expect(JSON.stringify(json)).not.toContain('otp');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSid) process.env.TWILIO_ACCOUNT_SID = origSid; else delete process.env.TWILIO_ACCOUNT_SID;
        if (origToken) process.env.TWILIO_AUTH_TOKEN = origToken; else delete process.env.TWILIO_AUTH_TOKEN;
        if (origPhone) process.env.TWILIO_PHONE_NUMBER = origPhone; else delete process.env.TWILIO_PHONE_NUMBER;
      }
    });

    it('should enforce cooldown rate limit on rapid successive requests', async () => {
      // Consecutive request immediately without cooldown
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('POST /api/v1/auth/customer/otp/verify', () => {
    it('should reject incorrect OTP and increment attempts', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          otp: '000000', // Invalid OTP
        }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');

      // Check attempts counter was incremented
      const challenge = await prisma.otp_verifications.findFirst({
        where: { phone: testPhone, status: 'pending' },
        orderBy: { created_at: 'desc' },
      });
      expect(challenge?.attempts).toBeGreaterThanOrEqual(1);
    });

    it('should reject expired OTPs', async () => {
      // Artificially expire the current challenge
      await prisma.otp_verifications.updateMany({
        where: { phone: testPhone, status: 'pending' },
        data: { expires_at: new Date(Date.now() - 1000) },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          otp: '123456',
        }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('expired');
    });

    it('should successfully verify a valid OTP, create customer identity and customer session', async () => {
      // Create a fresh valid OTP challenge directly in DB
      const validOtp = '789123';
      await prisma.otp_verifications.create({
        data: {
          phone: testPhone,
          otp_code: validOtp,
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          otp: validOtp,
          name: 'Regular Cafe Patron',
        }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.phone).toBe(testPhone);
      expect(json.data.user.role).toBe('CUSTOMER');
      expect(json.data.token).toBeDefined();

      createdCustomerId = json.data.user.id;
      customerToken = json.data.token;

      // Verify that customer flow NEVER creates an owner account or touches users table
      const userInUsersTable = await prisma.users.findFirst({
        where: { id: createdCustomerId },
      });
      expect(userInUsersTable).toBeNull();

      // Verify that customer was created in customers table
      const customerRecord = await prisma.customers.findUnique({
        where: { id: createdCustomerId },
      });
      expect(customerRecord).not.toBeNull();
      expect(customerRecord?.phone).toBe(testPhone);

      // Verify session was created in customer_sessions table
      const customerSession = await prisma.customer_sessions.findFirst({
        where: { customer_id: createdCustomerId, status: 'active' },
      });
      expect(customerSession).not.toBeNull();
    });

    it('should prevent replay of already-consumed OTP', async () => {
      // Re-submit the same OTP that was just successfully verified
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          otp: '789123',
        }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent concurrent verification from consuming the same OTP twice', async () => {
      const concurrentOtp = '554433';
      await prisma.otp_verifications.create({
        data: {
          phone: testPhone,
          otp_code: concurrentOtp,
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      const req1 = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, otp: concurrentOtp }),
      });
      const req2 = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, otp: concurrentOtp }),
      });

      const [res1, res2] = await Promise.all([
        verifyOtpHandler(req1),
        verifyOtpHandler(req2),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (200) and one must be rejected (400)
      expect(statuses).toEqual([200, 400]);
    });

    it('should not duplicate customer identity on subsequent login with same phone number', async () => {
      // Issue another valid OTP for the same phone
      const secondOtp = '654321';
      await prisma.otp_verifications.create({
        data: {
          phone: testPhone,
          otp_code: secondOtp,
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          otp: secondOtp,
        }),
      });

      const res = await verifyOtpHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      // Identity ID must match previously created customer ID (reuse existing identity)
      expect(json.data.user.id).toBe(createdCustomerId);

      // Verify total customer count for this phone is still exactly 1
      const count = await prisma.customers.count({
        where: { phone: testPhone },
      });
      expect(count).toBe(1);
    });
  });

  describe('Customer Authorization, Guards & Logout', () => {
    it('should allow customer to access /me and customer-protected route, and reject owner routes with 403', async () => {
      // /me
      const meReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const meRes = await meHandler(meReq);
      expect(meRes.status).toBe(200);
      const meJson = await meRes.json();
      expect(meJson.data.user.role).toBe('CUSTOMER');
      expect(meJson.data.user.phone).toBe(testPhone);

      // Customer route
      const custReq = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/customer', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const custRes = await customerProtectedHandler(custReq);
      expect(custRes.status).toBe(200);

      // Owner route -> 403 Forbidden
      const ownerReq = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/owner', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const ownerRes = await ownerProtectedHandler(ownerReq);
      expect(ownerRes.status).toBe(403);
    });

    it('should successfully logout customer, revoking customer_sessions entry', async () => {
      const logoutReq = new NextRequest('http://localhost:3000/api/v1/auth/customer/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      const logoutRes = await customerLogoutHandler(logoutReq);
      expect(logoutRes.status).toBe(200);

      const logoutJson = await logoutRes.json();
      expect(logoutJson.success).toBe(true);

      // Subsequent access with revoked session must be rejected with 401
      const meReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const meRes = await meHandler(meReq);
      expect(meRes.status).toBe(401);
    });
  });
});
