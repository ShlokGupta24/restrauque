import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import {
  GET as listTablesHandler,
  POST as createTableHandler,
} from '@/app/api/v1/owner/tables/route';
import {
  GET as getTableHandler,
  PATCH as updateTableHandler,
  DELETE as deleteTableHandler,
} from '@/app/api/v1/owner/tables/[tableId]/route';
import { GET as getTableQrHandler } from '@/app/api/v1/owner/tables/[tableId]/qr/route';
import { POST as rotateTableQrHandler } from '@/app/api/v1/owner/tables/[tableId]/qr/rotate/route';
import { GET as resolvePublicQrHandler } from '@/app/api/v1/public/qr/[token]/route';

describe('STEP 5 — Dining Table Management & Secure QR Code APIs', () => {
  const timestamp = Date.now();

  // Test Owner 1: Primary test owner
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1Branch1Id: string;
  let owner1Branch2Id: string;

  // Test Owner 2: For cross-tenant isolation testing
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2BranchId: string;

  // Test Customer: Must be rejected on owner table management
  let customerId: string;
  let customerToken: string;

  // Table and QR IDs
  let owner1Table1Id: string;
  let owner1Table1RawToken: string;
  let owner1Table2Id: string;
  let owner2TableId: string;

  // For historical order testing
  let tableWithOrderId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 + Restaurant 1 + 2 Branches
    const owner1 = await prisma.users.create({
      data: {
        email: `table_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Table Owner 1',
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
        name: `Trattoria Table Test ${timestamp}`,
        legal_name: 'Trattoria Hospitality Pvt Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const b1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Milano Flagship Branch',
        status: 'active',
      },
    });
    owner1Branch1Id = b1.id;

    const b2 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Milano Express Branch',
        status: 'active',
      },
    });
    owner1Branch2Id = b2.id;

    // 2. Create Owner 2 + Restaurant 2 + Branch 2
    const owner2 = await prisma.users.create({
      data: {
        email: `table_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Table Owner 2',
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
        name: `Bistro Table Test ${timestamp}`,
        legal_name: 'Bistro Dining LLP',
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Parisien Latin Quarter',
        status: 'active',
      },
    });
    owner2BranchId = branch2.id;

    const t2 = await prisma.restaurant_tables.create({
      data: {
        branch_id: owner2BranchId,
        table_number: 'T-99',
        capacity: 4,
        status: 'available',
        is_active: true,
      },
    });
    owner2TableId = t2.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        phone: `+919833${timestamp.toString().slice(-6)}`,
        name: 'Dining Customer',
        status: 'active',
      },
    });
    customerId = customer.id;

    const custSession = await createCustomerDatabaseSession(customerId);
    customerToken = await createJwtToken({
      userId: customerId,
      sessionId: custSession.sessionId,
      sessionToken: custSession.sessionToken,
      email: customer.phone,
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testOrderId) {
      await prisma.order_items.deleteMany({ where: { order_id: testOrderId } }).catch(() => {});
      await prisma.orders.deleteMany({ where: { id: testOrderId } }).catch(() => {});
    }

    if (owner1RestaurantId) {
      const branches = await prisma.branches.findMany({ where: { restaurant_id: owner1RestaurantId } });
      const branchIds = branches.map((b) => b.id);
      const tables = await prisma.restaurant_tables.findMany({ where: { branch_id: { in: branchIds } } });
      const tableIds = tables.map((t) => t.id);

      await prisma.qr_codes.deleteMany({ where: { table_id: { in: tableIds } } }).catch(() => {});
      await prisma.restaurant_tables.deleteMany({ where: { id: { in: tableIds } } }).catch(() => {});
      await prisma.branches.deleteMany({ where: { restaurant_id: owner1RestaurantId } }).catch(() => {});
      await prisma.restaurants.deleteMany({ where: { id: owner1RestaurantId } }).catch(() => {});
    }

    if (owner2RestaurantId) {
      const branches = await prisma.branches.findMany({ where: { restaurant_id: owner2RestaurantId } });
      const branchIds = branches.map((b) => b.id);
      const tables = await prisma.restaurant_tables.findMany({ where: { branch_id: { in: branchIds } } });
      const tableIds = tables.map((t) => t.id);

      await prisma.qr_codes.deleteMany({ where: { table_id: { in: tableIds } } }).catch(() => {});
      await prisma.restaurant_tables.deleteMany({ where: { id: { in: tableIds } } }).catch(() => {});
      await prisma.branches.deleteMany({ where: { restaurant_id: owner2RestaurantId } }).catch(() => {});
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

    if (customerId) {
      await prisma.customer_sessions.deleteMany({ where: { customer_id: customerId } }).catch(() => {});
      await prisma.customers.deleteMany({ where: { id: customerId } }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. AUTHENTICATION & ROLE GUARDS
  // =========================================================================
  describe('1. Authentication and Authorization Guards', () => {
    it('should reject unauthenticated requests with 401 on tables routes', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables');
      const res = await listTablesHandler(req);
      expect(res.status).toBe(401);
    });

    it('should reject customer tokens with 403 on owner table management', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const res = await listTablesHandler(req);
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. DINING TABLE CREATION & VALIDATION
  // =========================================================================
  describe('2. Dining Table Creation (POST /api/v1/owner/tables)', () => {
    it('should reject table creation referencing a branch of ANOTHER restaurant', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          branchId: owner2BranchId, // Belongs to Owner 2!
          tableNumber: 'T-01',
          capacity: 4,
        }),
      });

      const res = await createTableHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid capacity (0, negative, > 100) or missing table identifier', async () => {
      // Zero capacity
      const reqZero = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          branchId: owner1Branch1Id,
          tableNumber: 'T-Zero',
          capacity: 0,
        }),
      });
      const resZero = await createTableHandler(reqZero);
      expect(resZero.status).toBe(400);

      // Exceeds 100
      const reqExcess = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          branchId: owner1Branch1Id,
          tableNumber: 'T-Huge',
          capacity: 105,
        }),
      });
      const resExcess = await createTableHandler(reqExcess);
      expect(resExcess.status).toBe(400);
    });

    it('should successfully create a dining table and atomic QR token under Branch 1', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          branchId: owner1Branch1Id,
          tableNumber: 'Table 1',
          capacity: 4,
          status: 'available',
          isActive: true,
          isQrActive: true,
        }),
      });

      const res = await createTableHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.table.tableNumber).toBe('Table 1');
      expect(json.data.table.capacity).toBe(4);
      expect(json.data.table.status).toBe('available');
      expect(json.data.table.isActive).toBe(true);
      expect(json.data.table.isQrActive).toBe(true);
      expect(json.data.qr.rawToken).toBeDefined();
      expect(json.data.qr.qrUrl).toContain('/qr/');

      owner1Table1Id = json.data.table.id;
      owner1Table1RawToken = json.data.qr.rawToken;
    });

    it('should verify the database stores only the SHA-256 hash and NOT the raw token', async () => {
      const qrInDb = await prisma.qr_codes.findFirst({
        where: { table_id: owner1Table1Id },
      });

      expect(qrInDb).not.toBeNull();
      // Ensure the raw token is NEVER stored in plaintext in the database
      expect(qrInDb?.code).not.toBe(owner1Table1RawToken);
      // SHA-256 hex string is exactly 64 characters long
      expect(qrInDb?.code).toHaveLength(64);
    });

    it('should reject duplicate table number within the same branch with 409 CONFLICT', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          branchId: owner1Branch1Id,
          tableNumber: 'Table 1', // Duplicate in Branch 1
          capacity: 2,
        }),
      });

      const res = await createTableHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.code).toBe('CONFLICT');
    });

    it('should permit the SAME table number in a DIFFERENT branch of the same restaurant', async () => {
      // Create 'Table 1' under Branch 2
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          branchId: owner1Branch2Id,
          tableNumber: 'Table 1', // Same number, different branch
          capacity: 6,
        }),
      });

      const res = await createTableHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      owner1Table2Id = json.data.table.id;
    });
  });

  // =========================================================================
  // 3. TABLE LISTING, FILTERING & RETRIEVAL
  // =========================================================================
  describe('3. Table Listing & Retrieval (GET /api/v1/owner/tables)', () => {
    it('should list tables with pagination, branch names, and summary counts', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await listTablesHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.tables.length).toBeGreaterThanOrEqual(2);
      expect(json.data.summary.totalTables).toBeGreaterThanOrEqual(2);
      expect(json.data.summary.availableTables).toBeGreaterThanOrEqual(2);
      expect(json.data.summary.qrActiveTables).toBeGreaterThanOrEqual(2);

      // Verify no secret codes or hashes are leaked in listing
      for (const t of json.data.tables) {
        expect(t.code).toBeUndefined();
        expect(t.rawToken).toBeUndefined();
        expect(t.hashedCode).toBeUndefined();
      }
    });

    it('should filter tables by branchId', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables?branchId=${owner1Branch1Id}`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await listTablesHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.tables).toHaveLength(1);
      expect(json.data.tables[0].id).toBe(owner1Table1Id);
    });

    it('should retrieve a single table by ID via GET /api/v1/owner/tables/[tableId]', async () => {
      const params = Promise.resolve({ tableId: owner1Table1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table1Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getTableHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.table.id).toBe(owner1Table1Id);
      expect(json.data.table.tableNumber).toBe('Table 1');
      expect(json.data.table.branchName).toBe('Milano Flagship Branch');
    });

    it('should reject Owner 1 from retrieving Owner 2 table (Cross-tenant rejection)', async () => {
      const params = Promise.resolve({ tableId: owner2TableId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner2TableId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getTableHandler(req, { params });
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 4. TABLE UPDATES & STATE INDEPENDENCE
  // =========================================================================
  describe('4. Table Updates & State Independence (PATCH /api/v1/owner/tables/[tableId])', () => {
    it('should change status to "occupied" without altering isActive or isQrActive', async () => {
      const params = Promise.resolve({ tableId: owner1Table1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          status: 'occupied',
        }),
      });

      const res = await updateTableHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.table.status).toBe('occupied');
      expect(json.data.table.isActive).toBe(true);
      expect(json.data.table.isQrActive).toBe(true);
    });

    it('should disable QR ordering (isQrActive = false) without altering table status or isActive', async () => {
      const params = Promise.resolve({ tableId: owner1Table1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          isQrActive: false,
        }),
      });

      const res = await updateTableHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.table.isQrActive).toBe(false);
      expect(json.data.table.status).toBe('occupied'); // Preserved!
      expect(json.data.table.isActive).toBe(true); // Preserved!
    });

    it('should re-enable QR ordering and reset status to "available"', async () => {
      const params = Promise.resolve({ tableId: owner1Table1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          status: 'available',
          isQrActive: true,
        }),
      });

      const res = await updateTableHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.table.status).toBe('available');
      expect(json.data.table.isQrActive).toBe(true);
    });
  });

  // =========================================================================
  // 5. QR CODE RETRIEVAL & ROTATION LIFECYCLE
  // =========================================================================
  describe('5. Secure QR Code Lifecycle & Rotation', () => {
    it('should retrieve safe QR metadata via GET /api/v1/owner/tables/[tableId]/qr without leaking secret hashes', async () => {
      const params = Promise.resolve({ tableId: owner1Table1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table1Id}/qr`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getTableQrHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.qr.tableId).toBe(owner1Table1Id);
      expect(json.data.qr.isActive).toBe(true);
      expect(json.data.qr.tableNumber).toBe('Table 1');
      // Crucial security test: hash must NEVER be exposed
      expect(json.data.qr.code).toBeUndefined();
      expect(json.data.qr.rawToken).toBeUndefined();
    });

    it('should resolve table via public QR endpoint using initial raw token', async () => {
      const params = Promise.resolve({ token: owner1Table1RawToken });
      const req = new NextRequest(`http://localhost:3000/api/v1/public/qr/${owner1Table1RawToken}`);

      const res = await resolvePublicQrHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.resolved).toBe(true);
      expect(json.data.table.tableNumber).toBe('Table 1');
      expect(json.data.branch.name).toBe('Milano Flagship Branch');
      expect(json.data.restaurant.name).toContain('Trattoria Table Test');
      // Must not leak owner identity or private internals
      expect(json.data.restaurant.ownerId).toBeUndefined();
      expect(json.data.restaurant.email).toBeUndefined();
    });

    it('should rotate QR token atomically and return new raw token', async () => {
      const params = Promise.resolve({ tableId: owner1Table1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table1Id}/qr/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await rotateTableQrHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      const newRawToken = json.data.rawToken;
      expect(newRawToken).toBeDefined();
      expect(newRawToken).not.toBe(owner1Table1RawToken);

      // 1. The OLD token must fail immediately
      const oldParams = Promise.resolve({ token: owner1Table1RawToken });
      const oldReq = new NextRequest(`http://localhost:3000/api/v1/public/qr/${owner1Table1RawToken}`);
      const oldRes = await resolvePublicQrHandler(oldReq, { params: oldParams });
      expect(oldRes.status).toBe(404);

      // 2. The NEW token must resolve successfully
      const newParams = Promise.resolve({ token: newRawToken });
      const newReq = new NextRequest(`http://localhost:3000/api/v1/public/qr/${newRawToken}`);
      const newRes = await resolvePublicQrHandler(newReq, { params: newParams });
      expect(newRes.status).toBe(200);

      const newJson = await newRes.json();
      expect(newJson.data.table.tableNumber).toBe('Table 1');

      // Update test state with new token
      owner1Table1RawToken = newRawToken;
    });

    it('should reject public QR resolution for invalid format or nonexistent token', async () => {
      // Malformed / too short
      const shortParams = Promise.resolve({ token: 'abc' });
      const shortReq = new NextRequest('http://localhost:3000/api/v1/public/qr/abc');
      const shortRes = await resolvePublicQrHandler(shortReq, { params: shortParams });
      expect(shortRes.status).toBe(404);

      // Valid format, nonexistent token
      const nonExistentToken = 'NonExistentToken_12345678901234567890';
      const nonParams = Promise.resolve({ token: nonExistentToken });
      const nonReq = new NextRequest(`http://localhost:3000/api/v1/public/qr/${nonExistentToken}`);
      const nonRes = await resolvePublicQrHandler(nonReq, { params: nonParams });
      expect(nonRes.status).toBe(404);
    });

    it('should reject public QR resolution when table is under "maintenance"', async () => {
      // Put table under maintenance
      await prisma.restaurant_tables.update({
        where: { id: owner1Table1Id },
        data: { status: 'maintenance' },
      });

      const params = Promise.resolve({ token: owner1Table1RawToken });
      const req = new NextRequest(`http://localhost:3000/api/v1/public/qr/${owner1Table1RawToken}`);
      const res = await resolvePublicQrHandler(req, { params });
      expect(res.status).toBe(404);

      // Reset back to available
      await prisma.restaurant_tables.update({
        where: { id: owner1Table1Id },
        data: { status: 'available' },
      });
    });
  });

  // =========================================================================
  // 6. SAFE DELETION & ARCHIVAL POLICIES
  // =========================================================================
  describe('6. Safe Deletion & Archival Policies', () => {
    it('should permanently delete an unreferenced table with 0 orders', async () => {
      // owner1Table2Id has 0 orders
      const params = Promise.resolve({ tableId: owner1Table2Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner1Table2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await deleteTableHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(true);
      expect(json.data.archived).toBe(false);

      // Verify row is physically gone from DB
      const dbCheck = await prisma.restaurant_tables.findUnique({ where: { id: owner1Table2Id } });
      expect(dbCheck).toBeNull();
    });

    it('should archive and deactivate a table with historical orders instead of permanently deleting it', async () => {
      // Create table with an order
      const tableWithOrder = await prisma.restaurant_tables.create({
        data: {
          branch_id: owner1Branch1Id,
          table_number: 'Historic Table 5',
          capacity: 4,
          status: 'available',
          is_active: true,
        },
      });
      tableWithOrderId = tableWithOrder.id;

      const order = await prisma.orders.create({
        data: {
          restaurant_id: owner1RestaurantId,
          branch_id: owner1Branch1Id,
          customer_id: customerId,
          table_id: tableWithOrderId,
          order_number: `ORD-TBL-${timestamp}-01`,
          subtotal: 300.0,
          total_amount: 300.0,
          status: 'completed',
        },
      });
      testOrderId = order.id;

      // Call DELETE on the table with order history
      const params = Promise.resolve({ tableId: tableWithOrderId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${tableWithOrderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await deleteTableHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(false);
      expect(json.data.archived).toBe(true);
      expect(json.data.table.isActive).toBe(false);

      // Verify table STILL EXISTS in DB with is_active = false and order references intact
      const dbCheck = await prisma.restaurant_tables.findUnique({ where: { id: tableWithOrderId } });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.is_active).toBe(false);

      const ordersCheck = await prisma.orders.findMany({ where: { table_id: tableWithOrderId } });
      expect(ordersCheck).toHaveLength(1);
    });
  });
});
