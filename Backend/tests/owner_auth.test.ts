import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as ownerRegisterHandler } from '@/app/api/v1/auth/owner/register/route';
import { POST as ownerLoginHandler } from '@/app/api/v1/auth/owner/login/route';
import { GET as meHandler } from '@/app/api/v1/auth/me/route';
import { GET as ownerProtectedHandler } from '@/app/api/v1/auth/test-protected/owner/route';
import { GET as customerProtectedHandler } from '@/app/api/v1/auth/test-protected/customer/route';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword, hashPassword } from '@/lib/auth/password';

describe('Restaurant Owner Authentication Flow', () => {
  const testRunId = Date.now();
  const ownerEmail = `owner_test_${testRunId}@cafe-test.com`;
  const plainPassword = 'OwnerSecurePassword123!';
  let createdOwnerId: string;
  let ownerToken: string;

  // Also create a test customer user in users table to verify owner login rejects customer accounts
  const customerEmail = `cust_in_users_${testRunId}@cafe-test.com`;
  let customerInUsersId: string;

  afterAll(async () => {
    try {
      if (createdOwnerId) {
        await prisma.user_sessions.deleteMany({ where: { user_id: createdOwnerId } });
        await prisma.users.delete({ where: { id: createdOwnerId } }).catch(() => {});
      }
      if (customerInUsersId) {
        await prisma.user_sessions.deleteMany({ where: { user_id: customerInUsersId } });
        await prisma.users.delete({ where: { id: customerInUsersId } }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('POST /api/v1/auth/owner/register', () => {
    it('should successfully register a RESTAURANT_OWNER and set secure cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Master Cafe Owner',
          email: ownerEmail,
          password: plainPassword,
          phone: '+919876543210',
        }),
      });

      const res = await ownerRegisterHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(ownerEmail);
      expect(json.data.user.name).toBe('Master Cafe Owner');
      expect(json.data.user.role).toBe('RESTAURANT_OWNER');
      expect(json.data.user.status).toBe('active');
      expect(json.data.token).toBeDefined();

      // Ensure password or hash is never returned
      expect(json.data.user.password).toBeUndefined();
      expect(json.data.user.password_hash).toBeUndefined();

      createdOwnerId = json.data.user.id;
      ownerToken = json.data.token;

      // Verify cookie
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('restrauque_session');
      expect(setCookie).toContain('HttpOnly');
    });

    it('should verify password in database is hashed and never plaintext', async () => {
      const user = await prisma.users.findUnique({
        where: { id: createdOwnerId },
      });
      expect(user).not.toBeNull();
      expect(user?.password_hash).not.toBe(plainPassword);
      expect(user?.password_hash.startsWith('$2')).toBe(true);

      const isMatch = await verifyPassword(plainPassword, user!.password_hash);
      expect(isMatch).toBe(true);
    });

    it('should reject invalid registration data (short password, invalid email)', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'A',
          email: 'not-an-email',
          password: '123',
        }),
      });

      const res = await ownerRegisterHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Owner',
          email: ownerEmail.toUpperCase(), // Test case insensitivity / normalization
          password: 'AnotherPassword123!',
        }),
      });

      const res = await ownerRegisterHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });

    it('should not allow role tampering in request body', async () => {
      const tamperEmail = `tamper_${testRunId}@cafe-test.com`;
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tamper Tester',
          email: tamperEmail,
          password: plainPassword,
          role: 'ADMIN', // Tampered role attempt
        }),
      });

      const res = await ownerRegisterHandler(req);
      if (res.status === 201) {
        const json = await res.json();
        expect(json.data.user.role).toBe('RESTAURANT_OWNER'); // Server must strictly enforce RESTAURANT_OWNER
        await prisma.users.delete({ where: { id: json.data.user.id } });
      } else {
        // If schema rejects extra fields
        expect(res.status).toBe(400);
      }
    });
  });

  describe('POST /api/v1/auth/owner/login', () => {
    it('should successfully log in with valid credentials and return safe user info', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ownerEmail,
          password: plainPassword,
        }),
      });

      const res = await ownerLoginHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(ownerEmail);
      expect(json.data.user.role).toBe('RESTAURANT_OWNER');
      expect(json.data.token).toBeDefined();

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('restrauque_session');
    });

    it('should fail with 401 when given an invalid password', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ownerEmail,
          password: 'WrongPassword123!',
        }),
      });

      const res = await ownerLoginHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Invalid email or password');
    });

    it('should fail with 401 when given a non-existent email', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent_owner@cafe-test.com',
          password: plainPassword,
        }),
      });

      const res = await ownerLoginHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Invalid email or password');
    });

    it('should reject a CUSTOMER account through the owner login endpoint', async () => {
      // Create a user with role CUSTOMER in users table
      const passwordHash = await hashPassword(plainPassword);
      const custUser = await prisma.users.create({
        data: {
          name: 'Regular Customer',
          email: customerEmail,
          password_hash: passwordHash,
          role: 'CUSTOMER',
          status: 'active',
        },
      });
      customerInUsersId = custUser.id;

      const req = new NextRequest('http://localhost:3000/api/v1/auth/owner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          password: plainPassword,
        }),
      });

      const res = await ownerLoginHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Invalid email or password');
    });
  });

  describe('Owner Authorization & Guards', () => {
    it('should allow owner to access /me and owner-protected routes, but reject customer routes', async () => {
      // Test /me
      const meReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const meRes = await meHandler(meReq);
      expect(meRes.status).toBe(200);
      const meJson = await meRes.json();
      expect(meJson.data.user.role).toBe('RESTAURANT_OWNER');

      // Test owner protected route
      const ownerReq = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/owner', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const ownerRes = await ownerProtectedHandler(ownerReq);
      expect(ownerRes.status).toBe(200);

      // Test customer protected route (must return 403 FORBIDDEN)
      const custReq = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/customer', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const custRes = await customerProtectedHandler(custReq);
      expect(custRes.status).toBe(403);
    });
  });
});
