import { describe, it, expect, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as healthHandler } from '@/app/api/v1/health/route';
import { POST as registerHandler } from '@/app/api/v1/auth/register/route';
import { POST as loginHandler } from '@/app/api/v1/auth/login/route';
import { GET as meHandler } from '@/app/api/v1/auth/me/route';
import { POST as logoutHandler } from '@/app/api/v1/auth/logout/route';
import { GET as protectedHandler } from '@/app/api/v1/auth/test-protected/route';
import { GET as ownerHandler } from '@/app/api/v1/auth/test-protected/owner/route';
import { GET as customerHandler } from '@/app/api/v1/auth/test-protected/customer/route';
import { prisma } from '@/lib/db/prisma';

describe('API Route Integration Tests', () => {
  const testRunId = Date.now();
  const customerEmail = `customer_${testRunId}@cafe-test.com`;
  const ownerEmail = `owner_${testRunId}@cafe-test.com`;
  const plainPassword = 'SecurePassword123!';

  let customerToken: string;
  let ownerToken: string;
  let customerId: string;
  let ownerId: string;

  afterAll(async () => {
    // Clean up test users created during test run
    try {
      if (customerId) {
        await prisma.users.delete({ where: { id: customerId } }).catch(() => {});
      }
      if (ownerId) {
        await prisma.users.delete({ where: { id: ownerId } }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status and connected database without exposing credentials', async () => {
      const res = await healthHandler();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.database).toBe('connected');
      expect(json.data.version).toBe('v1');
      // Ensure no credentials or URLs are leaked
      expect(JSON.stringify(json)).not.toContain('postgresql://');
      expect(JSON.stringify(json)).not.toContain('password');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a CUSTOMER and set auth cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          password: plainPassword,
          name: 'Test Customer',
          phone: '+919876543210',
          role: 'CUSTOMER',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(customerEmail);
      expect(json.data.user.role).toBe('CUSTOMER');
      expect(json.data.user.name).toBe('Test Customer');
      // Passwords and hashes must NEVER be returned
      expect(json.data.user.password).toBeUndefined();
      expect(json.data.user.password_hash).toBeUndefined();
      expect(json.data.token).toBeDefined();

      customerToken = json.data.token;
      customerId = json.data.user.id;

      // Verify cookie set
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('restrauque_session');
      expect(setCookie).toContain('HttpOnly');
    });

    it('should successfully register a RESTAURANT_OWNER', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ownerEmail,
          password: plainPassword,
          name: 'Test Owner',
          role: 'RESTAURANT_OWNER',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe('RESTAURANT_OWNER');
      expect(json.data.user.password).toBeUndefined();

      ownerToken = json.data.token;
      ownerId = json.data.user.id;
    });

    it('should reject registration with unsupported role (e.g. ADMIN)', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `admin_${testRunId}@cafe.com`,
          password: plainPassword,
          name: 'Attacker Admin',
          role: 'ADMIN',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          password: plainPassword,
          name: 'Duplicate Alice',
          role: 'CUSTOMER',
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully log in with valid credentials and return safe user info', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          password: plainPassword,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(customerEmail);
      expect(json.data.user.role).toBe('CUSTOMER');
      expect(json.data.user.password).toBeUndefined();
      expect(json.data.user.password_hash).toBeUndefined();
      expect(json.data.token).toBeDefined();

      // Refresh customer token
      customerToken = json.data.token;
    });

    it('should fail with 401 when given invalid password', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail,
          password: 'WrongPassword999',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
      expect(json.error.message).toBe('Invalid email or password');
    });

    it('should fail with 401 when given non-existent email', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@nowhere.com',
          password: plainPassword,
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/me');
      const res = await meHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('should return authenticated user profile and role with valid Bearer token', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: {
          authorization: `Bearer ${customerToken}`,
        },
      });

      const res = await meHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(customerEmail);
      expect(json.data.user.role).toBe('CUSTOMER');
    });

    it('should return authenticated user profile using cookie authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: {
          cookie: `restrauque_session=${customerToken}`,
        },
      });

      const res = await meHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.user.email).toBe(customerEmail);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should allow both CUSTOMER and RESTAURANT_OWNER to access general protected route', async () => {
      const reqCust = new NextRequest('http://localhost:3000/api/v1/auth/test-protected', {
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const resCust = await protectedHandler(reqCust);
      expect(resCust.status).toBe(200);

      const reqOwner = new NextRequest('http://localhost:3000/api/v1/auth/test-protected', {
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const resOwner = await protectedHandler(reqOwner);
      expect(resOwner.status).toBe(200);
    });

    it('should ALLOW RESTAURANT_OWNER to access owner route and REJECT CUSTOMER with 403 Forbidden', async () => {
      // Owner -> 200
      const reqOwner = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/owner', {
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const resOwner = await ownerHandler(reqOwner);
      expect(resOwner.status).toBe(200);
      const jsonOwner = await resOwner.json();
      expect(jsonOwner.data.role).toBe('RESTAURANT_OWNER');

      // Customer -> 403 Forbidden
      const reqCust = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/owner', {
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const resCust = await ownerHandler(reqCust);
      expect(resCust.status).toBe(403);
      const jsonCust = await resCust.json();
      expect(jsonCust.error.code).toBe('FORBIDDEN');
    });

    it('should ALLOW CUSTOMER to access customer route and REJECT RESTAURANT_OWNER with 403 Forbidden', async () => {
      // Customer -> 200
      const reqCust = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/customer', {
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const resCust = await customerHandler(reqCust);
      expect(resCust.status).toBe(200);
      const jsonCust = await resCust.json();
      expect(jsonCust.data.role).toBe('CUSTOMER');

      // Owner -> 403 Forbidden
      const reqOwner = new NextRequest('http://localhost:3000/api/v1/auth/test-protected/customer', {
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const resOwner = await customerHandler(reqOwner);
      expect(resOwner.status).toBe(403);
      const jsonOwner = await resOwner.json();
      expect(jsonOwner.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should invalidate session and clear cookie on logout', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${customerToken}` },
      });

      const res = await logoutHandler(req);
      expect(res.status).toBe(200);

      // Verify cookie cleared
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('restrauque_session');
      expect(setCookie).toContain('Max-Age=0');

      // Subsequent request using that same token should FAIL with 401 because session is revoked in database
      const meReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { authorization: `Bearer ${customerToken}` },
      });
      const meRes = await meHandler(meReq);
      expect(meRes.status).toBe(401);
    });
  });
});
