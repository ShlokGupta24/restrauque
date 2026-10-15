import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { GET as getSalesDashboardHandler } from '@/app/api/v1/owner/dashboard/sales/route';

describe('STEP 11B.2: POS Dashboard Duplicate Paid-Settlement Reporting Policy Integration Tests', () => {
  const timestamp = Date.now();

  // Test Owner 1
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1Branch1Id: string;
  let owner1TableId: string;

  // Test Owner 2 (Cross-tenant)
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2Branch2Id: string;

  // Customer
  let customerId: string;

  // Order IDs
  let orderNormalId: string; // Order A: Normal 1 paid record
  let orderDupSameAmtId: string; // Order B: 2 paid records, same amount
  let orderDupMismatchId: string; // Order C: 2 paid records, one partial one exact
  let orderUnpaidId: string; // Order E: Unpaid open tab
  let orderFailedRefundedId: string; // Order F: Failed + refunded records
  let orderForeignDupId: string; // Order G: Foreign tenant duplicate order
  let orderOutsideDateId: string; // Order H: Paid outside reporting range

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 & Restaurant 1
    const owner1 = await prisma.users.create({
      data: {
        email: `dup_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Duplicate Audit Owner 1',
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
        name: `Dup Audit Cafe ${timestamp}`,
        owner_id: owner1Id,
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Dup Audit Main Branch',
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner1Branch1Id = branch1.id;

    const table1 = await prisma.restaurant_tables.create({
      data: {
        branch_id: owner1Branch1Id,
        table_number: 'T-DUP-1',
        capacity: 4,
        status: 'active',
      },
    });
    owner1TableId = table1.id;

    // 2. Create Owner 2 & Restaurant 2 (for cross-tenant checks)
    const owner2 = await prisma.users.create({
      data: {
        email: `dup_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Duplicate Audit Owner 2',
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
        name: `Foreign Dup Cafe ${timestamp}`,
        owner_id: owner2Id,
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Foreign Dup Branch',
        status: 'active',
      },
    });
    owner2Branch2Id = branch2.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        name: 'Dup Audit Customer',
        phone: `+9198${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customerId = customer.id;

    const now = new Date();
    const tMinus10m = new Date(now.getTime() - 10 * 60 * 1000);
    const tMinus5m = new Date(now.getTime() - 5 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Order A: Normal 1 paid record (UPI: 250.00)
    const oA = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-NORM-${timestamp.toString().slice(-4)}`,
        status: 'completed',
        subtotal: 240.0,
        discount_amount: 0.0,
        tax_amount: 10.0,
        total_amount: 250.0,
        ordered_at: now,
      },
    });
    orderNormalId = oA.id;
    await prisma.payments.create({
      data: {
        order_id: orderNormalId,
        amount: 250.0,
        payment_method: 'upi',
        status: 'paid',
        paid_at: tMinus10m,
      },
    });

    // Order B: Duplicate paid records on same order (UPI 400 + Cash 400 = Raw 800)
    // Canonical should be UPI 400 (earliest paid_at)
    const oB = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-DUP-B-${timestamp.toString().slice(-4)}`,
        status: 'completed',
        subtotal: 380.0,
        discount_amount: 0.0,
        tax_amount: 20.0,
        total_amount: 400.0,
        ordered_at: now,
      },
    });
    orderDupSameAmtId = oB.id;
    await prisma.payments.create({
      data: {
        order_id: orderDupSameAmtId,
        amount: 400.0,
        payment_method: 'upi',
        status: 'paid',
        transaction_reference: 'UPI-REF-EARLIER',
        paid_at: tMinus10m,
      },
    });
    await prisma.payments.create({
      data: {
        order_id: orderDupSameAmtId,
        amount: 400.0,
        payment_method: 'cash',
        status: 'paid',
        paid_at: tMinus5m,
      },
    });

    // Order C: Duplicate records with mismatched amounts (Card 100 partial + Cash 300 exact = Raw 400)
    // Canonical should prefer Cash 300 because it matches total_amount exactly
    const oC = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-DUP-C-${timestamp.toString().slice(-4)}`,
        status: 'completed',
        subtotal: 285.0,
        discount_amount: 0.0,
        tax_amount: 15.0,
        total_amount: 300.0,
        ordered_at: now,
      },
    });
    orderDupMismatchId = oC.id;
    await prisma.payments.create({
      data: {
        order_id: orderDupMismatchId,
        amount: 100.0,
        payment_method: 'card',
        status: 'paid',
        paid_at: tMinus10m, // earlier, but mismatched amount
      },
    });
    await prisma.payments.create({
      data: {
        order_id: orderDupMismatchId,
        amount: 300.0,
        payment_method: 'cash',
        status: 'paid',
        paid_at: tMinus5m, // matches order total_amount (300.00)
      },
    });

    // Order E: Unpaid open tab (total: 180.0)
    const oE = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-UNPAID-${timestamp.toString().slice(-4)}`,
        status: 'served',
        subtotal: 170.0,
        discount_amount: 0.0,
        tax_amount: 10.0,
        total_amount: 180.0,
        ordered_at: now,
      },
    });
    orderUnpaidId = oE.id;

    // Order F: Failed and refunded records only (no paid record)
    const oF = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-FAILED-${timestamp.toString().slice(-4)}`,
        status: 'completed',
        subtotal: 190.0,
        discount_amount: 0.0,
        tax_amount: 10.0,
        total_amount: 200.0,
        ordered_at: now,
      },
    });
    orderFailedRefundedId = oF.id;
    await prisma.payments.create({
      data: {
        order_id: orderFailedRefundedId,
        amount: 200.0,
        payment_method: 'card',
        status: 'failed',
        created_at: tMinus10m,
      },
    });
    await prisma.payments.create({
      data: {
        order_id: orderFailedRefundedId,
        amount: 200.0,
        payment_method: 'upi',
        status: 'refunded',
        created_at: tMinus5m,
      },
    });

    // Order G: Foreign restaurant duplicate order (must never be included)
    const oG = await prisma.orders.create({
      data: {
        restaurant_id: owner2RestaurantId,
        branch_id: owner2Branch2Id,
        customer_id: customerId,
        order_number: `ORD-FOR-DUP-${timestamp.toString().slice(-4)}`,
        status: 'completed',
        subtotal: 900.0,
        discount_amount: 0.0,
        tax_amount: 50.0,
        total_amount: 950.0,
        ordered_at: now,
      },
    });
    orderForeignDupId = oG.id;
    await prisma.payments.create({
      data: {
        order_id: orderForeignDupId,
        amount: 950.0,
        payment_method: 'upi',
        status: 'paid',
        paid_at: now,
      },
    });
    await prisma.payments.create({
      data: {
        order_id: orderForeignDupId,
        amount: 950.0,
        payment_method: 'cash',
        status: 'paid',
        paid_at: now,
      },
    });

    // Order H: Paid 2 days ago (outside 'today' range)
    const oH = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        customer_id: customerId,
        order_number: `ORD-OLD-${timestamp.toString().slice(-4)}`,
        status: 'completed',
        subtotal: 100.0,
        discount_amount: 0.0,
        tax_amount: 5.0,
        total_amount: 105.0,
        ordered_at: twoDaysAgo,
      },
    });
    orderOutsideDateId = oH.id;
    await prisma.payments.create({
      data: {
        order_id: orderOutsideDateId,
        amount: 105.0,
        payment_method: 'cash',
        status: 'paid',
        paid_at: twoDaysAgo,
      },
    });
  });

  afterAll(async () => {
    try {
      const allOrderIds = [
        orderNormalId,
        orderDupSameAmtId,
        orderDupMismatchId,
        orderUnpaidId,
        orderFailedRefundedId,
        orderForeignDupId,
        orderOutsideDateId,
      ].filter(Boolean);

      if (allOrderIds.length > 0) {
        await prisma.payments.deleteMany({ where: { order_id: { in: allOrderIds } } }).catch(() => {});
        await prisma.orders.deleteMany({ where: { id: { in: allOrderIds } } }).catch(() => {});
      }
      if (owner1TableId) {
        await prisma.restaurant_tables.deleteMany({ where: { id: owner1TableId } }).catch(() => {});
      }
      if (owner1Branch1Id) {
        await prisma.branches.deleteMany({ where: { id: owner1Branch1Id } }).catch(() => {});
      }
      if (owner2Branch2Id) {
        await prisma.branches.deleteMany({ where: { id: owner2Branch2Id } }).catch(() => {});
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

  describe('Duplicate Paid Settlement Policy Enforcement', () => {
    it('should distinguish headline realized revenue from raw recorded paid amount without silent capping', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      const { settlement, sales } = json.data;

      // 1. Headline Realized Revenue vs Raw Recorded Paid Amount:
      // Canonical settlements:
      // - Order A: 250.00 (UPI)
      // - Order B: 400.00 (UPI, earliest of the two 400 rows)
      // - Order C: 300.00 (Cash, exact total_amount match over partial 100)
      // Total headline realized revenue = 250 + 400 + 300 = 950.00
      expect(settlement.realizedRevenue).toBe(950.0);
      expect(settlement.realizedRevenueFormatted).toBe('950.00');

      // Raw recorded paid amount:
      // - Order A: 250
      // - Order B: 400 + 400 = 800
      // - Order C: 100 + 300 = 400
      // Total raw recorded = 250 + 800 + 400 = 1450.00
      expect(settlement.rawRecordedPaidAmount).toBe(1450.0);
      expect(settlement.rawRecordedPaidAmountFormatted).toBe('1450.00');

      // Duplicate settlement excess amount: 1450 - 950 = 500.00
      expect(settlement.duplicateSettlementExcessAmount).toBe(500.0);
      expect(settlement.duplicateSettlementExcessAmountFormatted).toBe('500.00');
    });

    it('should maintain distinct settled-order count and accurate realized AOV', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();
      const { settlement } = json.data;

      // Settled orders count must be distinct count = 3 (Order A, Order B, Order C)
      // Multiple paid records on Order B and C must NOT increase settled order count to 5!
      expect(settlement.settledOrdersCount).toBe(3);

      // Realized AOV = 950.00 / 3 = 316.67
      expect(settlement.realizedAov).toBe(316.67);
      expect(settlement.realizedAovFormatted).toBe('316.67');
    });

    it('should surface anomalous orders in a privacy-safe structure with warning flag', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();
      const { settlement } = json.data;

      expect(settlement.hasDuplicatePaidRecordsWarning).toBe(true);
      expect(settlement.anomalousOrdersCount).toBe(2);
      expect(Array.isArray(settlement.anomalousOrders)).toBe(true);
      expect(settlement.anomalousOrders.length).toBe(2);
      expect(settlement.duplicateSettlementPolicy).toBe('FIRST_CANONICAL_FULL_SETTLEMENT');

      // Check Order B anomaly entry
      const anomB = settlement.anomalousOrders.find((a: any) => a.orderId === orderDupSameAmtId);
      expect(anomB).toBeDefined();
      expect(anomB.orderTotal).toBe(400.0);
      expect(anomB.paidRecordsCount).toBe(2);
      expect(anomB.rawPaidAmount).toBe(800.0);
      expect(anomB.canonicalPaidAmount).toBe(400.0);
      expect(anomB.excessAmount).toBe(400.0);
      expect(anomB.canonicalPaymentMethod).toBe('upi'); // Earlier payment was UPI

      // Check Order C anomaly entry (mismatched amounts)
      const anomC = settlement.anomalousOrders.find((a: any) => a.orderId === orderDupMismatchId);
      expect(anomC).toBeDefined();
      expect(anomC.orderTotal).toBe(300.0);
      expect(anomC.paidRecordsCount).toBe(2);
      expect(anomC.rawPaidAmount).toBe(400.0);
      expect(anomC.canonicalPaidAmount).toBe(300.0); // Exact match selected
      expect(anomC.excessAmount).toBe(100.0);
      expect(anomC.canonicalPaymentMethod).toBe('cash');

      // Privacy check: No customer phone numbers or PII leaked
      for (const anom of settlement.anomalousOrders) {
        expect(anom).not.toHaveProperty('customerPhone');
        expect(anom).not.toHaveProperty('phone');
        expect(anom).not.toHaveProperty('customer_id');
        expect(anom).not.toHaveProperty('gateway_payload');
      }
    });

    it('should maintain consistent payment method breakdown matching headline realized revenue', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();
      const { settlement } = json.data;

      // Headline payment method breakdown:
      // Order A: 250 UPI
      // Order B: 400 UPI (canonical)
      // Order C: 300 Cash (canonical)
      // UPI total = 650.00 (count 2), Cash total = 300.00 (count 1), Card = 0.00 (count 0)
      const { paymentMethodBreakdown, rawPaymentMethodBreakdown } = settlement;

      expect(paymentMethodBreakdown.upi.amount).toBe(650.0);
      expect(paymentMethodBreakdown.upi.count).toBe(2);
      expect(paymentMethodBreakdown.cash.amount).toBe(300.0);
      expect(paymentMethodBreakdown.cash.count).toBe(1);
      expect(paymentMethodBreakdown.card.amount).toBe(0.0);
      expect(paymentMethodBreakdown.card.count).toBe(0);

      // Sum of headline payment method breakdown equals realizedRevenue exactly
      const sumHeadline =
        paymentMethodBreakdown.cash.amount +
        paymentMethodBreakdown.upi.amount +
        paymentMethodBreakdown.card.amount +
        paymentMethodBreakdown.other.amount;
      expect(sumHeadline).toBe(settlement.realizedRevenue);

      // Raw payment method breakdown:
      // UPI: 250 (A) + 400 (B) = 650
      // Cash: 400 (B) + 300 (C) = 700
      // Card: 100 (C) = 100
      // Total raw = 650 + 700 + 100 = 1450.00
      expect(rawPaymentMethodBreakdown.upi.amount).toBe(650.0);
      expect(rawPaymentMethodBreakdown.cash.amount).toBe(700.0);
      expect(rawPaymentMethodBreakdown.card.amount).toBe(100.0);

      const sumRaw =
        rawPaymentMethodBreakdown.cash.amount +
        rawPaymentMethodBreakdown.upi.amount +
        rawPaymentMethodBreakdown.card.amount +
        rawPaymentMethodBreakdown.other.amount;
      expect(sumRaw).toBe(settlement.rawRecordedPaidAmount);
    });

    it('should maintain consistent daily revenue trend without duplicate settlement inflation', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();
      const { dailyTrend, settlement } = json.data;

      // Sum of dailyTrend.realizedRevenue must equal settlement.realizedRevenue
      const totalDailyRealized = dailyTrend.reduce(
        (acc: number, d: any) => acc + d.realizedRevenue,
        0
      );
      expect(totalDailyRealized).toBe(settlement.realizedRevenue);
    });

    it('should correctly include orders with no paid records and failed/refunded records in unsettled metrics', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();
      const { settlement } = json.data;

      // Order E (180.00, unpaid) and Order F (200.00, failed/refunded only) are unsettled
      // 180 + 200 = 380.00
      expect(settlement.unsettledOrdersCount).toBe(2);
      expect(settlement.unsettledAmount).toBe(380.0);
      expect(settlement.unsettledAmountFormatted).toBe('380.00');
    });

    it('should maintain strict tenant isolation and ignore foreign restaurant duplicate orders', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();
      const { settlement, sales } = json.data;

      // Foreign Order G (950 total, 1900 raw paid) must not appear in Owner 1's dashboard
      expect(sales.totalOrders).toBe(5); // Orders A, B, C, E, F
      expect(settlement.settledOrdersCount).toBe(3);
      expect(settlement.realizedRevenue).toBe(950.0);

      // Verify Owner 2's dashboard only sees Order G
      const req2 = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner2Token}` } }
      );
      const res2 = await getSalesDashboardHandler(req2);
      const json2 = await res2.json();
      expect(json2.data.settlement.settledOrdersCount).toBe(1);
      expect(json2.data.settlement.realizedRevenue).toBe(950.0);
      expect(json2.data.settlement.rawRecordedPaidAmount).toBe(1900.0);
      expect(json2.data.settlement.anomalousOrdersCount).toBe(1);
    });

    it('should respect date boundaries and exclude payments settled outside the window', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      const json = await res.json();

      // Order H was paid 2 days ago, so it must not be in 'today' metrics
      const orderIds = json.data.settlement.anomalousOrders.map((a: any) => a.orderId);
      expect(orderIds).not.toContain(orderOutsideDateId);
    });
  });
});
