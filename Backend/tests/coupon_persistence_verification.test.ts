import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import {
  GET as listCouponsHandler,
  POST as createCouponHandler,
} from '@/app/api/v1/owner/coupons/route';
import {
  GET as getCouponHandler,
  PATCH as updateCouponHandler,
} from '@/app/api/v1/owner/coupons/[couponId]/route';

describe('Regression & Persistence: Coupon Creation and Refresh Persistence Verification', () => {
  const timestamp = Date.now();

  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;

  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;

  let createdCouponId: string;
  const testCouponCode = `PERSIST_${timestamp.toString().slice(-6)}`;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecurePassword123!');

    // 1. Create Owner 1 & Restaurant 1
    const owner1 = await prisma.users.create({
      data: {
        email: `persist_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Persist Owner 1',
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
        name: `Persistence Cafe ${timestamp}`,
        legal_name: 'Persistence Cafe Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    // 2. Create Owner 2 & Restaurant 2 (for tenant isolation check)
    const owner2 = await prisma.users.create({
      data: {
        email: `persist_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Persist Owner 2',
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
        name: `Foreign Cafe ${timestamp}`,
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;
  });

  afterAll(async () => {
    try {
      await prisma.coupons
        .deleteMany({
          where: {
            restaurant_id: { in: [owner1RestaurantId, owner2RestaurantId].filter(Boolean) },
          },
        })
        .catch(() => {});

      if (owner1RestaurantId) {
        await prisma.restaurants.deleteMany({ where: { id: owner1RestaurantId } }).catch(() => {});
      }
      if (owner2RestaurantId) {
        await prisma.restaurants.deleteMany({ where: { id: owner2RestaurantId } }).catch(() => {});
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

  it('1. should create a valid coupon via POST and return 201 only after database write succeeds', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${owner1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: testCouponCode,
        name: 'Summer Refresh Special',
        description: 'Persistent 15% discount for dine-in guests',
        discountType: 'percentage',
        discountValue: 15,
        minimumOrderAmount: 200,
        maximumDiscountAmount: 75,
        usageLimit: 50,
        isActive: true,
      }),
    });

    const res = await createCouponHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.coupon.code).toBe(testCouponCode.toUpperCase());
    expect(json.data.coupon.name).toBe('Summer Refresh Special');
    expect(json.data.coupon.discountValue).toBe(15);
    expect(json.data.coupon.restaurantId).toBe(owner1RestaurantId);

    createdCouponId = json.data.coupon.id;
    expect(createdCouponId).toBeDefined();

    // Directly verify that Neon PostgreSQL database has persisted the record!
    const persisted = await prisma.coupons.findUnique({
      where: { id: createdCouponId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.code).toBe(testCouponCode.toUpperCase());
    expect(Number(persisted!.discount_value)).toBe(15);
    expect(persisted!.restaurant_id).toBe(owner1RestaurantId);
  });

  it('2. should retrieve the newly created coupon on subsequent GET request (simulating page refresh)', async () => {
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

    const match = json.data.coupons.find((c: any) => c.id === createdCouponId);
    expect(match).toBeDefined();
    expect(match.code).toBe(testCouponCode.toUpperCase());
    expect(match.name).toBe('Summer Refresh Special');
    expect(match.discountValue).toBe(15);
    expect(match.isActive).toBe(true);
  });

  it('3. should retrieve coupon details directly by ID (simulating edit page load after navigation)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/owner/coupons/${createdCouponId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    const res = await getCouponHandler(req, {
      params: Promise.resolve({ couponId: createdCouponId }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.coupon.id).toBe(createdCouponId);
    expect(json.data.coupon.code).toBe(testCouponCode.toUpperCase());
    expect(json.data.coupon.status).toBe('active');
  });

  it('4. should update active status via PATCH and persist state changes across subsequent requests', async () => {
    const patchReq = new NextRequest(
      `http://localhost:3000/api/v1/owner/coupons/${createdCouponId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: false,
        }),
      }
    );

    const patchRes = await updateCouponHandler(patchReq, {
      params: Promise.resolve({ couponId: createdCouponId }),
    });
    expect(patchRes.status).toBe(200);

    const patchJson = await patchRes.json();
    expect(patchJson.success).toBe(true);
    expect(patchJson.data.coupon.isActive).toBe(false);

    // Verify in database directly
    const updatedInDb = await prisma.coupons.findUnique({
      where: { id: createdCouponId },
    });
    expect(updatedInDb!.is_active).toBe(false);

    // Verify in subsequent GET list
    const getReq = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    const getRes = await listCouponsHandler(getReq);
    const getJson = await getRes.json();
    const match = getJson.data.coupons.find((c: any) => c.id === createdCouponId);
    expect(match).toBeDefined();
    expect(match.isActive).toBe(false);
  });

  it('5. should reject validation failure and not create any database records', async () => {
    const countBefore = await prisma.coupons.count({
      where: { restaurant_id: owner1RestaurantId },
    });

    const invalidReq = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${owner1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'BAD',
        name: 'Invalid Percentage',
        discountType: 'percentage',
        discountValue: 150, // Invalid: exceeds 100%
      }),
    });

    const res = await createCouponHandler(invalidReq);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);

    const countAfter = await prisma.coupons.count({
      where: { restaurant_id: owner1RestaurantId },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('6. should reject cross-tenant access and isolate coupons between restaurants', async () => {
    // Owner 2 tries to GET Owner 1's coupon
    const foreignGetReq = new NextRequest(
      `http://localhost:3000/api/v1/owner/coupons/${createdCouponId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${owner2Token}`,
        },
      }
    );

    const foreignRes = await getCouponHandler(foreignGetReq, {
      params: Promise.resolve({ couponId: createdCouponId }),
    });
    expect(foreignRes.status).toBe(404);

    // Owner 2's coupon list should NOT contain Owner 1's coupon
    const owner2ListReq = new NextRequest('http://localhost:3000/api/v1/owner/coupons', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${owner2Token}`,
      },
    });

    const owner2ListRes = await listCouponsHandler(owner2ListReq);
    const owner2Json = await owner2ListRes.json();
    const foreignMatch = owner2Json.data.coupons.find((c: any) => c.id === createdCouponId);
    expect(foreignMatch).toBeUndefined();
  });
});
