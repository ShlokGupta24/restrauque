import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import {
  POST as createPaymentHandler,
  GET as listPaymentsHandler,
} from '@/app/api/v1/owner/orders/[orderId]/payments/route';
import { GET as getOrderDetailHandler } from '@/app/api/v1/owner/orders/[orderId]/route';
import { GET as listOrdersHandler } from '@/app/api/v1/owner/orders/route';

describe('STEP 10B: Owner Order Payments CRUD, RBAC, and Settlement Integration Tests', () => {
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
  let owner2BranchId: string;

  // Customer: Must be rejected on owner routes
  let customerId: string;
  let customerToken: string;

  // Track created test orders
  let orderCashId: string;
  let orderUpiId: string;
  let orderCancelledId: string;
  let orderForeignId: string;
  let orderMultiPayId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 + Restaurant 1 + Branch 1 + Table 1
    const owner1 = await prisma.users.create({
      data: {
        email: `payments_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Payments Owner 1',
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
        name: `Payments Bistro ${timestamp}`,
        legal_name: 'Payments Bistro Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Main Payments Branch',
        status: 'active',
      },
    });
    owner1BranchId = branch1.id;

    const table1 = await prisma.restaurant_tables.create({
      data: {
        branch_id: owner1BranchId,
        table_number: 'T-PAY-1',
        capacity: 4,
        status: 'active',
      },
    });
    owner1TableId = table1.id;

    // 2. Create Owner 2 + Restaurant 2 + Branch 2
    const owner2 = await prisma.users.create({
      data: {
        email: `payments_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Payments Owner 2',
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
        name: `Foreign Payments Cafe ${timestamp}`,
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Foreign Branch',
        status: 'active',
      },
    });
    owner2BranchId = branch2.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        name: 'Payment Customer',
        phone: `+9197${timestamp.toString().slice(-8)}`,
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

    // 4. Seed Test Orders
    // Order 1: For Cash payment (total 250.00)
    const orderCash = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1BranchId,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-CASH-${timestamp.toString().slice(-6)}`,
        order_type: 'dine_in',
        status: 'served',
        subtotal: 250.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 250.0,
      },
    });
    orderCashId = orderCash.id;

    // Order 2: For UPI payment & Idempotent replay (total 300.00)
    const orderUpi = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1BranchId,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-UPI-${timestamp.toString().slice(-6)}`,
        order_type: 'dine_in',
        status: 'pending',
        subtotal: 300.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 300.0,
      },
    });
    orderUpiId = orderUpi.id;

    // Order 3: Cancelled order (total 150.00)
    const orderCancelled = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1BranchId,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-CANC-${timestamp.toString().slice(-6)}`,
        order_type: 'dine_in',
        status: 'cancelled',
        subtotal: 150.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 150.0,
      },
    });
    orderCancelledId = orderCancelled.id;

    // Order 4: Foreign order belonging to Owner 2 (total 500.00)
    const orderForeign = await prisma.orders.create({
      data: {
        restaurant_id: owner2RestaurantId,
        branch_id: owner2BranchId,
        customer_id: customerId,
        order_number: `ORD-FOR-${timestamp.toString().slice(-6)}`,
        order_type: 'dine_in',
        status: 'served',
        subtotal: 500.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 500.0,
      },
    });
    orderForeignId = orderForeign.id;

    // Order 5: For testing older failed payment + newer paid payment
    const orderMulti = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1BranchId,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-MUL-${timestamp.toString().slice(-6)}`,
        order_type: 'dine_in',
        status: 'served',
        subtotal: 180.0,
        discount_amount: 0.0,
        tax_amount: 0.0,
        total_amount: 180.0,
        ordered_at: new Date(),
      },
    });
    orderMultiPayId = orderMulti.id;

    // Older failed payment (5 minutes ago)
    await prisma.payments.create({
      data: {
        order_id: orderMultiPayId,
        amount: 180.0,
        payment_method: 'card',
        status: 'failed',
        transaction_reference: 'CARD-FAIL-123',
        created_at: new Date(Date.now() - 300000),
      },
    });

    // Newer paid payment (1 minute ago)
    await prisma.payments.create({
      data: {
        order_id: orderMultiPayId,
        amount: 180.0,
        payment_method: 'cash',
        status: 'paid',
        paid_at: new Date(Date.now() - 60000),
        created_at: new Date(Date.now() - 60000),
      },
    });
  });

  afterAll(async () => {
    try {
      const allOrderIds = [
        orderCashId,
        orderUpiId,
        orderCancelledId,
        orderForeignId,
        orderMultiPayId,
      ].filter(Boolean);

      if (allOrderIds.length > 0) {
        await prisma.payments.deleteMany({
          where: { order_id: { in: allOrderIds } },
        }).catch(() => {});
        await prisma.orders.deleteMany({
          where: { id: { in: allOrderIds } },
        }).catch(() => {});
      }

      if (owner1TableId) {
        await prisma.restaurant_tables.deleteMany({ where: { id: owner1TableId } }).catch(() => {});
      }
      if (owner1BranchId) {
        await prisma.branches.deleteMany({ where: { id: owner1BranchId } }).catch(() => {});
      }
      if (owner2BranchId) {
        await prisma.branches.deleteMany({ where: { id: owner2BranchId } }).catch(() => {});
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
    it('should reject unauthenticated payment requests with 401', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCashId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 250,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderCashId }),
      });
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject CUSTOMER role with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCashId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${customerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 250,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderCashId }),
      });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Validation & Tenant Isolation on POST Payments', () => {
    it('should reject invalid UUID with 400', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/orders/not-a-uuid/payments',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 250,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: 'not-a-uuid' }),
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 when Owner 1 attempts to record payment for Owner 2 foreign order', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderForeignId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 500,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderForeignId }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should reject payment recording on cancelled order with 409 Conflict', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCancelledId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 150,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderCancelledId }),
      });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.message).toContain('cancelled order');
    });

    it('should reject payment when amount does not match order total_amount with 409 Conflict', async () => {
      // orderCash total_amount is 250.00; submitting 200.00
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCashId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 200,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderCashId }),
      });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.message).toContain('does not match order total amount');
    });
  });

  describe('3. Successful Settlement & Idempotent Replays', () => {
    it('should successfully record cash payment with 201 Created and set status to paid', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCashId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 250.0,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderCashId }),
      });
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.payment.orderId).toBe(orderCashId);
      expect(json.data.payment.amount).toBe(250);
      expect(json.data.payment.amountFormatted).toBe('250.00');
      expect(json.data.payment.paymentMethod).toBe('cash');
      expect(json.data.payment.status).toBe('paid');
      expect(json.data.payment.paidAt).not.toBeNull();
      expect(json.data.payment.transactionReference).toBeNull();
    });

    it('should REJECT repeat submission after unreferenced cash payment with 409 Conflict', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCashId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'cash',
            amount: 250.0,
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderCashId }),
      });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.message).toContain('already been paid and settled');
    });

    it('should successfully record UPI payment with transactionReference (201 Created)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderUpiId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'upi',
            amount: 300.0,
            transactionReference: 'UPI-UTR-987654',
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderUpiId }),
      });
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.payment.orderId).toBe(orderUpiId);
      expect(json.data.payment.paymentMethod).toBe('upi');
      expect(json.data.payment.amount).toBe(300);
      expect(json.data.payment.status).toBe('paid');
      expect(json.data.payment.transactionReference).toBe('UPI-UTR-987654');
    });

    it('should return 200 with isReplay: true on exact IDEMPOTENT replay with matching reference', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderUpiId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'upi',
            amount: 300.0,
            transactionReference: 'UPI-UTR-987654',
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderUpiId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.isReplay).toBe(true);
      expect(json.data.payment.transactionReference).toBe('UPI-UTR-987654');
      expect(json.data.payment.status).toBe('paid');
    });

    it('should return 409 Conflict if submitting different reference on already paid order', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderUpiId}/payments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'upi',
            amount: 300.0,
            transactionReference: 'DIFFERENT-REF-000',
          }),
        }
      );

      const res = await createPaymentHandler(req, {
        params: Promise.resolve({ orderId: orderUpiId }),
      });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.message).toContain('already been paid');
    });
  });

  describe('4. GET /api/v1/owner/orders/[orderId]/payments', () => {
    it('should return all payment records for the order', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderUpiId}/payments`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
          },
        }
      );

      const res = await listPaymentsHandler(req, {
        params: Promise.resolve({ orderId: orderUpiId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.orderId).toBe(orderUpiId);
      expect(json.data.paymentStatus).toBe('paid');
      expect(json.data.orderTotalAmount).toBe(300);
      expect(Array.isArray(json.data.payments)).toBe(true);
      expect(json.data.payments.length).toBeGreaterThanOrEqual(1);
      expect(json.data.payments[0].paymentMethod).toBe('upi');
      expect(json.data.payments[0].status).toBe('paid');
    });

    it('should return 404 when Owner 1 attempts to list payments of Owner 2 foreign order', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderForeignId}/payments`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
          },
        }
      );

      const res = await listPaymentsHandler(req, {
        params: Promise.resolve({ orderId: orderForeignId }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('5. Integration with Order Detail & Order List Filters', () => {
    it('should reflect paymentStatus: "paid" in GET /api/v1/owner/orders/[orderId]', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${orderCashId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
          },
        }
      );

      const res = await getOrderDetailHandler(req, {
        params: Promise.resolve({ orderId: orderCashId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.payment.status).toBe('paid');
      expect(json.data.payment.paymentMethod).toBe('cash');
      expect(json.data.payment.amount).toBe(250);
    });

    it('should correctly include settled order in GET /api/v1/owner/orders?paymentStatus=paid', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/orders?paymentStatus=paid',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
          },
        }
      );

      const res = await listOrdersHandler(req);
      const json = await res.json();
      if (res.status !== 200) {
        console.error('DEBUG: listOrdersHandler failed with:', JSON.stringify(json, null, 2));
      }
      expect(res.status).toBe(200);

      expect(json.success).toBe(true);
      const paidOrderIds = json.data.orders.map((o: any) => o.id);
      expect(paidOrderIds).toContain(orderCashId);
      expect(paidOrderIds).toContain(orderUpiId);
      expect(paidOrderIds).toContain(orderMultiPayId);

      const multiOrderInPaidList = json.data.orders.find((o: any) => o.id === orderMultiPayId);
      expect(multiOrderInPaidList).toBeDefined();
      expect(multiOrderInPaidList.payment.status).toBe('paid');
      expect(multiOrderInPaidList.payment.paymentMethod).toBe('cash');
      expect(multiOrderInPaidList.payment.amount).toBe(180);
    });

    it('should correctly display paid status in list view when an older failed payment precedes a successful settlement', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/orders',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
          },
        }
      );

      const res = await listOrdersHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      // 1. Verify multi-payment order displays 'paid' with successful payment's method and amount
      const multiOrder = json.data.orders.find((o: any) => o.id === orderMultiPayId);
      expect(multiOrder).toBeDefined();
      expect(multiOrder.payment.status).toBe('paid');
      expect(multiOrder.payment.paymentMethod).toBe('cash');
      expect(multiOrder.payment.amount).toBe(180);

      // 2. Verify order with no payments honestly displays 'not_recorded'
      const cancelledOrder = json.data.orders.find((o: any) => o.id === orderCancelledId);
      expect(cancelledOrder).toBeDefined();
      expect(cancelledOrder.payment.status).toBe('not_recorded');
      expect(cancelledOrder.payment.paymentMethod).toBeNull();
      expect(cancelledOrder.payment.amount).toBeNull();
    });
  });
});
