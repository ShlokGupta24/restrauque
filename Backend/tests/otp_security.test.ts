import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as requestOtpHandler } from '@/app/api/v1/auth/customer/otp/request/route';
import { POST as verifyOtpHandler } from '@/app/api/v1/auth/customer/otp/verify/route';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';
import { prisma } from '@/lib/db/prisma';

describe('STEP 1.2 — Customer OTP Security Verification', () => {
  const securityPhone = '+919876500001';
  const concurrencyPhone = '+919876500002';

  afterAll(async () => {
    try {
      await prisma.otp_verifications.deleteMany({
        where: { phone: { in: [securityPhone, concurrencyPhone] } },
      });
      const custs = await prisma.customers.findMany({
        where: { phone: { in: [securityPhone, concurrencyPhone] } },
      });
      for (const cust of custs) {
        await prisma.customer_sessions.deleteMany({ where: { customer_id: cust.id } });
        await prisma.customers.delete({ where: { id: cust.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. OTP Storage & Cryptographic Verification', () => {
    it('should NEVER store OTP in plaintext in the database', async () => {
      const rawOtp = '654321';
      const hashed = hashOtpCode(securityPhone, rawOtp);

      // Verify the hash is not the plaintext OTP
      expect(hashed).not.toBe(rawOtp);
      expect(hashed).toHaveLength(10);
      expect(hashed).toMatch(/^[A-Za-z0-9_-]{10}$/);

      // Verify timing-safe verification
      expect(verifyOtpCode(securityPhone, rawOtp, hashed)).toBe(true);
      expect(verifyOtpCode(securityPhone, '111111', hashed)).toBe(false);
      // Key is bound to phone number: same OTP with different phone fails
      expect(verifyOtpCode('+919876500099', rawOtp, hashed)).toBe(false);
    });

    it('should store keyed HMAC representation when requestOtpHandler executes', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: securityPhone }),
      });

      const res = await requestOtpHandler(req);
      expect(res.status).toBe(200);

      const challenge = await prisma.otp_verifications.findFirst({
        where: { phone: securityPhone, status: 'pending' },
        orderBy: { created_at: 'desc' },
      });

      expect(challenge).not.toBeNull();
      // Must NOT be a 6-digit plain number
      expect(challenge?.otp_code).not.toMatch(/^\d{6}$/);
      expect(challenge?.otp_code).toHaveLength(10);
    });
  });

  describe('2. SMS Delivery Security & Production Fallback Prevention', () => {
    it('should fail with 503 SERVICE_UNAVAILABLE in production when SMS provider is unconfigured', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSid = process.env.TWILIO_ACCOUNT_SID;
      const origToken = process.env.TWILIO_AUTH_TOKEN;
      const origPhone = process.env.TWILIO_PHONE_NUMBER;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        delete process.env.TWILIO_ACCOUNT_SID;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_PHONE_NUMBER;

        const prodPhone = '+919876500003';
        const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: prodPhone }),
        });

        const res = await requestOtpHandler(req);
        // In production without SMS provider credentials, request MUST fail safely
        expect(res.status).toBe(503);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
        // Must never claim SMS was sent or simulate silently
        expect(json.data).toBeUndefined();

        // Must NOT create an active challenge or lock the user out with cooldown
        const orphaned = await prisma.otp_verifications.findFirst({
          where: { phone: prodPhone },
        });
        expect(orphaned).toBeNull();
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSid) process.env.TWILIO_ACCOUNT_SID = origSid;
        if (origToken) process.env.TWILIO_AUTH_TOKEN = origToken;
        if (origPhone) process.env.TWILIO_PHONE_NUMBER = origPhone;
      }
    });
  });

  describe('3. Rate Limiting, Advisory Locks & Concurrency', () => {
    it('should serialize concurrent requests and prevent rate-limit bypass', async () => {
      // Clear previous verifications for concurrencyPhone
      await prisma.otp_verifications.deleteMany({
        where: { phone: concurrencyPhone },
      });

      const makeReq = () =>
        new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: concurrencyPhone }),
        });

      // Fire 2 concurrent requests
      const [res1, res2] = await Promise.all([
        requestOtpHandler(makeReq()),
        requestOtpHandler(makeReq()),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly ONE succeeds (200) and ONE is rate-limited (429) via advisory lock
      expect(statuses).toEqual([200, 429]);
    });

    it('should prevent concurrent double-consumption of the same OTP challenge', async () => {
      const validCode = '882244';
      const hashedCode = hashOtpCode(concurrencyPhone, validCode);

      // Create a fresh challenge in DB
      const challenge = await prisma.otp_verifications.create({
        data: {
          phone: concurrencyPhone,
          otp_code: hashedCode,
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      const makeVerifyReq = () =>
        new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: concurrencyPhone, otp: validCode }),
        });

      // Execute concurrent verification requests
      const [vRes1, vRes2] = await Promise.all([
        verifyOtpHandler(makeVerifyReq()),
        verifyOtpHandler(makeVerifyReq()),
      ]);

      const statuses = [vRes1.status, vRes2.status].sort();
      // Exactly one succeeds, one fails (optimistic lock / CAS)
      expect(statuses).toEqual([200, 400]);

      // Verify DB record is marked verified exactly once
      const updatedChallenge = await prisma.otp_verifications.findUnique({
        where: { id: challenge.id },
      });
      expect(updatedChallenge?.status).toBe('verified');
      expect(updatedChallenge?.verified_at).not.toBeNull();
    });

    it('should lock out OTP after exceeding 5 failed verification attempts', async () => {
      const validCode = '991133';
      const hashedCode = hashOtpCode(concurrencyPhone, validCode);

      const challenge = await prisma.otp_verifications.create({
        data: {
          phone: concurrencyPhone,
          otp_code: hashedCode,
          purpose: 'login',
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000),
          attempts: 0,
          max_attempts: 5,
        },
      });

      // Submit 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: concurrencyPhone, otp: '000000' }),
        });
        const res = await verifyOtpHandler(req);
        expect(res.status).toBe(400);
      }

      // Check DB: status must be 'failed' and attempts must be >= 5
      const lockedChallenge = await prisma.otp_verifications.findUnique({
        where: { id: challenge.id },
      });
      expect(lockedChallenge?.status).toBe('failed');
      expect(lockedChallenge?.attempts).toBeGreaterThanOrEqual(5);

      // Now submit the CORRECT code: must still be rejected because challenge failed
      const correctReq = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: concurrencyPhone, otp: validCode }),
      });
      const correctRes = await verifyOtpHandler(correctReq);
      expect(correctRes.status).toBe(400);
    });
  });
});
