import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { POST as createRestaurantHandler } from '@/app/api/v1/owner/restaurants/route';
import {
  GET as getRestaurantHandler,
  PATCH as updateRestaurantHandler,
} from '@/app/api/v1/owner/restaurant/route';
import {
  GET as listBranchesHandler,
  POST as createBranchHandler,
} from '@/app/api/v1/owner/branches/route';
import {
  GET as getBranchHandler,
  PATCH as updateBranchHandler,
} from '@/app/api/v1/owner/branches/[branchId]/route';
import { GET as ownerContextHandler } from '@/app/api/v1/owner/context/route';

describe('STEP 3 — Restaurant Onboarding & Branch Management APIs', () => {
  const timestamp = Date.now();

  // Test Owner 1: Starts without a restaurant, will onboard
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1InitialBranchId: string;

  // Test Owner 2: Will have a separate restaurant
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2BranchId: string;

  // Test Customer: Must be rejected on all owner endpoints
  let customerId: string;
  let customerToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1
    const owner1 = await prisma.users.create({
      data: {
        email: `onboard_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Onboard Owner 1',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner1Id = owner1.id;

    const session1 = await createDatabaseSession(owner1Id);
    owner1Token = await createJwtToken({
      userId: owner1Id,
      sessionId: session1.sessionId,
      sessionToken: session1.sessionToken,
      email: owner1.email,
      role: 'RESTAURANT_OWNER',
    });

    // 2. Create Owner 2
    const owner2 = await prisma.users.create({
      data: {
        email: `onboard_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Onboard Owner 2',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner2Id = owner2.id;

    const session2 = await createDatabaseSession(owner2Id);
    owner2Token = await createJwtToken({
      userId: owner2Id,
      sessionId: session2.sessionId,
      sessionToken: session2.sessionToken,
      email: owner2.email,
      role: 'RESTAURANT_OWNER',
    });

    // Create restaurant and branch for Owner 2
    const rest2 = await prisma.restaurants.create({
      data: {
        name: `Owner 2 Bistro ${timestamp}`,
        legal_name: 'Owner 2 Hospitality LLP',
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Owner 2 Central',
        status: 'active',
      },
    });
    owner2BranchId = branch2.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        phone: `+919811${timestamp.toString().slice(-6)}`,
        name: 'Customer Tester',
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
      if (owner1InitialBranchId) await prisma.branches.delete({ where: { id: owner1InitialBranchId } }).catch(() => {});
      if (owner2BranchId) await prisma.branches.delete({ where: { id: owner2BranchId } }).catch(() => {});
      if (owner1RestaurantId) await prisma.branches.deleteMany({ where: { restaurant_id: owner1RestaurantId } }).catch(() => {});
      if (owner2RestaurantId) await prisma.branches.deleteMany({ where: { restaurant_id: owner2RestaurantId } }).catch(() => {});

      // Clean up restaurants
      if (owner1RestaurantId) await prisma.restaurants.delete({ where: { id: owner1RestaurantId } }).catch(() => {});
      if (owner2RestaurantId) await prisma.restaurants.delete({ where: { id: owner2RestaurantId } }).catch(() => {});

      // Clean up sessions
      if (owner1Id) await prisma.user_sessions.deleteMany({ where: { user_id: owner1Id } }).catch(() => {});
      if (owner2Id) await prisma.user_sessions.deleteMany({ where: { user_id: owner2Id } }).catch(() => {});
      if (customerId) await prisma.customer_sessions.deleteMany({ where: { customer_id: customerId } }).catch(() => {});

      // Clean up users
      if (owner1Id) await prisma.users.delete({ where: { id: owner1Id } }).catch(() => {});
      if (owner2Id) await prisma.users.delete({ where: { id: owner2Id } }).catch(() => {});
      if (customerId) await prisma.customers.delete({ where: { id: customerId } }).catch(() => {});
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Authentication and Authorization Guards', () => {
    it('should reject unauthenticated requests with 401 UNAUTHORIZED on POST /api/v1/owner/restaurants', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized Cafe' }),
      });
      const res = await createRestaurantHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject customer tokens with 403 FORBIDDEN on POST /api/v1/owner/restaurants', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ name: 'Customer Cafe' }),
      });
      const res = await createRestaurantHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should reject customer tokens on GET /api/v1/owner/restaurant', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurant', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const res = await getRestaurantHandler(req);

      expect(res.status).toBe(403);
    });

    it('should reject customer tokens on GET /api/v1/owner/branches', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/branches', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const res = await listBranchesHandler(req);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Pre-Onboarding State for Owner 1', () => {
    it('should return documented safe response (restaurant: null, branches: []) before onboarding', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurant', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getRestaurantHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant).toBeNull();
      expect(json.data.branches).toEqual([]);
    });

    it('should reject listing branches before onboarding with 404 NOT_FOUND', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/branches', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listBranchesHandler(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('3. Restaurant Onboarding Flow (POST /api/v1/owner/restaurants)', () => {
    it('should reject invalid or missing name with 400 VALIDATION_ERROR', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({ name: '' }),
      });
      const res = await createRestaurantHandler(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully onboard restaurant with initial primary branch in a single transaction', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: `The Artisan Roastery ${timestamp}`,
          legalName: 'Artisan Roastery Private Limited',
          email: `artisan_${timestamp}@roastery.com`,
          phone: '+919876543210',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          timezone: 'Asia/Kolkata',
          initialBranch: {
            name: 'Indiranagar Flagship',
            phone: '+919876543211',
            city: 'Bengaluru',
            state: 'Karnataka',
          },
        }),
      });

      const res = await createRestaurantHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant).toBeDefined();
      expect(json.data.restaurant.id).toBeDefined();
      expect(json.data.restaurant.name).toBe(`The Artisan Roastery ${timestamp}`);
      expect(json.data.restaurant.legalName).toBe('Artisan Roastery Private Limited');
      expect(json.data.restaurant.ownerId).toBe(owner1Id);
      expect(json.data.restaurant.status).toBe('active');

      // Verify initial branch
      expect(json.data.branches).toHaveLength(1);
      expect(json.data.branches[0].name).toBe('Indiranagar Flagship');
      expect(json.data.branches[0].restaurantId).toBe(json.data.restaurant.id);
      expect(json.data.branches[0].status).toBe('active');

      owner1RestaurantId = json.data.restaurant.id;
      owner1InitialBranchId = json.data.branches[0].id;
    });

    it('should reject repeated onboarding for the same owner with 409 CONFLICT', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: `Duplicate Restaurant Attempt ${timestamp}`,
        }),
      });

      const res = await createRestaurantHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
      expect(json.error.message).toContain('already has an active restaurant');
    });

    it('should ignore client-supplied owner_id tampering in request body', async () => {
      // Create fresh owner 3 to verify client-supplied owner_id is ignored
      const owner3 = await prisma.users.create({
        data: {
          email: `tamper_owner_${timestamp}@test.com`,
          password_hash: 'hash',
          name: 'Tamper Owner',
          role: 'RESTAURANT_OWNER',
          status: 'active',
        },
      });
      const session3 = await createDatabaseSession(owner3.id);
      const token3 = await createJwtToken({
        userId: owner3.id,
        sessionId: session3.sessionId,
        sessionToken: session3.sessionToken,
        role: 'RESTAURANT_OWNER',
      });

      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token3}`,
        },
        body: JSON.stringify({
          name: `Tamper Attempt ${timestamp}`,
          owner_id: owner2Id, // Attempt to assign to Owner 2
        }),
      });

      const res = await createRestaurantHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      // Ensure ownership was set strictly to authenticated owner3, NOT owner2
      expect(json.data.restaurant.ownerId).toBe(owner3.id);
      expect(json.data.restaurant.ownerId).not.toBe(owner2Id);

      // Cleanup
      await prisma.restaurants.delete({ where: { id: json.data.restaurant.id } });
      await prisma.user_sessions.deleteMany({ where: { user_id: owner3.id } });
      await prisma.users.delete({ where: { id: owner3.id } });
    });
  });

  describe('4. Owner Restaurant Profile Management (GET & PATCH /api/v1/owner/restaurant)', () => {
    it('should retrieve the newly onboarded restaurant via GET /api/v1/owner/restaurant', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurant', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getRestaurantHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant.id).toBe(owner1RestaurantId);
      expect(json.data.restaurant.name).toBe(`The Artisan Roastery ${timestamp}`);
      expect(json.data.branches).toHaveLength(1);
      expect(json.data.branches[0].id).toBe(owner1InitialBranchId);
    });

    it('should reflect onboarding immediately in GET /api/v1/owner/context', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/context', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await ownerContextHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.restaurant).toBeDefined();
      expect(json.data.restaurant.id).toBe(owner1RestaurantId);
      expect(json.data.branches).toHaveLength(1);
    });

    it('should update restaurant profile fields via PATCH /api/v1/owner/restaurant', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/restaurant', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: `The Artisan Roastery Updated ${timestamp}`,
          city: 'Bangalore Urban',
          address: '100 Feet Road, Indiranagar',
        }),
      });

      const res = await updateRestaurantHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant.name).toBe(`The Artisan Roastery Updated ${timestamp}`);
      expect(json.data.restaurant.city).toBe('Bangalore Urban');
      expect(json.data.restaurant.address).toBe('100 Feet Road, Indiranagar');
    });

    it('should prevent Owner 1 from altering Owner 2 restaurant', async () => {
      // Owner 1 PATCH request only affects Owner 1's restaurant resolved via server-side session
      // Confirm Owner 2 restaurant remains untouched
      const rest2 = await prisma.restaurants.findUnique({
        where: { id: owner2RestaurantId },
      });
      expect(rest2?.owner_id).toBe(owner2Id);
      expect(rest2?.name).toBe(`Owner 2 Bistro ${timestamp}`);
    });
  });

  describe('5. Branch Management (GET, POST & PATCH /api/v1/owner/branches)', () => {
    let secondBranchId: string;

    it('should list authorized branches for Owner 1', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/branches', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listBranchesHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurantId).toBe(owner1RestaurantId);
      expect(json.data.branches).toHaveLength(1);
      expect(json.data.branches[0].id).toBe(owner1InitialBranchId);
    });

    it('should create a second branch under Owner 1 restaurant via POST /api/v1/owner/branches', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Koramangala Express',
          phone: '+919876543212',
          city: 'Bengaluru',
          address: '80 Feet Road, 4th Block',
        }),
      });

      const res = await createBranchHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.branch.name).toBe('Koramangala Express');
      expect(json.data.branch.restaurantId).toBe(owner1RestaurantId);
      expect(json.data.branch.status).toBe('active');

      secondBranchId = json.data.branch.id;
    });

    it('should reject creating a duplicate branch name under the same restaurant with 409 CONFLICT', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Koramangala Express', // Duplicate
        }),
      });

      const res = await createBranchHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
      expect(json.error.message).toContain('already exists in this restaurant');
    });

    it('should allow creating a branch with the same name under a DIFFERENT restaurant', async () => {
      // Owner 2 creates 'Koramangala Express' under Restaurant 2
      const req = new NextRequest('http://localhost:3000/api/v1/owner/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner2Token}`,
        },
        body: JSON.stringify({
          name: 'Koramangala Express', // Same name, different restaurant
        }),
      });

      const res = await createBranchHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.branch.restaurantId).toBe(owner2RestaurantId);

      // Cleanup
      await prisma.branches.delete({ where: { id: json.data.branch.id } });
    });

    it('should retrieve individual branch details via GET /api/v1/owner/branches/[branchId]', async () => {
      const params = Promise.resolve({ branchId: secondBranchId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/branches/${secondBranchId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getBranchHandler(req, { params });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.branch.id).toBe(secondBranchId);
      expect(json.data.branch.name).toBe('Koramangala Express');
    });

    it('should update branch details and status (active/inactive) via PATCH /api/v1/owner/branches/[branchId]', async () => {
      const params = Promise.resolve({ branchId: secondBranchId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/branches/${secondBranchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Koramangala Flagship',
          status: 'inactive',
        }),
      });

      const res = await updateBranchHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.branch.name).toBe('Koramangala Flagship');
      expect(json.data.branch.status).toBe('inactive');
    });

    it('should reject renaming a branch to a name already used by another branch in the same restaurant', async () => {
      const params = Promise.resolve({ branchId: secondBranchId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/branches/${secondBranchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Indiranagar Flagship', // Already used by initial branch
        }),
      });

      const res = await updateBranchHandler(req, { params });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.code).toBe('CONFLICT');
    });

    it('should reject Owner 1 from accessing or updating Owner 2 branch (Cross-tenant rejection)', async () => {
      // Owner 1 attempts to access Owner 2's branch
      const params = Promise.resolve({ branchId: owner2BranchId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/branches/${owner2BranchId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getBranchHandler(req, { params });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('should reject Owner 1 from updating Owner 2 branch with 403 FORBIDDEN', async () => {
      const params = Promise.resolve({ branchId: owner2BranchId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/branches/${owner2BranchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({ name: 'Hacked Branch' }),
      });
      const res = await updateBranchHandler(req, { params });

      expect(res.status).toBe(403);
    });

    it('should clean up second branch', async () => {
      if (secondBranchId) {
        await prisma.branches.delete({ where: { id: secondBranchId } });
      }
    });
  });

  describe('6. Preservation of Unassigned Seed Restaurants', () => {
    it('should verify unassigned seed restaurant (THE ENCASA BISTRO) remains unassigned and unmodified', async () => {
      const encasa = await prisma.restaurants.findFirst({
        where: { name: 'THE ENCASA BISTRO' },
      });

      expect(encasa).toBeDefined();
      if (encasa) {
        // Must remain intact with null owner
        expect(encasa.owner_id).toBeNull();
        expect(encasa.legal_name).toBe('THE ENCASA BISTRO COFFEE BAR AND DINE');
      }
    });
  });
});
