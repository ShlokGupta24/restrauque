import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCustomer } from '@/lib/auth/guard';
import { GET as getCustomerDashboardOverviewHandler } from '@/app/api/v1/customer/dashboard/overview/route';
import { getCustomerDashboardOverview } from '@/lib/customer/overview';
import { AuthenticationError, ForbiddenError, NotFoundError } from '@/lib/http/errors';

// Mock Prisma
vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    customers: {
      findUnique: vi.fn(),
    },
    orders: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    feedback: {
      count: vi.fn(),
    },
    customer_loyalty_accounts: {
      findMany: vi.fn(),
    },
    loyalty_transactions: {
      findMany: vi.fn(),
    },
    restaurants: {
      findMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock Auth Guard for route handler tests
vi.mock('@/lib/auth/guard', () => ({
  requireCustomer: vi.fn(),
}));

describe('Step 21 — Customer Dashboard Overview API (GET /api/v1/customer/dashboard/overview)', () => {
  const mockCustomerId = '11111111-1111-4111-8111-111111111111';
  const mockOtherCustomerId = '99999999-9999-4999-8999-999999999999';
  const mockRestaurant1Id = '22222222-2222-4222-8222-222222222222';
  const mockRestaurant2Id = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Authorization & Route Handler Tests
  // =========================================================================
  describe('1. Authentication and Authorization Guard', () => {
    it('returns 401 UNAUTHORIZED when authentication credentials are missing or invalid', async () => {
      vi.mocked(requireCustomer).mockRejectedValueOnce(
        new AuthenticationError('Authentication required: Missing credentials')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/customer/dashboard/overview');
      const response = await getCustomerDashboardOverviewHandler(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Missing credentials');
    });

    it('returns 403 FORBIDDEN when user role is not CUSTOMER (e.g., RESTAURANT_OWNER)', async () => {
      vi.mocked(requireCustomer).mockRejectedValueOnce(
        new ForbiddenError('Access forbidden: Requires one of [CUSTOMER] role')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/customer/dashboard/overview');
      const response = await getCustomerDashboardOverviewHandler(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 200 OK with success envelope when authenticated as CUSTOMER', async () => {
      vi.mocked(requireCustomer).mockResolvedValueOnce({
        user: {
          id: mockCustomerId,
          name: 'Jane Doe',
          phone: '+919876543210',
          email: null,
          role: 'CUSTOMER',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        sessionId: 'session-123',
      });

      // Mock DB calls for an empty state
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'Jane Doe',
        phone: '+919876543210',
      } as any);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/v1/customer/dashboard/overview');
      const response = await getCustomerDashboardOverviewHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.customer.id).toBe(mockCustomerId);
      expect(body.data.customer.name).toBe('Jane Doe');
      expect(body.data.customer.phone).toBe('+919876543210');
      expect(body.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Empty State Handling
  // =========================================================================
  describe('2. Empty State Handling', () => {
    it('returns clean, non-null empty states with 0 counts for new customer without errors', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'New Customer',
        phone: '+919999999999',
      } as any);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      const result = await getCustomerDashboardOverview(mockCustomerId);

      expect(result.customer.id).toBe(mockCustomerId);
      expect(result.customer.name).toBe('New Customer');
      expect(result.customer.phone).toBe('+919999999999');

      expect(result.feedbackSummary).toEqual({
        pendingFeedbackCount: 0,
        submittedFeedbackCount: 0,
        completedOrdersCount: 0,
      });

      expect(result.loyaltyAccounts).toEqual([]);
      expect(result.recentRestaurants).toEqual([]);
      expect(result.recentPointsActivity).toEqual([]);
    });

    it('falls back to authenticated session details if customers table lookup is delayed', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      const result = await getCustomerDashboardOverview(mockCustomerId, {
        id: mockCustomerId,
        name: 'Fallback Session User',
        phone: '+919111111111',
      });

      expect(result.customer.id).toBe(mockCustomerId);
      expect(result.customer.name).toBe('Fallback Session User');
      expect(result.customer.phone).toBe('+919111111111');
    });
  });

  // =========================================================================
  // 3. Feedback Summary Counts & Eligibility Isolation
  // =========================================================================
  describe('3. Feedback Summary Counts', () => {
    it('correctly calculates pending feedback and submitted reviews for completed orders', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'Alice',
        phone: '+919876500000',
      } as any);

      // Pending feedback: 2 completed orders with no feedback
      // Submitted feedback: 5 feedback records
      // Completed orders total: 7 completed orders
      vi.mocked(prisma.orders.count)
        .mockResolvedValueOnce(2) // pendingFeedbackCount
        .mockResolvedValueOnce(7); // completedOrdersCount

      vi.mocked(prisma.feedback.count).mockResolvedValueOnce(5); // submittedFeedbackCount

      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      const result = await getCustomerDashboardOverview(mockCustomerId);

      expect(result.feedbackSummary.pendingFeedbackCount).toBe(2);
      expect(result.feedbackSummary.submittedFeedbackCount).toBe(5);
      expect(result.feedbackSummary.completedOrdersCount).toBe(7);

      // Verify query semantics: pending feedback only queries status: 'completed' and feedback: { none: {} }
      expect(prisma.orders.count).toHaveBeenCalledWith({
        where: {
          customer_id: mockCustomerId,
          status: 'completed',
          feedback: { none: {} },
        },
      });

      // Verify query semantics: submitted feedback queries customer_id
      expect(prisma.feedback.count).toHaveBeenCalledWith({
        where: {
          customer_id: mockCustomerId,
        },
      });
    });
  });

  // =========================================================================
  // 4. Restaurant-Separated Loyalty Balances (No cross-restaurant combining)
  // =========================================================================
  describe('4. Restaurant-Separated Loyalty Balances', () => {
    it('returns separate loyalty accounts with pointsBalance and backward-compatible starsBalance', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'Bob',
        phone: '+919876500001',
      } as any);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      const mockLoyaltyAccounts = [
        {
          id: 'acc-1',
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurant1Id,
          stars_balance: 150,
          lifetime_stars_earned: 200,
          lifetime_stars_redeemed: 50,
          tier: 'silver',
          status: 'active',
          restaurants: { id: mockRestaurant1Id, name: 'The Truffle Table' },
          loyalty_programs: { name: 'Truffle Rewards' },
        },
        {
          id: 'acc-2',
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurant2Id,
          stars_balance: 75,
          lifetime_stars_earned: 75,
          lifetime_stars_redeemed: 0,
          tier: 'standard',
          status: 'active',
          restaurants: { id: mockRestaurant2Id, name: 'Spice Route' },
          loyalty_programs: { name: 'Spice Club' },
        },
      ];

      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce(
        mockLoyaltyAccounts as any
      );

      const result = await getCustomerDashboardOverview(mockCustomerId);

      expect(result.loyaltyAccounts).toHaveLength(2);

      // Account 1
      const account1 = result.loyaltyAccounts.find((a) => a.restaurantId === mockRestaurant1Id)!;
      expect(account1.restaurantName).toBe('The Truffle Table');
      expect(account1.programName).toBe('Truffle Rewards');
      expect(account1.pointsBalance).toBe(150);
      expect(account1.starsBalance).toBe(150); // Backward compatibility
      expect(account1.lifetimePointsEarned).toBe(200);
      expect(account1.lifetimeStarsEarned).toBe(200);
      expect(account1.lifetimePointsRedeemed).toBe(50);
      expect(account1.lifetimeStarsRedeemed).toBe(50);

      // Account 2
      const account2 = result.loyaltyAccounts.find((a) => a.restaurantId === mockRestaurant2Id)!;
      expect(account2.restaurantName).toBe('Spice Route');
      expect(account2.programName).toBe('Spice Club');
      expect(account2.pointsBalance).toBe(75);
      expect(account2.starsBalance).toBe(75);

      // Verify balances are NOT combined into a single cross-restaurant aggregate
      expect((result as any).totalPoints).toBeUndefined();
      expect((result as any).aggregateBalance).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. Recent Restaurant Activity
  // =========================================================================
  describe('5. Recent Restaurant Activity', () => {
    it('returns recent restaurants with visitCount and lastOrderDate excluding cancelled orders', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'Charlie',
        phone: null,
      } as any);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      const mockGroupResults = [
        {
          restaurant_id: mockRestaurant1Id,
          _count: { id: 4 },
          _max: { ordered_at: new Date('2026-10-19T18:00:00.000Z') },
        },
        {
          restaurant_id: mockRestaurant2Id,
          _count: { id: 1 },
          _max: { ordered_at: new Date('2026-10-15T12:30:00.000Z') },
        },
      ];

      vi.mocked(prisma.orders.groupBy).mockResolvedValueOnce(mockGroupResults as any);
      vi.mocked(prisma.restaurants.findMany).mockResolvedValueOnce([
        { id: mockRestaurant1Id, name: 'The Truffle Table' },
        { id: mockRestaurant2Id, name: 'Spice Route' },
      ] as any);

      const result = await getCustomerDashboardOverview(mockCustomerId);

      expect(result.recentRestaurants).toHaveLength(2);
      expect(result.recentRestaurants[0]).toEqual({
        restaurantId: mockRestaurant1Id,
        restaurantName: 'The Truffle Table',
        lastOrderDate: '2026-10-19T18:00:00.000Z',
        visitCount: 4,
      });
      expect(result.recentRestaurants[1]).toEqual({
        restaurantId: mockRestaurant2Id,
        restaurantName: 'Spice Route',
        lastOrderDate: '2026-10-15T12:30:00.000Z',
        visitCount: 1,
      });

      // Verify that orders.groupBy excluded cancelled orders
      expect(prisma.orders.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customer_id: mockCustomerId,
            status: { not: 'cancelled' },
          },
        })
      );
    });
  });

  // =========================================================================
  // 6. Recent Points Activity (Earning vs Redemption)
  // =========================================================================
  describe('6. Recent Points Activity', () => {
    it('returns transactions distinguishing earning vs redemption, with balanceAfter as null', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'Diana',
        phone: '+919876500003',
      } as any);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);

      const mockTransactions = [
        {
          id: 'tx-1',
          restaurant_id: mockRestaurant1Id,
          transaction_type: 'review_reward',
          stars: 12,
          description: 'Earned 12 points for order review',
          created_at: new Date('2026-10-19T19:00:00.000Z'),
          restaurants: { id: mockRestaurant1Id, name: 'The Truffle Table' },
        },
        {
          id: 'tx-2',
          restaurant_id: mockRestaurant1Id,
          transaction_type: 'redemption',
          stars: -50,
          description: 'Redeemed 50 points on checkout',
          created_at: new Date('2026-10-19T18:30:00.000Z'),
          restaurants: { id: mockRestaurant1Id, name: 'The Truffle Table' },
        },
      ];

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce(
        mockTransactions as any
      );

      const result = await getCustomerDashboardOverview(mockCustomerId);

      expect(result.recentPointsActivity).toHaveLength(2);

      // Transaction 1: Earning
      const tx1 = result.recentPointsActivity[0];
      expect(tx1.id).toBe('tx-1');
      expect(tx1.restaurantName).toBe('The Truffle Table');
      expect(tx1.transactionType).toBe('review_reward');
      expect(tx1.pointsDelta).toBe(12);
      expect(tx1.points).toBe(12);
      expect(tx1.stars).toBe(12);
      expect(tx1.action).toBe('earn');
      expect(tx1.isEarned).toBe(true);
      expect(tx1.balanceAfter).toBeNull(); // Schema doesn't store per-tx balance
      expect(tx1.createdAt).toBe('2026-10-19T19:00:00.000Z');

      // Transaction 2: Redemption
      const tx2 = result.recentPointsActivity[1];
      expect(tx2.id).toBe('tx-2');
      expect(tx2.transactionType).toBe('redemption');
      expect(tx2.pointsDelta).toBe(-50);
      expect(tx2.points).toBe(-50);
      expect(tx2.action).toBe('redeem');
      expect(tx2.isEarned).toBe(false);
      expect(tx2.balanceAfter).toBeNull();
      expect(tx2.createdAt).toBe('2026-10-19T18:30:00.000Z');
    });
  });

  // =========================================================================
  // 7. Customer Tenant Isolation
  // =========================================================================
  describe('7. Customer Isolation and Privacy Protection', () => {
    it('strictly isolates customer data and never exposes another customer details', async () => {
      vi.mocked(prisma.customers.findUnique).mockResolvedValueOnce({
        id: mockCustomerId,
        name: 'Isolate User',
        phone: '+919999900000',
      } as any);
      vi.mocked(prisma.orders.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);

      await getCustomerDashboardOverview(mockCustomerId);

      // Ensure all queries are scoped strictly to mockCustomerId and never mockOtherCustomerId
      expect(prisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: mockCustomerId },
        select: expect.any(Object),
      });

      expect(prisma.orders.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customer_id: mockCustomerId }),
        })
      );

      expect(prisma.feedback.count).toHaveBeenCalledWith({
        where: { customer_id: mockCustomerId },
      });

      expect(prisma.customer_loyalty_accounts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customer_id: mockCustomerId },
        })
      );

      expect(prisma.loyalty_transactions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customer_id: mockCustomerId },
        })
      );
    });
  });
});
