import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { GET as listOwnerOrdersHandler } from '@/app/api/v1/owner/orders/route';
import { GET as getOwnerOrderDetailHandler } from '@/app/api/v1/owner/orders/[orderId]/route';
import { PATCH as updateOwnerOrderStatusHandler } from '@/app/api/v1/owner/orders/[orderId]/status/route';

describe('STEP 7B — Restaurant Owner Order Management APIs', () => {
  const timestamp = Date.now();

  // Test Owner 1: Primary authorized venue
  let owner1Id: string;
  let owner1Token: string;
  let restaurant1Id: string;
  let branch1Id: string;
  let branch2Id: string;
  let table1Id: string;

  // Test Owner 2: For cross-tenant isolation testing
  let owner2Id: string;
  let owner2Token: string;
  let restaurant2Id: string;
  let branch3Id: string;

  // Customer: To place orders and test role rejection
  let customer1Id: string;
  let customer1Token: string;

  // Test Orders for Owner 1
  let order1Id: string;
  let order2Id: string;
  let orderForStatusTestsId: string;

  // Test Order for Owner 2 (Cross-tenant)
  let orderForeignId: string;

  // Catalog items for snapshot verification
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let addonId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecurePass123!');

    // 1. Create Owner 1 & Sessions
    const owner1 = await prisma.users.create({
      data: {
        email: `owner_orders_${timestamp}_1@test.com`,
        password_hash: passwordHash,
        name: 'Owner One',
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

    // 2. Create Restaurant 1 with 2 Branches
    const rest1 = await prisma.restaurants.create({
      data: {
        name: `Restraque Dine ${timestamp}`,
        legal_name: 'Dine Cafe Pvt Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    restaurant1Id = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: restaurant1Id,
        name: 'Downtown Main Branch',
        status: 'active',
      },
    });
    branch1Id = branch1.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: restaurant1Id,
        name: 'Uptown Express Branch',
        status: 'active',
      },
    });
    branch2Id = branch2.id;

    // 3. Create Table for Branch 1
    const table1 = await prisma.restaurant_tables.create({
      data: {
        branch_id: branch1Id,
        table_number: `T-01-${timestamp.toString().slice(-4)}`,
        capacity: 4,
        status: 'available',
        is_active: true,
      },
    });
    table1Id = table1.id;

    // 4. Create Owner 2 & Restaurant 2 (Foreign Tenant)
    const owner2 = await prisma.users.create({
      data: {
        email: `owner_orders_${timestamp}_2@test.com`,
        password_hash: passwordHash,
        name: 'Owner Two',
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
    restaurant2Id = rest2.id;

    const branch3 = await prisma.branches.create({
      data: {
        restaurant_id: restaurant2Id,
        name: 'Foreign Branch',
        status: 'active',
      },
    });
    branch3Id = branch3.id;

    // 5. Create Customer 1
    const customer = await prisma.customers.create({
      data: {
        name: 'Priya Sharma',
        phone: `+9198${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customer1Id = customer.id;

    const custSession = await createCustomerDatabaseSession(customer1Id);
    customer1Token = await createJwtToken({
      userId: customer1Id,
      sessionId: custSession.sessionId,
      sessionToken: custSession.sessionToken,
      email: `${customer1Id}@customer.local`,
      role: 'CUSTOMER',
    });

    // 6. Create Menu Catalog Items for snapshots
    const cat = await prisma.categories.create({
      data: {
        restaurant_id: restaurant1Id,
        name: `Mains ${timestamp}`,
      },
    });
    categoryId = cat.id;

    const prod = await prisma.products.create({
      data: {
        restaurant_id: restaurant1Id,
        category_id: categoryId,
        name: 'Special Paneer Roll',
        price: 200,
        is_active: true,
        is_available: true,
      },
    });
    productId = prod.id;

    const v = await prisma.product_variants.create({
      data: {
        product_id: productId,
        name: 'Extra Large',
        price: 250,
        is_active: true,
        is_available: true,
      },
    });
    variantId = v.id;

    const a = await prisma.product_addons.create({
      data: {
        product_id: productId,
        name: 'Cheese Dip',
        price: 30,
        is_active: true,
        is_available: true,
      },
    });
    addonId = a.id;

    // 7. Seed Order 1 (Restaurant 1, Branch 1, with items & addons snapshots)
    const o1 = await prisma.orders.create({
      data: {
        restaurant_id: restaurant1Id,
        branch_id: branch1Id,
        table_id: table1Id,
        customer_id: customer1Id,
        order_number: `ORD-TEST-${timestamp.toString().slice(-4)}-1`,
        order_type: 'dine_in',
        status: 'pending',
        subtotal: 280,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 280,
        notes: 'Extra napkins please',
        ordered_at: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });
    order1Id = o1.id;

    const oi1 = await prisma.order_items.create({
      data: {
        order_id: order1Id,
        product_id: productId,
        variant_id: variantId,
        product_name: 'Special Paneer Roll (Snapshot)',
        variant_name: 'Extra Large (Snapshot)',
        quantity: 1,
        unit_price: 250,
        total_price: 280,
        special_instructions: 'Well toasted',
      },
    });

    await prisma.order_item_addons.create({
      data: {
        order_item_id: oi1.id,
        product_addon_id: addonId,
        addon_name: 'Cheese Dip (Snapshot)',
        quantity: 1,
        unit_price: 30,
        total_price: 30,
      },
    });

    await prisma.order_status_history.create({
      data: {
        order_id: order1Id,
        status: 'pending',
        notes: 'Customer placed dine-in order',
        changed_at: new Date(Date.now() - 3600000),
      },
    });

    // 8. Seed Order 2 (Restaurant 1, Branch 2)
    const o2 = await prisma.orders.create({
      data: {
        restaurant_id: restaurant1Id,
        branch_id: branch2Id,
        customer_id: customer1Id,
        order_number: `ORD-TEST-${timestamp.toString().slice(-4)}-2`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 150,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 150,
        ordered_at: new Date(),
        completed_at: new Date(),
      },
    });
    order2Id = o2.id;

    // 9. Seed Order for Status Transition tests
    const oStatus = await prisma.orders.create({
      data: {
        restaurant_id: restaurant1Id,
        branch_id: branch1Id,
        table_id: table1Id,
        customer_id: customer1Id,
        order_number: `ORD-TEST-${timestamp.toString().slice(-4)}-3`,
        order_type: 'dine_in',
        status: 'pending',
        subtotal: 100,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 100,
      },
    });
    orderForStatusTestsId = oStatus.id;

    // 10. Seed Foreign Order (Restaurant 2)
    const oForeign = await prisma.orders.create({
      data: {
        restaurant_id: restaurant2Id,
        branch_id: branch3Id,
        customer_id: customer1Id,
        order_number: `ORD-FOREIGN-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'pending',
        subtotal: 500,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 500,
      },
    });
    orderForeignId = oForeign.id;
  });

  afterAll(async () => {
    // Isolated Cleanup of all created entities
    try {
      const orderIds = [order1Id, order2Id, orderForStatusTestsId, orderForeignId].filter(Boolean);
      await prisma.order_item_addons.deleteMany({
        where: { order_items: { order_id: { in: orderIds } } },
      });
      await prisma.order_items.deleteMany({ where: { order_id: { in: orderIds } } });
      await prisma.order_status_history.deleteMany({ where: { order_id: { in: orderIds } } });
      await prisma.order_coupons.deleteMany({ where: { order_id: { in: orderIds } } });
      await prisma.payments.deleteMany({ where: { order_id: { in: orderIds } } });
      await prisma.orders.deleteMany({ where: { id: { in: orderIds } } });

      if (addonId) await prisma.product_addons.deleteMany({ where: { id: addonId } });
      if (variantId) await prisma.product_variants.deleteMany({ where: { id: variantId } });
      if (productId) await prisma.products.deleteMany({ where: { id: productId } });
      if (categoryId) await prisma.categories.deleteMany({ where: { id: categoryId } });
      if (table1Id) await prisma.restaurant_tables.deleteMany({ where: { id: table1Id } });

      if (branch1Id) await prisma.branches.deleteMany({ where: { id: branch1Id } });
      if (branch2Id) await prisma.branches.deleteMany({ where: { id: branch2Id } });
      if (branch3Id) await prisma.branches.deleteMany({ where: { id: branch3Id } });

      if (restaurant1Id) await prisma.restaurants.deleteMany({ where: { id: restaurant1Id } });
      if (restaurant2Id) await prisma.restaurants.deleteMany({ where: { id: restaurant2Id } });

      if (customer1Id) {
        await prisma.customer_sessions.deleteMany({ where: { customer_id: customer1Id } });
        await prisma.customers.deleteMany({ where: { id: customer1Id } });
      }

      if (owner1Id) {
        await prisma.user_sessions.deleteMany({ where: { user_id: owner1Id } });
        await prisma.users.deleteMany({ where: { id: owner1Id } });
      }
      if (owner2Id) {
        await prisma.user_sessions.deleteMany({ where: { user_id: owner2Id } });
        await prisma.users.deleteMany({ where: { id: owner2Id } });
      }
    } catch (cleanupErr) {
      console.error('Test cleanup error (non-fatal):', cleanupErr);
    }
  });

  describe('1. Authentication & Role Enforcement', () => {
    it('should reject unauthenticated requests (401)', async () => {
      const reqList = new NextRequest('http://localhost/api/v1/owner/orders');
      const resList = await listOwnerOrdersHandler(reqList);
      expect(resList.status).toBe(401);

      const reqDetail = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}`);
      const resDetail = await getOwnerOrderDetailHandler(reqDetail, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(resDetail.status).toBe(401);

      const reqStatus = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' }),
      });
      const resStatus = await updateOwnerOrderStatusHandler(reqStatus, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(resStatus.status).toBe(401);
    });

    it('should reject CUSTOMER role from owner orders routes (403)', async () => {
      const headers = { Authorization: `Bearer ${customer1Token}` };

      const reqList = new NextRequest('http://localhost/api/v1/owner/orders', { headers });
      const resList = await listOwnerOrdersHandler(reqList);
      expect(resList.status).toBe(403);

      const reqDetail = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}`, { headers });
      const resDetail = await getOwnerOrderDetailHandler(reqDetail, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(resDetail.status).toBe(403);

      const reqStatus = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' }),
      });
      const resStatus = await updateOwnerOrderStatusHandler(reqStatus, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(resStatus.status).toBe(403);
    });
  });

  describe('2. Cross-Tenant Isolation & Branch Scoping', () => {
    it('should NOT allow Restaurant 1 to see Restaurant 2 foreign orders in list', async () => {
      const req = new NextRequest('http://localhost/api/v1/owner/orders', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      const orderIds = json.data.orders.map((o: any) => o.id);
      expect(orderIds).toContain(order1Id);
      expect(orderIds).toContain(order2Id);
      expect(orderIds).not.toContain(orderForeignId);
    });

    it('should reject filtering by a branch belonging to another restaurant (403)', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders?branchId=${branch3Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain('does not belong to your authorized restaurant');
    });

    it('should return 404 when Owner 1 attempts to view foreign order of Restaurant 2', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForeignId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getOwnerOrderDetailHandler(req, {
        params: Promise.resolve({ orderId: orderForeignId }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 when Owner 1 attempts to PATCH foreign order of Restaurant 2', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForeignId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'preparing' }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForeignId }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('3. Listing, Filtering & Metrics (GET /owner/orders)', () => {
    it('should paginate and provide accurate pagination metadata', async () => {
      const req = new NextRequest('http://localhost/api/v1/owner/orders?page=1&limit=1', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.orders.length).toBe(1);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.limit).toBe(1);
      expect(json.data.pagination.totalCount).toBeGreaterThanOrEqual(2);
      expect(json.data.pagination.hasNextPage).toBe(true);
    });

    it('should filter orders by branchId', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders?branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      const branchIds = json.data.orders.map((o: any) => o.branch.id);
      expect(branchIds.every((id: string) => id === branch1Id)).toBe(true);
      expect(json.data.orders.some((o: any) => o.id === order1Id)).toBe(true);
      expect(json.data.orders.some((o: any) => o.id === order2Id)).toBe(false);
    });

    it('should filter orders by status', async () => {
      const req = new NextRequest('http://localhost/api/v1/owner/orders?status=completed', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.orders.some((o: any) => o.id === order2Id)).toBe(true);
      expect(json.data.orders.some((o: any) => o.id === order1Id)).toBe(false);
    });

    it('should search by customer name and order number', async () => {
      // Search by customer name
      const req1 = new NextRequest('http://localhost/api/v1/owner/orders?search=Priya', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res1 = await listOwnerOrdersHandler(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.data.orders.length).toBeGreaterThanOrEqual(1);

      // Search by specific order number
      const req2 = new NextRequest(`http://localhost/api/v1/owner/orders?search=${order1Id.slice(0, 4)}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res2 = await listOwnerOrdersHandler(req2);
      expect(res2.status).toBe(200);
    });

    it('should return honest not_recorded payment status when no payments exist', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders?branchId=${branch1Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      const o1 = json.data.orders.find((o: any) => o.id === order1Id);
      expect(o1.payment.status).toBe('not_recorded');
      expect(o1.payment.paymentMethod).toBeNull();
      expect(o1.payment.amount).toBeNull();
    });

    it('should return accurate venue summary counts', async () => {
      const req = new NextRequest('http://localhost/api/v1/owner/orders', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listOwnerOrdersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.data.summary.totalOrders).toBeGreaterThanOrEqual(3);
      expect(json.data.summary.completedOrders).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Order Details & Snapshots (GET /owner/orders/[orderId])', () => {
    it('should return full order detail with historical snapshots and table info', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getOwnerOrderDetailHandler(req, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const order = json.data;

      expect(order.id).toBe(order1Id);
      expect(order.status).toBe('pending');
      expect(order.table.tableNumber).toContain('T-01');
      expect(order.customer.name).toBe('Priya Sharma');
      expect(order.customer.phone).toBeDefined();

      // Check snapshot preservation
      expect(order.items.length).toBe(1);
      expect(order.items[0].productName).toBe('Special Paneer Roll (Snapshot)');
      expect(order.items[0].variantName).toBe('Extra Large (Snapshot)');
      expect(order.items[0].specialInstructions).toBe('Well toasted');
      expect(order.items[0].unitPriceFormatted).toBe('250.00');

      // Check add-on snapshot
      expect(order.items[0].addons.length).toBe(1);
      expect(order.items[0].addons[0].addonName).toBe('Cheese Dip (Snapshot)');
      expect(order.items[0].addons[0].unitPriceFormatted).toBe('30.00');

      // Check status history timeline
      expect(order.statusHistory.length).toBeGreaterThanOrEqual(1);
      expect(order.statusHistory[0].status).toBe('pending');

      // Check payment status honesty
      expect(order.payment.status).toBe('not_recorded');
    });

    it('should reject malformed orderId UUID with 400 validation error', async () => {
      const req = new NextRequest('http://localhost/api/v1/owner/orders/not-a-uuid', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await getOwnerOrderDetailHandler(req, {
        params: Promise.resolve({ orderId: 'not-a-uuid' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('5. Status Transition Lifecycle & Concurrency (PATCH /owner/orders/[orderId]/status)', () => {
    it('should succeed on valid transition: pending -> preparing', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForStatusTestsId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'preparing',
          notes: 'Kitchen accepted order',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForStatusTestsId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('preparing');

      // Verify status history was written atomically
      const history = await prisma.order_status_history.findMany({
        where: { order_id: orderForStatusTestsId },
        orderBy: { changed_at: 'desc' },
      });
      expect(history[0].status).toBe('preparing');
      expect(history[0].notes).toBe('Kitchen accepted order');
    });

    it('should REJECT skipping status: preparing -> completed (must be served first)', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForStatusTestsId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForStatusTestsId }),
      });
      expect(res.status).toBe(409);
    });

    it('should succeed on valid transition: preparing -> served', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForStatusTestsId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'served',
          notes: 'Delivered to Table 1',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForStatusTestsId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('served');
    });

    it('should REJECT forbidden transition: served -> cancelled', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForStatusTestsId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForStatusTestsId }),
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('managerial override');
    });

    it('should succeed on valid transition: served -> completed and set completed_at', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForStatusTestsId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          notes: 'Customer finished dining',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForStatusTestsId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('completed');
      expect(json.data.completedAt).not.toBeNull();
    });

    it('should REJECT transitioning from terminal state: completed -> pending (409)', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${orderForStatusTestsId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'pending',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: orderForStatusTestsId }),
      });
      expect(res.status).toBe(409);
    });

    it('should detect optimistic concurrency conflict with expectedCurrentStatus mismatch (409)', async () => {
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'preparing',
          expectedCurrentStatus: 'preparing', // Conflict! Current status is 'pending'
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('Order status conflict');
    });

    it('should NOT alter table status when order status transitions', async () => {
      const tableBefore = await prisma.restaurant_tables.findUnique({
        where: { id: table1Id },
      });
      expect(tableBefore?.status).toBe('available');

      // Update order1 to preparing
      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${order1Id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${owner1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'preparing',
        }),
      });
      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: order1Id }),
      });
      expect(res.status).toBe(200);

      // Verify table status remained completely unchanged
      const tableAfter = await prisma.restaurant_tables.findUnique({
        where: { id: table1Id },
      });
      expect(tableAfter?.status).toBe('available');
    });
  });
});
