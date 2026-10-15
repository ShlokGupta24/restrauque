import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import {
  GET as listCouponsHandler,
  POST as createCouponHandler,
} from '@/app/api/v1/owner/coupons/route';
import {
  GET as getCouponHandler,
  PATCH as updateCouponHandler,
  DELETE as deleteCouponHandler,
} from '@/app/api/v1/owner/coupons/[couponId]/route';

describe('STEP 9B: Owner Coupon Management CRUD, RBAC, and Isolation Integration Tests', () => {
  const timestamp = Date.now();

  // Test Owner 1: Primary authorized venue
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1BranchId: string;
  let owner1TableId: string;

  // Test Owner 2: For cross-tenant isolation testing
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;

  // Customer: Must be rejected on owner routes
  let customerId: string;
  let customerToken: string;

  // Track created coupon IDs
  let coupon1Id: string;
  let coupon2Id: string;
  let couponForeignId: string;
  let couponWithOrderId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 + Restaurant 1 + Branch 1 + Table 1
    const owner1 = await prisma.users.create({
      data: {
        email: `coupons_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Coupons Owner 1',
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

    const rest1 = await prisma.restaurants.create({
      data: {
        name: `Coupons Bistro ${timestamp}`,
        legal_name: 'Bistro Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Main Branch',
        status: 'active',
      },
    });
    owner1BranchId = branch1.id;

    const table1 = await prisma.restaurant_tables.create({
      data: {
        branch_id: owner1BranchId,
        table_number: 'T-CP-1',
        capacity: 4,
        status: 'active',
      },
    });
    owner1TableId = table1.id;

    // 2. Create Owner 2 + Restaurant 2
    const owner2 = await prisma.users.create({
      data: {
        email: `coupons_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Coupons Owner 2',
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

    const rest2 = await prisma.restaurants.create({
      data: {
        name: `Foreign Coupons Cafe ${timestamp}`,
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        name: 'Coupon Customer',
        phone: `+9198${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customerId = customer.id;

    const custSession = await createCustomerDatabaseSession(customerId);
    customerToken = await createJwtToken({
      userId: customerId,
      sessionId: custSession.sessionId,
      sessionToken: custSession.sessionToken,
      email: `${customerId}@cust.local`,
      role: 'CUSTOMER',
    });

    // 4. Create coupon with historical order reference
    const couponWithOrder = await prisma.coupons.create({
      data: {
        restaurant_id: owner1RestaurantId,
        code: 'HISTORICAL10',
        name: 'Historical Coupon',
        discount_type: 'percentage',
        discount_value: 10,
        minimum_order_amount: 100,
        maximum_discount_amount: 50,
        usage_limit: 100,
        usage_count: 1,
        is_active: true,
      },
    });
    couponWithOrderId = couponWithOrder.id;

    const order = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1BranchId,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-HIST-${timestamp.toString().slice(-6)}`,
        status: 'completed',
        subtotal: 200,
        discount_amount: 20,
        tax_amount: 0,
        total_amount: 180,
      },
    });
    testOrderId = order.id;

    await prisma.order_coupons.create({
      data: {
        order_id: testOrderId,
        coupon_id: couponWithOrderId,
        coupon_code: 'HISTORICAL10',
        discount_type: 'percentage',
        discount_value: 10,
        discount_amount: 20,
      },
    });

    // 5. Create foreign coupon belonging to Owner 2
    const foreignCoupon = await prisma.coupons.create({
      data: {
        restaurant_id: owner2RestaurantId,
        code: 'FOREIGN50',
        name: 'Owner 2 Coupon',
        discount_type: 'fixed',
        discount_value: 50,
        is_active: true,
      },
    });
    couponForeignId = foreignCoupon.id;
  });

  afterAll(async () => {
    try {
      if (testOrderId) {
        await prisma.order_coupons.deleteMany({ where: { order_id: testOrderId } }).catch(() => {});
        await prisma.orders.deleteMany({ where: { id: testOrderId } }).catch(() => {});
      }

      await prisma.coupons
        .deleteMany({
          where: {
            restaurant_id: { in: [owner1RestaurantId, owner2RestaurantId].filter(Boolean) },
          },
        })
        .catch(() => {});

      if (owner1TableId) {
        await prisma.restaurant_tables.deleteMany({ where: { id: owner1TableId } }).catch(() => {});
      }
      if (owner1BranchId) {
        await prisma.branches.deleteMany({ where: { id: owner1BranchId } }).catch(() => {});
      }
      if (owner1RestaurantId) {
        await prisma.restaurants.deleteMany({ where: { id: owner1RestaurantId } }).catch(() => {});
      }
      if (owner2RestaurantId) {
        await prisma.restaurants.deleteMany({ where: { id: owner2RestaurantId } }).catch(() => {});
      }
      if (customerId) {
        await prisma.customer_sessions.deleteMany({ where: { customer_id: customerId } }).catch(() => {});
        await prisma.customers.deleteMany({ where: { id: customerId } }).catch(() => {});
      }
      if (owner1Id) {
        await prisma.user_sessions.deleteMany({ where: { user_id: owner1Id } }).catch(() => {});
        await prisma.users.deleteMany({ where: { id: owner1Id } }).catch(() => {});
      }
      if (owner2Id) {
        await prisma.user_sessions.deleteMany({ where: { user_id: owner2Id } }).catch(() => {});
        await prisma.users.deleteMany({ where: { id: owner2Id } }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Authentication & RBAC Enforcement', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'GET',
      });
      const res = await listCouponsHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject CUSTOMER role with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });
      const res = await listCouponsHandler(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. POST /api/v1/owner/coupons (Creation & Code Normalization)', () => {
    it('should successfully create a new coupon and normalize code to uppercase', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: '  welcome20  ',
          name: 'Welcome 20% Off',
          description: 'Special first-order discount',
          discountType: 'percentage',
          discountValue: 20,
          minimumOrderAmount: 250,
          maximumDiscountAmount: 100,
          usageLimit: 200,
          isActive: true,
        }),
      });

      const res = await createCouponHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.coupon.code).toBe('WELCOME20');
      expect(json.data.coupon.name).toBe('Welcome 20% Off');
      expect(json.data.coupon.discountType).toBe('percentage');
      expect(json.data.coupon.discountValue).toBe(20);
      expect(json.data.coupon.discountValueFormatted).toBe('20.00');
      expect(json.data.coupon.minimumOrderAmount).toBe(250);
      expect(json.data.coupon.maximumDiscountAmount).toBe(100);
      expect(json.data.coupon.restaurantId).toBe(owner1RestaurantId);
      expect(json.data.coupon.usageCount).toBe(0);
      expect(json.data.coupon.status).toBe('active');

      coupon1Id = json.data.coupon.id;
    });

    it('should reject duplicate coupon code for the same restaurant with 409 Conflict', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'welcome20', // Case-insensitive duplicate
          name: 'Another Welcome',
          discountType: 'percentage',
          discountValue: 20,
        }),
      });

      const res = await createCouponHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
      expect(json.error.message).toContain('already exists');
    });

    it('should ALLOW the same coupon code for a DIFFERENT restaurant', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${owner2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'WELCOME20',
          name: 'Owner 2 Welcome',
          discountType: 'fixed',
          discountValue: 50,
        }),
      });

      const res = await createCouponHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.coupon.code).toBe('WELCOME20');
      expect(json.data.coupon.restaurantId).toBe(owner2RestaurantId);
    });

    it('should create a second coupon for filtering tests', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'FLAT75',
          name: 'Flat Rs 75 Off',
          discountType: 'fixed',
          discountValue: 75,
          minimumOrderAmount: 300,
          isActive: false, // inactive for filtering test
        }),
      });

      const res = await createCouponHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.coupon.status).toBe('inactive');
      coupon2Id = json.data.coupon.id;
    });
  });

  describe('3. GET /api/v1/owner/coupons (Collection, Search, & Summary Counters)', () => {
    it('should list coupons scoped exclusively to Owner 1 with summary counters', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await listCouponsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.coupons)).toBe(true);

      // Verify all returned coupons belong to Owner 1
      for (const coupon of json.data.coupons) {
        expect(coupon.restaurantId).toBe(owner1RestaurantId);
      }

      // Check summary counters
      expect(json.data.summary.totalCoupons).toBeGreaterThanOrEqual(3); // HISTORICAL10 + WELCOME20 + FLAT75
      expect(json.data.summary.activeCoupons).toBeGreaterThanOrEqual(2);
      expect(json.data.summary.inactiveCoupons).toBeGreaterThanOrEqual(1); // FLAT75 is inactive
    });

    it('should filter by isActive = true', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons?isActive=true', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await listCouponsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      for (const coupon of json.data.coupons) {
        expect(coupon.isActive).toBe(true);
      }
    });

    it('should search by code or name', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons?search=FLAT75', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await listCouponsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.coupons.length).toBe(1);
      expect(json.data.coupons[0].code).toBe('FLAT75');
    });
  });

  describe('4. GET /api/v1/owner/coupons/[couponId] (Detail & Cross-Tenant Isolation)', () => {
    it('should return coupon detail for authorized owner', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${coupon1Id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await getCouponHandler(req, {
        params: Promise.resolve({ couponId: coupon1Id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.coupon.id).toBe(coupon1Id);
      expect(json.data.coupon.code).toBe('WELCOME20');
      expect(json.data.coupon.status).toBe('active');
    });

    it('should return 404 when Owner 1 attempts to access Owner 2 foreign coupon', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${couponForeignId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await getCouponHandler(req, {
        params: Promise.resolve({ couponId: couponForeignId }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('5. PATCH /api/v1/owner/coupons/[couponId] (Partial Updates & Constraints)', () => {
    it('should reject empty update body with 400', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${coupon1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const res = await updateCouponHandler(req, {
        params: Promise.resolve({ couponId: coupon1Id }),
      });
      expect(res.status).toBe(400);
    });

    it('should partially update coupon and preserve omitted fields', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${coupon1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Welcome Offer',
          discountValue: 25,
        }),
      });

      const res = await updateCouponHandler(req, {
        params: Promise.resolve({ couponId: coupon1Id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.coupon.name).toBe('Updated Welcome Offer');
      expect(json.data.coupon.discountValue).toBe(25);
      expect(json.data.coupon.code).toBe('WELCOME20'); // Preserved
      expect(json.data.coupon.minimumOrderAmount).toBe(250); // Preserved
    });

    it('should reject lowering usageLimit below existing usage_count with 409 Conflict', async () => {
      // couponWithOrderId has usage_count = 1
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${couponWithOrderId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usageLimit: 0, // Lower than 1 (and 0 is rejected by min(1) or conflict check)
        }),
      });

      const res = await updateCouponHandler(req, {
        params: Promise.resolve({ couponId: couponWithOrderId }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 when attempting to PATCH foreign-restaurant coupon', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${couponForeignId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Malicious Edit',
        }),
      });

      const res = await updateCouponHandler(req, {
        params: Promise.resolve({ couponId: couponForeignId }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('6. DELETE /api/v1/owner/coupons/[couponId] (Safe Archival & Deletion)', () => {
    it('should permanently HARD DELETE unreferenced coupon', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${coupon2Id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await deleteCouponHandler(req, {
        params: Promise.resolve({ couponId: coupon2Id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(true);
      expect(json.data.archived).toBe(false);

      // Verify record is gone from DB
      const record = await prisma.coupons.findUnique({ where: { id: coupon2Id } });
      expect(record).toBeNull();
    });

    it('should ARCHIVE (is_active = false) coupon when historical orders reference it', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${couponWithOrderId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await deleteCouponHandler(req, {
        params: Promise.resolve({ couponId: couponWithOrderId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(false);
      expect(json.data.archived).toBe(true);

      // Verify record still exists in DB but is_active is false
      const record = await prisma.coupons.findUnique({ where: { id: couponWithOrderId } });
      expect(record).not.toBeNull();
      expect(record?.is_active).toBe(false);

      // Verify historical order snapshot is completely untouched
      const orderCoupon = await prisma.order_coupons.findFirst({
        where: { coupon_id: couponWithOrderId },
      });
      expect(orderCoupon).not.toBeNull();
      expect(orderCoupon?.coupon_code).toBe('HISTORICAL10');
    });

    it('should return deterministic response on REPEATED deletion of already archived coupon', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${couponWithOrderId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await deleteCouponHandler(req, {
        params: Promise.resolve({ couponId: couponWithOrderId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(false);
      expect(json.data.archived).toBe(true);
      expect(json.data.message).toBe('Coupon is already archived.');
    });

    it('should catch foreign-key race condition (P2003) on delete and safely fallback to archival', async () => {
      const raceCoupon = await prisma.coupons.create({
        data: {
          restaurant_id: owner1RestaurantId,
          code: 'RACEFALLBACK',
          name: 'Race Fallback Test',
          discount_type: 'fixed',
          discount_value: 30,
          is_active: true,
        },
      });

      const deleteSpy = vi.spyOn(prisma.coupons, 'delete').mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
          code: 'P2003',
          clientVersion: '6.4.1',
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${raceCoupon.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await deleteCouponHandler(req, {
        params: Promise.resolve({ couponId: raceCoupon.id }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(false);
      expect(json.data.archived).toBe(true);
      expect(json.data.message).toContain('archived');

      deleteSpy.mockRestore();

      await prisma.coupons.deleteMany({ where: { id: raceCoupon.id } }).catch(() => {});
    });

    it('should return 404 when Owner 1 attempts to DELETE foreign-restaurant coupon', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${couponForeignId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
        },
      });

      const res = await deleteCouponHandler(req, {
        params: Promise.resolve({ couponId: couponForeignId }),
      });
      expect(res.status).toBe(404);
    });
  });
});
