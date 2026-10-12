import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { GET as getSalesDashboardHandler } from '@/app/api/v1/owner/dashboard/sales/route';

describe('STEP 11B: POS Sales Dashboard Reporting Integration Tests', () => {
  const timestamp = Date.now();

  // Test Owner 1 (Primary venue)
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1Branch1Id: string;
  let owner1Branch2Id: string;
  let owner1TableId: string;

  // Test Owner 2 (Cross-tenant venue)
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2Branch3Id: string;

  // Customer
  let customerId: string;
  let customerToken: string;

  // Test Orders
  let order1Id: string;
  let order2Id: string;
  let order3Id: string;
  let order4Id: string;
  let order5CancelledId: string;
  let order6ForeignId: string;

  // Products
  let categoryId: string;
  let prodCappuccinoId: string;
  let prodMuffinId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 + Restaurant 1 + Branches 1 & 2 + Table 1
    const owner1 = await prisma.users.create({
      data: {
        email: `dashboard_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Dashboard Owner 1',
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
        name: `Dashboard Bistro ${timestamp}`,
        legal_name: 'Dashboard Bistro Ltd',
        owner_id: owner1Id,
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Main Downtown Branch',
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner1Branch1Id = branch1.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Uptown Express Branch',
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner1Branch2Id = branch2.id;

    const table1 = await prisma.restaurant_tables.create({
      data: {
        branch_id: owner1Branch1Id,
        table_number: 'T-DASH-1',
        capacity: 4,
        status: 'active',
      },
    });
    owner1TableId = table1.id;

    // 2. Create Owner 2 + Restaurant 2 + Branch 3 (for cross-tenant testing)
    const owner2 = await prisma.users.create({
      data: {
        email: `dashboard_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Dashboard Owner 2',
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
        timezone: 'Asia/Kolkata',
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const branch3 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Foreign Branch 3',
        status: 'active',
      },
    });
    owner2Branch3Id = branch3.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        name: 'Dashboard Customer',
        phone: `+9199${timestamp.toString().slice(-8)}`,
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

    // 4. Create Menu Items
    const cat = await prisma.categories.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: `Beverages & Bakery ${timestamp}`,
      },
    });
    categoryId = cat.id;

    const prodCap = await prisma.products.create({
      data: {
        restaurant_id: owner1RestaurantId,
        category_id: categoryId,
        name: 'Artisan Cappuccino',
        price: 150.0,
      },
    });
    prodCappuccinoId = prodCap.id;

    const prodMuf = await prisma.products.create({
      data: {
        restaurant_id: owner1RestaurantId,
        category_id: categoryId,
        name: 'Blueberry Muffin',
        price: 120.0,
      },
    });
    prodMuffinId = prodMuf.id;

    const now = new Date();

    // 5. Seed Test Orders
    // Order 1: Branch 1, Completed & Settled via Cash
    // 2x Cappuccino = 300, discount = 0, tax = 15, total = 315
    const o1 = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-DASH-1-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 300.0,
        discount_amount: 0.0,
        tax_amount: 15.0,
        total_amount: 315.0,
        ordered_at: now,
      },
    });
    order1Id = o1.id;

    await prisma.order_items.create({
      data: {
        order_id: order1Id,
        product_id: prodCappuccinoId,
        product_name: 'Artisan Cappuccino (Snapshot)',
        quantity: 2,
        unit_price: 150.0,
        total_price: 300.0,
      },
    });

    await prisma.payments.create({
      data: {
        order_id: order1Id,
        amount: 315.0,
        payment_method: 'cash',
        status: 'paid',
        paid_at: now,
      },
    });

    // Order 2: Branch 1, Completed & Settled via UPI after a failed Card attempt
    // 1x Blueberry Muffin = 120, discount = 20, tax = 5, total = 105
    const o2 = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-DASH-2-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 120.0,
        discount_amount: 20.0,
        tax_amount: 5.0,
        total_amount: 105.0,
        ordered_at: now,
      },
    });
    order2Id = o2.id;

    await prisma.order_items.create({
      data: {
        order_id: order2Id,
        product_id: prodMuffinId,
        product_name: 'Blueberry Muffin (Snapshot)',
        quantity: 1,
        unit_price: 120.0,
        total_price: 120.0,
      },
    });

    // Older failed card payment attempt
    await prisma.payments.create({
      data: {
        order_id: order2Id,
        amount: 105.0,
        payment_method: 'card',
        status: 'failed',
        transaction_reference: 'CARD-DECLINED-123',
        created_at: new Date(now.getTime() - 100000),
      },
    });

    // Successful UPI payment
    await prisma.payments.create({
      data: {
        order_id: order2Id,
        amount: 105.0,
        payment_method: 'upi',
        status: 'paid',
        transaction_reference: 'UPI-UTR-SUCCESS',
        paid_at: now,
      },
    });

    // Order 3: Branch 1, Served but UNPAID (Open Tab)
    // 1x Cappuccino = 150, discount = 0, tax = 7.5, total = 157.5
    const o3 = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        table_id: owner1TableId,
        customer_id: customerId,
        order_number: `ORD-DASH-3-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'served',
        subtotal: 150.0,
        discount_amount: 0.0,
        tax_amount: 7.5,
        total_amount: 157.5,
        ordered_at: now,
      },
    });
    order3Id = o3.id;

    await prisma.order_items.create({
      data: {
        order_id: order3Id,
        product_id: prodCappuccinoId,
        product_name: 'Artisan Cappuccino (Snapshot)',
        quantity: 1,
        unit_price: 150.0,
        total_price: 150.0,
      },
    });

    // Order 4: Branch 2 (Uptown Express), Completed but UNPAID
    // 1x Blueberry Muffin = 120, discount = 0, tax = 6, total = 126
    const o4 = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch2Id,
        customer_id: customerId,
        order_number: `ORD-DASH-4-${timestamp.toString().slice(-4)}`,
        order_type: 'takeaway',
        status: 'completed',
        subtotal: 120.0,
        discount_amount: 0.0,
        tax_amount: 6.0,
        total_amount: 126.0,
        ordered_at: now,
      },
    });
    order4Id = o4.id;

    await prisma.order_items.create({
      data: {
        order_id: order4Id,
        product_id: prodMuffinId,
        product_name: 'Blueberry Muffin (Snapshot)',
        quantity: 1,
        unit_price: 120.0,
        total_price: 120.0,
      },
    });

    // Order 5: Branch 1, Cancelled Order (Must be excluded from sales/revenue)
    const o5 = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1Branch1Id,
        customer_id: customerId,
        order_number: `ORD-DASH-5-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'cancelled',
        subtotal: 200.0,
        discount_amount: 0.0,
        tax_amount: 10.0,
        total_amount: 210.0,
        ordered_at: now,
      },
    });
    order5CancelledId = o5.id;

    // Order 6: Foreign Order belonging to Owner 2
    const o6 = await prisma.orders.create({
      data: {
        restaurant_id: owner2RestaurantId,
        branch_id: owner2Branch3Id,
        customer_id: customerId,
        order_number: `ORD-FOREIGN-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 500.0,
        discount_amount: 0.0,
        tax_amount: 25.0,
        total_amount: 525.0,
        ordered_at: now,
      },
    });
    order6ForeignId = o6.id;
  });

  afterAll(async () => {
    try {
      const allOrderIds = [
        order1Id,
        order2Id,
        order3Id,
        order4Id,
        order5CancelledId,
        order6ForeignId,
      ].filter(Boolean);

      if (allOrderIds.length > 0) {
        await prisma.payments.deleteMany({ where: { order_id: { in: allOrderIds } } }).catch(() => {});
        await prisma.order_items.deleteMany({ where: { order_id: { in: allOrderIds } } }).catch(() => {});
        await prisma.orders.deleteMany({ where: { id: { in: allOrderIds } } }).catch(() => {});
      }

      if (prodCappuccinoId || prodMuffinId) {
        await prisma.products.deleteMany({
          where: { id: { in: [prodCappuccinoId, prodMuffinId].filter(Boolean) } },
        }).catch(() => {});
      }
      if (categoryId) {
        await prisma.categories.deleteMany({ where: { id: categoryId } }).catch(() => {});
      }
      if (owner1TableId) {
        await prisma.restaurant_tables.deleteMany({ where: { id: owner1TableId } }).catch(() => {});
      }
      if (owner1Branch1Id || owner1Branch2Id) {
        await prisma.branches.deleteMany({
          where: { id: { in: [owner1Branch1Id, owner1Branch2Id].filter(Boolean) } },
        }).catch(() => {});
      }
      if (owner2Branch3Id) {
        await prisma.branches.deleteMany({ where: { id: owner2Branch3Id } }).catch(() => {});
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

  describe('1. Authentication & Role Enforcement', () => {
    it('should reject unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/dashboard/sales');
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject CUSTOMER role with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/dashboard/sales', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Query Validation & Parameter Constraints', () => {
    it('should reject inverted date ranges (dateFrom > dateTo) with 400', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?dateFrom=2026-10-15&dateTo=2026-10-10',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.message).toContain('dateFrom cannot be after dateTo');
    });

    it('should reject date ranges exceeding 90 calendar days with 400', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?dateFrom=2026-01-01&dateTo=2026-06-01',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.message).toContain('cannot exceed 90 calendar days');
    });

    it('should reject branchId belonging to another restaurant with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/dashboard/sales?branchId=${owner2Branch3Id}`,
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error.message).toContain('does not belong to your authorized restaurant');
    });
  });

  describe('3. Restaurant-Wide POS Dashboard Reporting (Today Preset)', () => {
    it('should return complete, financially correct sales and settlement metrics', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?preset=today',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      const { meta, sales, settlement, topSellingItems, dailyTrend, hourlyTrend } = json.data;

      // Meta verification
      expect(meta.restaurantId).toBe(owner1RestaurantId);
      expect(meta.branchId).toBeNull();
      expect(meta.preset).toBe('today');
      expect(meta.timezone).toBe('Asia/Kolkata');
      expect(meta.orderPeriodTimestampBasis).toBe('orders.ordered_at');
      expect(meta.settlementPeriodTimestampBasis).toBe('payments.paid_at');

      // Order counts & status breakdown:
      // Orders: O1(completed), O2(completed), O3(served), O4(completed), O5(cancelled). Foreign O6 excluded!
      expect(sales.totalOrders).toBe(5);
      expect(sales.eligibleOrdersCount).toBe(4); // Excludes cancelled O5
      expect(sales.orderStatusBreakdown.completed).toBe(3);
      expect(sales.orderStatusBreakdown.served).toBe(1);
      expect(sales.orderStatusBreakdown.cancelled).toBe(1);
      expect(sales.orderStatusBreakdown.pending).toBe(0);

      // Financial Billed Sales Metrics:
      // Gross sales = 300 (O1) + 120 (O2) + 150 (O3) + 120 (O4) = 690.00
      expect(sales.grossSales).toBe(690.0);
      expect(sales.grossSalesFormatted).toBe('690.00');

      // Total discounts = 20.00 (O2 coupon)
      expect(sales.totalDiscounts).toBe(20.0);
      expect(sales.totalDiscountsFormatted).toBe('20.00');

      // Total tax = 15 + 5 + 7.5 + 6 = 33.50
      expect(sales.totalTax).toBe(33.5);
      expect(sales.totalTaxFormatted).toBe('33.50');

      // Net billed sales = 315 + 105 + 157.5 + 126 = 703.50
      expect(sales.netBilledSales).toBe(703.5);
      expect(sales.netBilledSalesFormatted).toBe('703.50');

      // Billed AOV = 703.50 / 4 = 175.88
      expect(sales.billedAov).toBe(175.88);
      expect(sales.billedAovFormatted).toBe('175.88');

      // Settlement Metrics:
      // Realized revenue = 315 (O1 cash) + 105 (O2 UPI) = 420.00 (Failed card payment 105 is NOT counted!)
      expect(settlement.realizedRevenue).toBe(420.0);
      expect(settlement.realizedRevenueFormatted).toBe('420.00');

      // Settled orders count = 2 (O1 and O2)
      expect(settlement.settledOrdersCount).toBe(2);

      // Realized AOV = 420.00 / 2 = 210.00
      expect(settlement.realizedAov).toBe(210.0);
      expect(settlement.realizedAovFormatted).toBe('210.00');

      // Unsettled orders count = 2 (O3 served, O4 completed-but-unpaid)
      // Unsettled amount = 157.50 (O3) + 126.00 (O4) = 283.50
      expect(settlement.unsettledOrdersCount).toBe(2);
      expect(settlement.unsettledAmount).toBe(283.5);
      expect(settlement.unsettledAmountFormatted).toBe('283.50');

      // Payment method breakdown:
      expect(settlement.paymentMethodBreakdown.cash.amount).toBe(315.0);
      expect(settlement.paymentMethodBreakdown.cash.count).toBe(1);
      expect(settlement.paymentMethodBreakdown.upi.amount).toBe(105.0);
      expect(settlement.paymentMethodBreakdown.upi.count).toBe(1);
      expect(settlement.paymentMethodBreakdown.card.amount).toBe(0.0);
      expect(settlement.paymentMethodBreakdown.card.count).toBe(0);

      // Top Selling Items (from immutable order_items snapshots):
      // Cappuccino: 2 (O1) + 1 (O3) = 3 sold, total = 450.00
      // Muffin: 1 (O2) + 1 (O4) = 2 sold, total = 240.00
      expect(topSellingItems.length).toBeGreaterThanOrEqual(2);
      const capItem = topSellingItems.find((it: any) => it.productName.includes('Cappuccino'));
      const mufItem = topSellingItems.find((it: any) => it.productName.includes('Muffin'));
      expect(capItem).toBeDefined();
      expect(capItem.quantitySold).toBe(3);
      expect(capItem.totalRevenue).toBe(450.0);

      expect(mufItem).toBeDefined();
      expect(mufItem.quantitySold).toBe(2);
      expect(mufItem.totalRevenue).toBe(240.0);

      // Trend series:
      expect(Array.isArray(dailyTrend)).toBe(true);
      expect(dailyTrend.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(hourlyTrend)).toBe(true);
      expect(hourlyTrend.length).toBe(24);
    });
  });

  describe('4. Branch-Specific Scoping & Filtering', () => {
    it('should aggregate only orders and revenue for the selected branch (Branch 1)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/dashboard/sales?preset=today&branchId=${owner1Branch1Id}`,
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      const { meta, sales, settlement } = json.data;
      expect(meta.branchId).toBe(owner1Branch1Id);

      // Branch 1 has O1, O2, O3, O5(cancelled). Branch 2 order O4 is excluded!
      expect(sales.totalOrders).toBe(4);
      expect(sales.eligibleOrdersCount).toBe(3); // O1, O2, O3

      // Net billed sales = 315 (O1) + 105 (O2) + 157.5 (O3) = 577.50
      expect(sales.netBilledSales).toBe(577.5);
      expect(sales.netBilledSalesFormatted).toBe('577.50');

      // Unsettled count for Branch 1 = 1 (O3 only, O4 excluded)
      expect(settlement.unsettledOrdersCount).toBe(1);
      expect(settlement.unsettledAmount).toBe(157.5);
    });
  });

  describe('5. Empty Dataset Handling', () => {
    it('should return safe numeric zeroes and empty lists when no orders exist in range', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/owner/dashboard/sales?dateFrom=2028-01-01&dateTo=2028-01-02',
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getSalesDashboardHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      const { sales, settlement, topSellingItems, dailyTrend, hourlyTrend } = json.data;

      expect(sales.totalOrders).toBe(0);
      expect(sales.eligibleOrdersCount).toBe(0);
      expect(sales.grossSales).toBe(0);
      expect(sales.grossSalesFormatted).toBe('0.00');
      expect(sales.netBilledSales).toBe(0);
      expect(sales.netBilledSalesFormatted).toBe('0.00');
      expect(sales.billedAov).toBe(0);
      expect(sales.billedAovFormatted).toBe('0.00');

      expect(settlement.realizedRevenue).toBe(0);
      expect(settlement.realizedRevenueFormatted).toBe('0.00');
      expect(settlement.settledOrdersCount).toBe(0);
      expect(settlement.realizedAov).toBe(0);
      expect(settlement.unsettledOrdersCount).toBe(0);
      expect(settlement.unsettledAmount).toBe(0);

      expect(topSellingItems).toEqual([]);
      expect(dailyTrend).toEqual([]);
      expect(hourlyTrend.length).toBe(24);
      expect(hourlyTrend[0].ordersCount).toBe(0);
      expect(hourlyTrend[0].netBilledSales).toBe(0);
    });
  });
});
