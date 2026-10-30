import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { GET as getCustomerOrdersHandler } from '@/app/api/v1/customer/orders/route';
import { encodeOrderCursor } from '@/lib/orders/cursor';

describe('Step 7.1 — Customer Order History API (GET /api/v1/customer/orders)', () => {
  const timestamp = Date.now();

  // Test Entities
  let ownerId: string;
  let ownerToken: string;
  let restaurantId: string;
  let branchId: string;
  let tableId: string;
  let categoryId: string;
  let productId: string;

  // Customers
  let customer1Id: string;
  let customer1Token: string;

  let customer2Id: string;
  let customer2Token: string;

  let customerEmptyId: string;
  let customerEmptyToken: string;

  // Order IDs for Customer 1
  let c1Order1Id: string; // Oldest
  let c1Order2Id: string; // Middle
  let c1Order3Id: string; // Newest
  let c1OrderTie1Id: string; // Tied timestamp, higher ID
  let c1OrderTie2Id: string; // Tied timestamp, lower ID

  // Order ID for Customer 2 (Foreign)
  let c2OrderId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecurePass123!');

    // 1. Create Venue Owner & Venue
    const owner = await prisma.users.create({
      data: {
        email: `cust_orders_owner_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Venue Owner',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    ownerId = owner.id;

    const ownerSession = await createDatabaseSession(ownerId);
    ownerToken = await createJwtToken({
      userId: ownerId,
      sessionId: ownerSession.sessionId,
      sessionToken: ownerSession.sessionToken,
      email: owner.email,
      role: 'RESTAURANT_OWNER',
    });

    const restaurant = await prisma.restaurants.create({
      data: {
        name: `Test Bistro ${timestamp}`,
        legal_name: 'Test Bistro Pvt Ltd',
        owner_id: ownerId,
        status: 'active',
      },
    });
    restaurantId = restaurant.id;

    const branch = await prisma.branches.create({
      data: {
        restaurant_id: restaurantId,
        name: 'Main Branch',
        status: 'active',
      },
    });
    branchId = branch.id;

    const table = await prisma.restaurant_tables.create({
      data: {
        branch_id: branchId,
        table_number: `T-${timestamp.toString().slice(-4)}`,
        capacity: 4,
        status: 'available',
        is_active: true,
      },
    });
    tableId = table.id;

    // Create Category & Product for order item foreign keys
    const category = await prisma.categories.create({
      data: {
        restaurant_id: restaurantId,
        name: `Test Cat ${timestamp}`,
        is_active: true,
      },
    });
    categoryId = category.id;

    const product = await prisma.products.create({
      data: {
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: 'Paneer Butter Masala',
        price: 250,
        is_active: true,
      },
    });
    productId = product.id;

    // 2. Create Customers
    // Customer 1: Main customer with order history
    const customer1 = await prisma.customers.create({
      data: {
        name: 'Customer One',
        phone: `+9191${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customer1Id = customer1.id;
    const c1Session = await createCustomerDatabaseSession(customer1Id);
    customer1Token = await createJwtToken({
      userId: customer1Id,
      sessionId: c1Session.sessionId,
      sessionToken: c1Session.sessionToken,
      email: `${customer1Id}@customer.local`,
      role: 'CUSTOMER',
    });

    // Customer 2: Foreign customer for tenancy isolation tests
    const customer2 = await prisma.customers.create({
      data: {
        name: 'Customer Two',
        phone: `+9192${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customer2Id = customer2.id;
    const c2Session = await createCustomerDatabaseSession(customer2Id);
    customer2Token = await createJwtToken({
      userId: customer2Id,
      sessionId: c2Session.sessionId,
      sessionToken: c2Session.sessionToken,
      email: `${customer2Id}@customer.local`,
      role: 'CUSTOMER',
    });

    // Customer 3: Empty history customer
    const customerEmpty = await prisma.customers.create({
      data: {
        name: 'Customer Empty',
        phone: `+9193${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customerEmptyId = customerEmpty.id;
    const cEmptySession = await createCustomerDatabaseSession(customerEmptyId);
    customerEmptyToken = await createJwtToken({
      userId: customerEmptyId,
      sessionId: cEmptySession.sessionId,
      sessionToken: cEmptySession.sessionToken,
      email: `${customerEmptyId}@customer.local`,
      role: 'CUSTOMER',
    });

    // 3. Seed Orders for Customer 1
    // Order 1: 3 hours ago, completed
    const o1 = await prisma.orders.create({
      data: {
        restaurant_id: restaurantId,
        branch_id: branchId,
        table_id: tableId,
        customer_id: customer1Id,
        order_number: `ORD-C1-01-${timestamp}`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 250,
        discount_amount: 25,
        tax_amount: 11.25,
        total_amount: 236.25,
        notes: 'Less spicy',
        ordered_at: new Date(Date.now() - 3 * 3600 * 1000),
        completed_at: new Date(Date.now() - 2 * 3600 * 1000),
      },
    });
    c1Order1Id = o1.id;

    await prisma.order_items.create({
      data: {
        order_id: c1Order1Id,
        product_id: productId,
        product_name: 'Paneer Butter Masala',
        quantity: 1,
        unit_price: 250,
        total_price: 250,
      },
    });

    await prisma.payments.create({
      data: {
        order_id: c1Order1Id,
        amount: 236.25,
        payment_method: 'card',
        status: 'paid',
      },
    });

    // Order 2: 2 hours ago, preparing
    const o2 = await prisma.orders.create({
      data: {
        restaurant_id: restaurantId,
        branch_id: branchId,
        table_id: tableId,
        customer_id: customer1Id,
        order_number: `ORD-C1-02-${timestamp}`,
        order_type: 'dine_in',
        status: 'preparing',
        subtotal: 180,
        discount_amount: 0,
        tax_amount: 9,
        total_amount: 189,
        ordered_at: new Date(Date.now() - 2 * 3600 * 1000),
      },
    });
    c1Order2Id = o2.id;

    await prisma.order_items.create({
      data: {
        order_id: c1Order2Id,
        product_id: productId,
        product_name: 'Garlic Naan',
        quantity: 3,
        unit_price: 60,
        total_price: 180,
      },
    });

    // Order 3: 1 hour ago, pending
    const o3 = await prisma.orders.create({
      data: {
        restaurant_id: restaurantId,
        branch_id: branchId,
        table_id: tableId,
        customer_id: customer1Id,
        order_number: `ORD-C1-03-${timestamp}`,
        order_type: 'dine_in',
        status: 'pending',
        subtotal: 100,
        discount_amount: 0,
        tax_amount: 5,
        total_amount: 105,
        ordered_at: new Date(Date.now() - 1 * 3600 * 1000),
      },
    });
    c1Order3Id = o3.id;

    // Two orders with the EXACT same timestamp to test deterministic tie-breaking
    const tiedTimestamp = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    const oTie1 = await prisma.orders.create({
      data: {
        restaurant_id: restaurantId,
        branch_id: branchId,
        table_id: tableId,
        customer_id: customer1Id,
        order_number: `ORD-TIE-A-${timestamp}`,
        order_type: 'dine_in',
        status: 'served',
        subtotal: 70,
        discount_amount: 0,
        tax_amount: 3.5,
        total_amount: 73.5,
        ordered_at: tiedTimestamp,
      },
    });
    c1OrderTie1Id = oTie1.id;

    const oTie2 = await prisma.orders.create({
      data: {
        restaurant_id: restaurantId,
        branch_id: branchId,
        table_id: tableId,
        customer_id: customer1Id,
        order_number: `ORD-TIE-B-${timestamp}`,
        order_type: 'dine_in',
        status: 'cancelled',
        subtotal: 50,
        discount_amount: 0,
        tax_amount: 2.5,
        total_amount: 52.5,
        ordered_at: tiedTimestamp,
      },
    });
    c1OrderTie2Id = oTie2.id;

    // 4. Seed Order for Customer 2 (Foreign Tenant)
    const oForeign = await prisma.orders.create({
      data: {
        restaurant_id: restaurantId,
        branch_id: branchId,
        table_id: tableId,
        customer_id: customer2Id,
        order_number: `ORD-C2-FOREIGN-${timestamp}`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 999,
        discount_amount: 0,
        tax_amount: 49.95,
        total_amount: 1048.95,
        ordered_at: new Date(),
      },
    });
    c2OrderId = oForeign.id;
  });

  afterAll(async () => {
    try {
      const allOrderIds = [
        c1Order1Id,
        c1Order2Id,
        c1Order3Id,
        c1OrderTie1Id,
        c1OrderTie2Id,
        c2OrderId,
      ].filter(Boolean);

      await prisma.payments.deleteMany({ where: { order_id: { in: allOrderIds } } });
      await prisma.order_items.deleteMany({ where: { order_id: { in: allOrderIds } } });
      await prisma.order_status_history.deleteMany({ where: { order_id: { in: allOrderIds } } });
      await prisma.feedback.deleteMany({ where: { order_id: { in: allOrderIds } } });
      await prisma.orders.deleteMany({ where: { id: { in: allOrderIds } } });

      if (tableId) await prisma.restaurant_tables.deleteMany({ where: { id: tableId } });
      if (productId) await prisma.products.deleteMany({ where: { id: productId } });
      if (categoryId) await prisma.categories.deleteMany({ where: { id: categoryId } });
      if (branchId) await prisma.branches.deleteMany({ where: { id: branchId } });
      if (restaurantId) await prisma.restaurants.deleteMany({ where: { id: restaurantId } });

      const custIds = [customer1Id, customer2Id, customerEmptyId].filter(Boolean);
      await prisma.customer_sessions.deleteMany({ where: { customer_id: { in: custIds } } });
      await prisma.customers.deleteMany({ where: { id: { in: custIds } } });

      if (ownerId) {
        await prisma.user_sessions.deleteMany({ where: { user_id: ownerId } });
        await prisma.users.deleteMany({ where: { id: ownerId } });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  // 1. Unauthenticated request is rejected
  it('1. should reject unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders');
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // Role check: Owner role is rejected on customer endpoints
  it('1b. should reject RESTAURANT_OWNER session token with 403 FORBIDDEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // 2. Valid customer receives only their own orders
  it('2. should return customer own orders with 200 OK', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.orders)).toBe(true);
    expect(body.data.orders.length).toBe(5);

    // Verify all returned orders belong to Customer 1's seeded orders
    const returnedIds = body.data.orders.map((o: any) => o.id);
    expect(returnedIds).toContain(c1Order1Id);
    expect(returnedIds).toContain(c1Order2Id);
    expect(returnedIds).toContain(c1Order3Id);
    expect(returnedIds).toContain(c1OrderTie1Id);
    expect(returnedIds).toContain(c1OrderTie2Id);
  });

  // 3. Another customer's orders never appear
  it("3. should never include another customer's orders in the results", async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res = await getCustomerOrdersHandler(req);
    const body = await res.json();

    const returnedIds = body.data.orders.map((o: any) => o.id);
    expect(returnedIds).not.toContain(c2OrderId);
  });

  // 4. Customer ID cannot be overridden through query parameters
  it('4. should ignore query parameter customerId manipulation and scope strictly to authenticated session', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/customer/orders?customerId=${customer2Id}&customer_id=${customer2Id}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const returnedIds = body.data.orders.map((o: any) => o.id);
    // Even though customer2Id was passed in query, only customer1's orders are returned
    expect(returnedIds).not.toContain(c2OrderId);
    expect(returnedIds).toContain(c1Order1Id);
  });

  // 5. Empty history returns a valid empty response
  it('5. should return an empty order list with valid structure when customer has no orders', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${customerEmptyToken}` },
    });
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.orders).toEqual([]);
    expect(body.data.pagination).toEqual({
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    });
    expect(body.data.summary).toEqual({
      totalOrders: 0,
      pending: 0,
      preparing: 0,
      served: 0,
      completed: 0,
      cancelled: 0,
    });
  });

  // 6. Cursor pagination returns stable, non-overlapping pages
  it('6. should paginate stably across multiple pages using cursors with no duplicates or skipped records', async () => {
    // Page 1: limit = 2
    const req1 = new NextRequest('http://localhost/api/v1/customer/orders?limit=2', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res1 = await getCustomerOrdersHandler(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();

    expect(body1.data.orders.length).toBe(2);
    expect(body1.data.pagination.hasNextPage).toBe(true);
    expect(typeof body1.data.pagination.nextCursor).toBe('string');
    const page1Ids = body1.data.orders.map((o: any) => o.id);

    // Page 2: with cursor from page 1, limit = 2
    const cursor1 = body1.data.pagination.nextCursor;
    const req2 = new NextRequest(
      `http://localhost/api/v1/customer/orders?limit=2&cursor=${encodeURIComponent(cursor1)}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const res2 = await getCustomerOrdersHandler(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();

    expect(body2.data.orders.length).toBe(2);
    expect(body2.data.pagination.hasNextPage).toBe(true);
    const page2Ids = body2.data.orders.map((o: any) => o.id);

    // Verify non-overlapping between Page 1 and Page 2
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }

    // Page 3: remaining records
    const cursor2 = body2.data.pagination.nextCursor;
    const req3 = new NextRequest(
      `http://localhost/api/v1/customer/orders?limit=2&cursor=${encodeURIComponent(cursor2)}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const res3 = await getCustomerOrdersHandler(req3);
    expect(res3.status).toBe(200);
    const body3 = await res3.json();

    expect(body3.data.orders.length).toBe(1);
    expect(body3.data.pagination.hasNextPage).toBe(false);
    expect(body3.data.pagination.nextCursor).toBeNull();
    const page3Ids = body3.data.orders.map((o: any) => o.id);

    // All 5 customer orders accounted for exactly once
    const allFetchedIds = [...page1Ids, ...page2Ids, ...page3Ids];
    expect(allFetchedIds.length).toBe(5);
    expect(new Set(allFetchedIds).size).toBe(5);
  });

  // 7. Orders with identical timestamps paginate deterministically
  it('7. should paginate deterministically when orders have identical timestamps', async () => {
    // Find the order of the two tied orders
    const tiedHigher = c1OrderTie1Id > c1OrderTie2Id ? c1OrderTie1Id : c1OrderTie2Id;
    const tiedLower = c1OrderTie1Id > c1OrderTie2Id ? c1OrderTie2Id : c1OrderTie1Id;

    // Use cursor equal to the higher ID tied order
    const tiedOrder = await prisma.orders.findUnique({ where: { id: tiedHigher } });
    const cursorTied = encodeOrderCursor(tiedOrder!.id, tiedOrder!.ordered_at);

    const req = new NextRequest(
      `http://localhost/api/v1/customer/orders?cursor=${encodeURIComponent(cursorTied)}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const returnedIds = body.data.orders.map((o: any) => o.id);

    // The higher ID tied order must NOT be in the results (already past)
    expect(returnedIds).not.toContain(tiedHigher);

    // The lower ID tied order MUST be in the results (next in deterministic tie-breaker)
    expect(returnedIds).toContain(tiedLower);
  });

  // 8. Invalid cursor and page size are rejected
  it('8. should reject invalid page sizes and malformed/foreign cursors with 400 VALIDATION_ERROR', async () => {
    // Zero limit
    const resZero = await getCustomerOrdersHandler(
      new NextRequest('http://localhost/api/v1/customer/orders?limit=0', {
        headers: { Authorization: `Bearer ${customer1Token}` },
      })
    );
    expect(resZero.status).toBe(400);

    // Non-numeric limit
    const resNaN = await getCustomerOrdersHandler(
      new NextRequest('http://localhost/api/v1/customer/orders?limit=abc', {
        headers: { Authorization: `Bearer ${customer1Token}` },
      })
    );
    expect(resNaN.status).toBe(400);

    // Excess limit (> 50)
    const resExcess = await getCustomerOrdersHandler(
      new NextRequest('http://localhost/api/v1/customer/orders?limit=100', {
        headers: { Authorization: `Bearer ${customer1Token}` },
      })
    );
    expect(resExcess.status).toBe(400);

    // Malformed cursor string
    const resMalformedCursor = await getCustomerOrdersHandler(
      new NextRequest('http://localhost/api/v1/customer/orders?cursor=not-a-valid-cursor-string!!', {
        headers: { Authorization: `Bearer ${customer1Token}` },
      })
    );
    expect(resMalformedCursor.status).toBe(400);

    // Non-existent UUID cursor
    const resNonExistentCursor = await getCustomerOrdersHandler(
      new NextRequest(
        'http://localhost/api/v1/customer/orders?cursor=ffffffff-ffff-ffff-ffff-ffffffffffff',
        {
          headers: { Authorization: `Bearer ${customer1Token}` },
        }
      )
    );
    expect(resNonExistentCursor.status).toBe(400);

    // Foreign customer order used as cursor (Isolation violation attempt)
    const resForeignCursor = await getCustomerOrdersHandler(
      new NextRequest(`http://localhost/api/v1/customer/orders?cursor=${c2OrderId}`, {
        headers: { Authorization: `Bearer ${customer1Token}` },
      })
    );
    expect(resForeignCursor.status).toBe(400);
    const foreignErr = await resForeignCursor.json();
    expect(foreignErr.error.code).toBe('VALIDATION_ERROR');
  });

  // 9. Valid date filters work
  it('9. should filter orders accurately when valid date ranges are provided', async () => {
    // Filter window: between 2.5 hours ago and 1.5 hours ago (covers Order 2: 2 hours ago)
    const fromTime = new Date(Date.now() - 2.5 * 3600 * 1000).toISOString();
    const toTime = new Date(Date.now() - 1.5 * 3600 * 1000).toISOString();

    const req = new NextRequest(
      `http://localhost/api/v1/customer/orders?dateFrom=${encodeURIComponent(fromTime)}&dateTo=${encodeURIComponent(toTime)}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const returnedIds = body.data.orders.map((o: any) => o.id);
    expect(returnedIds).toContain(c1Order2Id);
    expect(returnedIds).not.toContain(c1Order1Id); // 3 hours ago (out of range)
    expect(returnedIds).not.toContain(c1Order3Id); // 1 hour ago (out of range)
  });

  // 10. Invalid date ranges are rejected
  it('10. should reject inverted date ranges and invalid date strings with 400 VALIDATION_ERROR', async () => {
    // Inverted range: dateFrom > dateTo
    const resInverted = await getCustomerOrdersHandler(
      new NextRequest(
        'http://localhost/api/v1/customer/orders?dateFrom=2026-10-20&dateTo=2026-10-10',
        {
          headers: { Authorization: `Bearer ${customer1Token}` },
        }
      )
    );
    expect(resInverted.status).toBe(400);
    const invertedBody = await resInverted.json();
    expect(invertedBody.error.code).toBe('VALIDATION_ERROR');

    // Invalid date string
    const resInvalid = await getCustomerOrdersHandler(
      new NextRequest('http://localhost/api/v1/customer/orders?dateFrom=invalid-date-string', {
        headers: { Authorization: `Bearer ${customer1Token}` },
      })
    );
    expect(resInvalid.status).toBe(400);
  });

  // 11. Valid status filtering works
  it('11. should filter orders by status accurately', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders?status=completed', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.orders.length).toBe(1);
    expect(body.data.orders[0].id).toBe(c1Order1Id);
    expect(body.data.orders[0].status).toBe('completed');
  });

  // 12. Invalid status values are rejected
  it('12. should reject invalid status values with 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest(
      'http://localhost/api/v1/customer/orders?status=non_existent_status',
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // 13. Response excludes sensitive/internal fields
  it('13. should sanitize responses and never leak sensitive or internal fields', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res = await getCustomerOrdersHandler(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    for (const order of body.data.orders) {
      // Must not leak passwords or hashes
      expect(order.password_hash).toBeUndefined();
      expect(order.password).toBeUndefined();
      expect(order.qr_token_hash).toBeUndefined();
      expect(order.qrToken).toBeUndefined();
      expect(order.idempotency_payload_hash).toBeUndefined();
      expect(order.idempotency_key).toBeUndefined();
      expect(order.sessionToken).toBeUndefined();

      // Must have safe public-facing fields
      expect(typeof order.id).toBe('string');
      expect(typeof order.orderNumber).toBe('string');
      expect(typeof order.status).toBe('string');
      expect(typeof order.pricing.totalAmount).toBe('number');
      expect(typeof order.paymentStatus).toBe('string');
      expect(Array.isArray(order.itemsSummary)).toBe(true);
    }
  });

  // 14. Lifetime status summary aggregates
  it('14. should provide accurate customer lifetime order status summary', async () => {
    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res = await getCustomerOrdersHandler(req);
    const body = await res.json();

    expect(body.data.summary).toEqual({
      totalOrders: 5,
      pending: 1,
      preparing: 1,
      served: 1,
      completed: 1,
      cancelled: 1,
    });
  });

  // 15. Database errors use the existing safe error response format
  it('15. should handle database exceptions gracefully with 500 INTERNAL_SERVER_ERROR', async () => {
    const findManySpy = vi.spyOn(prisma.orders, 'findMany').mockRejectedValueOnce(new Error('Simulated DB connectivity failure'));

    const req = new NextRequest('http://localhost/api/v1/customer/orders', {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const res = await getCustomerOrdersHandler(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('An unexpected internal server error occurred');

    findManySpy.mockRestore();
  });
});

