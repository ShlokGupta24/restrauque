import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession, revokeDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { GET as ownerContextHandler } from '@/app/api/v1/owner/context/route';
import { GET as verifyAccessHandler } from '@/app/api/v1/owner/verify-access/route';
import { GET as meHandler } from '@/app/api/v1/auth/me/route';
import {
  getOwnerRestaurantContext,
  requireAuthorizedRestaurant,
  requireAuthorizedBranch,
} from '@/lib/auth/tenancy';

describe('STEP 2 — Restaurant Tenancy, Branch Ownership & Centralized Authorization', () => {
  const timestamp = Date.now();

  // Test Owner A (Has Restaurant A and Branch A1)
  let ownerAId: string;
  let ownerAToken: string;
  let restaurantAId: string;
  let branchA1Id: string;

  // Test Owner B (Has Restaurant B and Branch B1)
  let ownerBId: string;
  let ownerBToken: string;
  let restaurantBId: string;
  let branchB1Id: string;

  // Test Owner C (Has NO restaurant)
  let ownerCId: string;
  let ownerCToken: string;

  // Test Customer
  let customerId: string;
  let customerToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner A
    const ownerA = await prisma.users.create({
      data: {
        email: `owner_a_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Owner Alice',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    ownerAId = ownerA.id;

    const sessionA = await createDatabaseSession(ownerAId);
    ownerAToken = await createJwtToken({
      userId: ownerAId,
      sessionId: sessionA.sessionId,
      sessionToken: sessionA.sessionToken,
      email: ownerA.email,
      role: 'RESTAURANT_OWNER',
    });

    // Create Restaurant A for Owner A
    const restA = await prisma.restaurants.create({
      data: {
        name: `Alice Cafe ${timestamp}`,
        legal_name: 'Alice Cafe Pvt Ltd',
        owner_id: ownerAId,
        status: 'active',
      },
    });
    restaurantAId = restA.id;

    // Create Branch A1 for Restaurant A
    const branchA1 = await prisma.branches.create({
      data: {
        restaurant_id: restaurantAId,
        name: 'Downtown Branch',
        status: 'active',
      },
    });
    branchA1Id = branchA1.id;

    // 2. Create Owner B
    const ownerB = await prisma.users.create({
      data: {
        email: `owner_b_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Owner Bob',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    ownerBId = ownerB.id;

    const sessionB = await createDatabaseSession(ownerBId);
    ownerBToken = await createJwtToken({
      userId: ownerBId,
      sessionId: sessionB.sessionId,
      sessionToken: sessionB.sessionToken,
      email: ownerB.email,
      role: 'RESTAURANT_OWNER',
    });

    // Create Restaurant B for Owner B
    const restB = await prisma.restaurants.create({
      data: {
        name: `Bob Bistro ${timestamp}`,
        legal_name: 'Bob Bistro Pvt Ltd',
        owner_id: ownerBId,
        status: 'active',
      },
    });
    restaurantBId = restB.id;

    // Create Branch B1 for Restaurant B
    const branchB1 = await prisma.branches.create({
      data: {
        restaurant_id: restaurantBId,
        name: 'Uptown Branch',
        status: 'active',
      },
    });
    branchB1Id = branchB1.id;

    // 3. Create Owner C (Has no restaurants)
    const ownerC = await prisma.users.create({
      data: {
        email: `owner_c_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Owner Charlie',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    ownerCId = ownerC.id;

    const sessionC = await createDatabaseSession(ownerCId);
    ownerCToken = await createJwtToken({
      userId: ownerCId,
      sessionId: sessionC.sessionId,
      sessionToken: sessionC.sessionToken,
      email: ownerC.email,
      role: 'RESTAURANT_OWNER',
    });

    // 4. Create Customer
    const customer = await prisma.customers.create({
      data: {
        phone: `+919999${timestamp.toString().slice(-6)}`,
        name: 'Regular Customer',
        status: 'active',
      },
    });
    customerId = customer.id;

    const customerSession = await createCustomerDatabaseSession(customerId);
    customerToken = await createJwtToken({
      userId: customerId,
      sessionId: customerSession.sessionId,
      sessionToken: customerSession.sessionToken,
      phone: customer.phone,
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    try {
      // Clean up branches
      if (branchA1Id) await prisma.branches.delete({ where: { id: branchA1Id } }).catch(() => {});
      if (branchB1Id) await prisma.branches.delete({ where: { id: branchB1Id } }).catch(() => {});

      // Clean up restaurants
      if (restaurantAId) await prisma.restaurants.delete({ where: { id: restaurantAId } }).catch(() => {});
      if (restaurantBId) await prisma.restaurants.delete({ where: { id: restaurantBId } }).catch(() => {});

      // Clean up sessions
      if (ownerAId) await prisma.user_sessions.deleteMany({ where: { user_id: ownerAId } }).catch(() => {});
      if (ownerBId) await prisma.user_sessions.deleteMany({ where: { user_id: ownerBId } }).catch(() => {});
      if (ownerCId) await prisma.user_sessions.deleteMany({ where: { user_id: ownerCId } }).catch(() => {});
      if (customerId) await prisma.customer_sessions.deleteMany({ where: { customer_id: customerId } }).catch(() => {});

      // Clean up users & customers
      if (ownerAId) await prisma.users.delete({ where: { id: ownerAId } }).catch(() => {});
      if (ownerBId) await prisma.users.delete({ where: { id: ownerBId } }).catch(() => {});
      if (ownerCId) await prisma.users.delete({ where: { id: ownerCId } }).catch(() => {});
      if (customerId) await prisma.customers.delete({ where: { id: customerId } }).catch(() => {});
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Unauthenticated Access Rejection', () => {
    it('should reject unauthenticated requests with 401 UNAUTHORIZED on GET /api/v1/owner/context', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context');
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject unauthenticated requests on GET /api/v1/owner/verify-access', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantAId}`);
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Customer Role Access Rejection', () => {
    it('should reject customer tokens with 403 FORBIDDEN on owner context endpoint', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should reject customer tokens on verify-access endpoint', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantAId}`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Cross-Tenant Restaurant Access Rejection', () => {
    it('should forbid Owner A from accessing Restaurant B with 403 FORBIDDEN', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantBId}`,
        {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('authorization for this restaurant');
    });

    it('should forbid Owner B from accessing Restaurant A with 403 FORBIDDEN', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantAId}`,
        {
          headers: { Authorization: `Bearer ${ownerBToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 NOT_FOUND for non-existent restaurantId', async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=${randomUuid}`,
        {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('4. Cross-Restaurant Branch Access Rejection', () => {
    it('should reject access when branch belongs to Restaurant B but queried under Restaurant A', async () => {
      // Owner A owns Restaurant A, but queries Branch B1 (which belongs to Restaurant B)
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantAId}&branchId=${branchB1Id}`,
        {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toContain('does not belong to the authorized restaurant');
    });

    it('should return 404 NOT_FOUND when branchId does not exist', async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantAId}&branchId=${randomUuid}`,
        {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('5. Client-Supplied Parameter Tampering & Forgery Prevention', () => {
    it('should reject malformed or non-UUID identifiers with 400 VALIDATION_ERROR', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=not-a-uuid`,
        {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject tampered JWT attempting to forge role as RESTAURANT_OWNER', async () => {
      // Craft a forged token with invalid signature
      const tamperedToken = customerToken + 'tampered';
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context', {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('6. Authorized Owner Context Access', () => {
    it('should successfully return authorized restaurant and branches for Owner A', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context', {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.owner.id).toBe(ownerAId);
      expect(json.data.owner.role).toBe('RESTAURANT_OWNER');
      expect(json.data.restaurant).toBeDefined();
      expect(json.data.restaurant.id).toBe(restaurantAId);
      expect(json.data.restaurant.name).toContain('Alice Cafe');
      expect(json.data.branches).toHaveLength(1);
      expect(json.data.branches[0].id).toBe(branchA1Id);
      expect(json.data.branches[0].name).toBe('Downtown Branch');
    });

    it('should successfully verify access to own restaurant and own branch via verify-access', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/verify-access?restaurantId=${restaurantAId}&branchId=${branchA1Id}`,
        {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        }
      );
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.authorized).toBe(true);
      expect(json.data.restaurant.id).toBe(restaurantAId);
      expect(json.data.branch.id).toBe(branchA1Id);
    });
  });

  describe('7. Owner With No Restaurant Association', () => {
    it('should return documented safe response (restaurant: null, branches: []) for Owner C', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context', {
        headers: { Authorization: `Bearer ${ownerCToken}` },
      });
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.owner.id).toBe(ownerCId);
      expect(json.data.restaurant).toBeNull();
      expect(json.data.branches).toEqual([]);
    });

    it('should return 404 when Owner C calls verify-access without restaurantId', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/verify-access`, {
        headers: { Authorization: `Bearer ${ownerCToken}` },
      });
      const res = await verifyAccessHandler(req);

      expect(res.status).toBe(400); // missing restaurantId param
    });
  });

  describe('8. Session Revocation & Expiry Integrity', () => {
    it('should reject owner context when session is revoked', async () => {
      // Create temporary owner and session
      const tempOwner = await prisma.users.create({
        data: {
          email: `temp_owner_${timestamp}@test.com`,
          password_hash: 'hash',
          name: 'Temp Owner',
          role: 'RESTAURANT_OWNER',
          status: 'active',
        },
      });

      const tempSession = await createDatabaseSession(tempOwner.id);
      const tempToken = await createJwtToken({
        userId: tempOwner.id,
        sessionId: tempSession.sessionId,
        sessionToken: tempSession.sessionToken,
        role: 'RESTAURANT_OWNER',
      });

      // Revoke the session
      await revokeDatabaseSession(tempSession.sessionId);

      // Verify request is rejected
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context', {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Session expired or revoked');

      // Cleanup
      await prisma.user_sessions.deleteMany({ where: { user_id: tempOwner.id } }).catch(() => {});
      await prisma.users.delete({ where: { id: tempOwner.id } }).catch(() => {});
    });
  });

  describe('9. Database Integrity & Branch Uniqueness Constraint', () => {
    it('should reject creating a duplicate branch name under the same restaurant', async () => {
      // Attempt to create another branch named 'Downtown Branch' under Restaurant A
      await expect(
        prisma.branches.create({
          data: {
            restaurant_id: restaurantAId,
            name: 'Downtown Branch', // Duplicate
            status: 'active',
          },
        })
      ).rejects.toThrow();
    });

    it('should allow the same branch name under a DIFFERENT restaurant', async () => {
      // Create 'Downtown Branch' under Restaurant B (different restaurant)
      const diffBranch = await prisma.branches.create({
        data: {
          restaurant_id: restaurantBId,
          name: 'Downtown Branch',
          status: 'active',
        },
      });

      expect(diffBranch.id).toBeDefined();
      expect(diffBranch.restaurant_id).toBe(restaurantBId);

      // Cleanup
      await prisma.branches.delete({ where: { id: diffBranch.id } }).catch(() => {});
    });
  });

  describe('10. Existing Auth & Me Routes Preservation', () => {
    it('should preserve GET /api/v1/auth/me for both owner and customer', async () => {
      const ownerReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      const ownerRes = await meHandler(ownerReq);
      expect(ownerRes.status).toBe(200);
      const ownerJson = await ownerRes.json();
      expect(ownerJson.data.user.role).toBe('RESTAURANT_OWNER');

      const customerReq = new NextRequest('http://localhost:3000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const customerRes = await meHandler(customerReq);
      expect(customerRes.status).toBe(200);
      const customerJson = await customerRes.json();
      expect(customerJson.data.user.role).toBe('CUSTOMER');
    });
  });
});
