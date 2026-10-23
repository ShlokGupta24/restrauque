import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  awardOrderSpendLoyaltyReward,
  awardFeedbackLoyaltyReward,
} from '@/lib/loyalty/service';
import { PATCH as updateOwnerOrderStatusHandler } from '@/app/api/v1/owner/orders/[orderId]/status/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { NextRequest } from 'next/server';

// Mock Tenancy Guard
vi.mock('@/lib/auth/tenancy', () => ({
  requireAuthorizedRestaurant: vi.fn(),
  validateUuid: vi.fn((id: string) => id),
}));

// Mock Notifications Service
vi.mock('@/lib/notifications/service', () => ({
  createOrderCompletionNotificationIntent: vi.fn().mockResolvedValue({ id: 'mock-notif-intent' }),
  dispatchOrderCompletionNotifications: vi.fn().mockResolvedValue(undefined),
}));

// Mock Prisma Client
vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(),
    loyalty_programs: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customer_loyalty_accounts: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    loyalty_transactions: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    orders: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    order_status_history: {
      create: vi.fn(),
    },
    customers: {
      findUnique: vi.fn(),
    },
    restaurants: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 26 — Spend-Based Loyalty Points on Order Completion', () => {
  const mockOrderId = '11111111-1111-4111-8111-111111111111';
  const mockRestaurantId = '22222222-2222-4222-8222-222222222222';
  const mockCustomerId = '33333333-3333-4333-8333-333333333333';
  const mockAccountId = '44444444-4444-4444-8444-444444444444';
  const mockProgramId = '55555555-5555-4555-8555-555555555555';

  const defaultMockProgram = {
    id: mockProgramId,
    restaurant_id: mockRestaurantId,
    name: 'Dining Rewards',
    description: 'Earn points on dining spend',
    is_active: true,
    earning_mode: 'visit_and_review',
    stars_per_visit: 5,
    stars_per_review: 10,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const defaultMockAccount = {
    id: mockAccountId,
    customer_id: mockCustomerId,
    restaurant_id: mockRestaurantId,
    loyalty_program_id: mockProgramId,
    stars_balance: 50,
    lifetime_stars_earned: 100,
    lifetime_stars_redeemed: 50,
    tier: 'standard',
    status: 'active',
  };

function extractQueryText(query: any): string {
  return typeof query === 'string'
    ? query
    : Array.isArray(query)
    ? query.join(' ')
    : Array.isArray(query?.strings)
    ? query.strings.join(' ')
    : JSON.stringify(query);
}

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuthorizedRestaurant).mockResolvedValue({
      user: { id: 'owner-1', role: 'RESTAURANT_OWNER' },
      restaurant: { id: mockRestaurantId, name: 'Restraque Grill' },
    } as any);

    vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(defaultMockProgram as any);
    vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValue(defaultMockAccount as any);
    vi.mocked(prisma.loyalty_transactions.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer_loyalty_accounts.create).mockResolvedValue(defaultMockAccount as any);
    vi.mocked(prisma.customer_loyalty_accounts.update).mockResolvedValue(defaultMockAccount as any);
    vi.mocked(prisma.loyalty_transactions.create).mockResolvedValue({ id: 'tx-1' } as any);

    // Mock row lock for customer loyalty account
    (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
      const text = extractQueryText(query);

      if (text.includes('customer_loyalty_accounts')) {
        return [{ id: mockAccountId, stars_balance: 50, lifetime_stars_earned: 100 }];
      }
      if (text.includes('orders')) {
        return [
          {
            id: mockOrderId,
            restaurant_id: mockRestaurantId,
            branch_id: 'b-1',
            table_id: 't-1',
            status: 'served',
            order_number: 'ORD-101',
            completed_at: null,
            customer_id: mockCustomerId,
            subtotal: new Prisma.Decimal('149.00'),
            discount_amount: new Prisma.Decimal('0.00'),
          },
        ];
      }
      return [];
    });
  });

  // =========================================================================
  // 1. Calculation & Rounding (1 point per ₹50, floor division, fractional discarded)
  // =========================================================================
  describe('1. Spend-Point Calculation and Rounding', () => {
    it('awards exactly 2 points for ₹149 eligible spend (floor division by 50)', async () => {
      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('149.00'),
        discountAmount: new Prisma.Decimal('0.00'),
      });

      expect(result.pointsAwarded).toBe(2);
      expect(result.isRewardEarned).toBe(true);
      expect(result.newBalance).toBe(52); // 50 + 2
      expect(result.eligibleSpend).toBe(149);

      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: {
          loyalty_account_id: mockAccountId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
          order_id: mockOrderId,
          transaction_type: 'visit_reward',
          stars: 2,
          description: 'Earned 2 points for dining spend (Order #ORD-101)',
        },
      });

      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 52,
          lifetime_stars_earned: 102,
        }),
      });
    });

    it('awards 0 points and creates NO transaction when eligible spend is below ₹50', async () => {
      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-102',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('49.99'),
        discountAmount: new Prisma.Decimal('0.00'),
      });

      expect(result.pointsAwarded).toBe(0);
      expect(result.isRewardEarned).toBe(false);
      expect(result.newBalance).toBe(50);
      expect(result.eligibleSpend).toBe(49.99);

      // Rule 4: Must create no zero-value transaction and do no account balance update
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('deducts coupon discounts from subtotal before points calculation', async () => {
      // ₹200 subtotal - ₹60 coupon discount = ₹140 eligible spend -> 2 points
      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-103',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('200.00'),
        discountAmount: new Prisma.Decimal('60.00'),
      });

      expect(result.eligibleSpend).toBe(140);
      expect(result.pointsAwarded).toBe(2);
      expect(result.newBalance).toBe(52);
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stars: 2 }),
        })
      );
    });

    it('awards 0 points when coupon discount brings eligible spend below ₹50', async () => {
      // ₹100 subtotal - ₹60 coupon discount = ₹40 eligible spend -> 0 points
      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-104',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('100.00'),
        discountAmount: new Prisma.Decimal('60.00'),
      });

      expect(result.eligibleSpend).toBe(40);
      expect(result.pointsAwarded).toBe(0);
      expect(result.isRewardEarned).toBe(false);
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
    });

    it('clamps negative eligible spend to 0 when discount exceeds subtotal', async () => {
      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-105',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('50.00'),
        discountAmount: new Prisma.Decimal('80.00'),
      });

      expect(result.eligibleSpend).toBe(0);
      expect(result.pointsAwarded).toBe(0);
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Exclusion of Taxes and Tips
  // =========================================================================
  describe('2. Tax and Tip Exclusion', () => {
    it('strictly uses subtotal and excludes taxes and tips from eligible spend', async () => {
      // Order has subtotal ₹100.00, tax ₹50.00, total ₹150.00.
      // Earning must be based strictly on subtotal (100 / 50 = 2), not total (150 / 50 = 3).
      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-106',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('100.00'),
        discountAmount: new Prisma.Decimal('0.00'),
      });

      expect(result.eligibleSpend).toBe(100);
      expect(result.pointsAwarded).toBe(2);
      expect(result.pointsAwarded).not.toBe(3);
    });
  });

  // =========================================================================
  // 3. Atomicity, Idempotency & Repeat Requests
  // =========================================================================
  describe('3. Idempotency and Repeated Completion Requests', () => {
    it('returns existing reward without awarding twice if spend points were already granted', async () => {
      vi.mocked(prisma.loyalty_transactions.findFirst).mockResolvedValueOnce({
        id: 'existing-tx-id',
        order_id: mockOrderId,
        transaction_type: 'visit_reward',
        stars: 3,
        description: 'Earned 3 points for dining spend (Order #ORD-107)',
      } as any);

      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-107',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('150.00'),
        discountAmount: new Prisma.Decimal('0.00'),
      });

      expect(result.pointsAwarded).toBe(3);
      expect(result.newBalance).toBe(50);
      expect(result.description).toContain('Earned 3 points');

      // Crucial: Must NOT call create on loyalty_transactions or update on customer_loyalty_accounts
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('rejects duplicate completion requests at the route status state machine with 409', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        {
          id: mockOrderId,
          restaurant_id: mockRestaurantId,
          branch_id: 'b-1',
          table_id: 't-1',
          status: 'completed', // Already completed!
          order_number: 'ORD-101',
          completed_at: new Date(),
          customer_id: mockCustomerId,
          subtotal: new Prisma.Decimal('149.00'),
          discount_amount: new Prisma.Decimal('0.00'),
        },
      ]);

      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${mockOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('already in "completed" status');
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. End-to-End Status Transition: served -> completed
  // =========================================================================
  describe('4. Order Status Transition Integration', () => {
    it('atomically completes order and awards spend loyalty points on valid transition', async () => {
      vi.mocked(prisma.orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-101',
        restaurant_id: mockRestaurantId,
        branch_id: 'b-1',
        table_id: 't-1',
        customer_id: mockCustomerId,
        status: 'completed',
        subtotal: new Prisma.Decimal('250.00'),
        discount_amount: new Prisma.Decimal('0.00'),
        tax_amount: new Prisma.Decimal('12.50'),
        total_amount: new Prisma.Decimal('262.50'),
        completed_at: new Date(),
        customers: {
          id: mockCustomerId,
          name: 'Priya Sharma',
          phone: '9876543210',
        },
        restaurants: {
          id: mockRestaurantId,
          name: 'Restraque Grill',
        },
        restaurant_tables: { id: 't-1', table_number: 'T-1', capacity: 4 },
        branches: { id: 'b-1', name: 'Main' },
        payments: [{ id: 'p-1', status: 'paid', amount: new Prisma.Decimal('262.50'), payment_method: 'upi' }],
        _count: { order_items: 2 },
      } as any);

      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${mockOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', notes: 'Diner settled and completed' }),
      });

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('completed');

      // Order update called with status: completed
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({ status: 'completed' }),
      });

      // Loyalty transaction created with ₹250 subtotal / 50 = 5 points
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: {
          loyalty_account_id: mockAccountId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
          order_id: mockOrderId,
          transaction_type: 'visit_reward',
          stars: 5,
          description: 'Earned 5 points for dining spend (Order #ORD-101)',
        },
      });

      // Customer loyalty account incremented by 5
      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 55, // 50 + 5
          lifetime_stars_earned: 105, // 100 + 5
        }),
      });
    });
  });

  // =========================================================================
  // 5. Customer and Restaurant Scoping
  // =========================================================================
  describe('5. Multi-Tenant Restaurant and Customer Isolation', () => {
    it('scopes points strictly to the customer and restaurant of the order', async () => {
      const otherRestaurantId = '88888888-8888-4888-8888-888888888888';
      const otherCustomerId = '99999999-9999-4999-8999-999999999999';

      vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValueOnce({
        id: 'acc-other',
        customer_id: otherCustomerId,
        restaurant_id: otherRestaurantId,
        stars_balance: 10,
        lifetime_stars_earned: 10,
      } as any);

      (prisma.$queryRaw as any).mockImplementationOnce(async () => [
        { id: 'acc-other', stars_balance: 10, lifetime_stars_earned: 10 },
      ]);

      const result = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: 'order-other',
        orderNumber: 'ORD-999',
        restaurantId: otherRestaurantId,
        customerId: otherCustomerId,
        subtotal: new Prisma.Decimal('100.00'),
        discountAmount: new Prisma.Decimal('0.00'),
      });

      expect(result.pointsAwarded).toBe(2);
      expect(result.newBalance).toBe(12);

      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            restaurant_id: otherRestaurantId,
            customer_id: otherCustomerId,
          }),
        })
      );
    });
  });

  // =========================================================================
  // 6. Review Reward Independence & Non-Collision
  // =========================================================================
  describe('6. Review Reward Compatibility and Independence', () => {
    it('allows a spend-rewarded order to independently receive review points later', async () => {
      // 1. Order earns 3 spend points on completion
      const spendResult = await awardOrderSpendLoyaltyReward(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
        subtotal: new Prisma.Decimal('150.00'),
        discountAmount: new Prisma.Decimal('0.00'),
      });

      expect(spendResult.pointsAwarded).toBe(3);
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transaction_type: 'visit_reward',
            stars: 3,
          }),
        })
      );

      // 2. Customer later submits feedback for the same order
      // Review reward check searches for transaction_type: 'review_reward' (not 'visit_reward')
      vi.mocked(prisma.loyalty_transactions.findFirst).mockResolvedValueOnce(null);

      (prisma.$queryRaw as any).mockImplementationOnce(async () => [
        { id: mockAccountId, stars_balance: 53, lifetime_stars_earned: 103 },
      ]);

      const reviewResult = await awardFeedbackLoyaltyReward(prisma as any, {
        customerId: mockCustomerId,
        restaurantId: mockRestaurantId,
        orderId: mockOrderId,
        feedbackId: 'fb-101',
        itemCount: 2,
      });

      // Review reward: 10 base + 2 item bonus = 12 points
      expect(reviewResult.starsAwarded).toBe(12);
      expect(reviewResult.newBalance).toBe(65); // 53 + 12

      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transaction_type: 'review_reward',
            stars: 12,
            feedback_id: 'fb-101',
          }),
        })
      );
    });
  });

  // =========================================================================
  // 7. Atomic Transaction Rollback on Failure
  // =========================================================================
  describe('7. Transactional Integrity and Rollback', () => {
    it('aborts the entire transaction if spend loyalty calculation encounters a database error', async () => {
      // Simulate failure during row locking in transaction
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              branch_id: 'b-1',
              table_id: 't-1',
              status: 'served',
              order_number: 'ORD-101',
              completed_at: null,
              customer_id: mockCustomerId,
              subtotal: new Prisma.Decimal('149.00'),
              discount_amount: new Prisma.Decimal('0.00'),
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          throw new Error('Deadlock detected during customer loyalty row lock');
        }
        return [];
      });

      vi.mocked(prisma.orders.findUnique).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-101',
        restaurant_id: mockRestaurantId,
        branch_id: 'b-1',
        table_id: 't-1',
        customer_id: mockCustomerId,
        status: 'served',
        subtotal: new Prisma.Decimal('149.00'),
        discount_amount: new Prisma.Decimal('0.00'),
        customers: { id: mockCustomerId, name: 'Priya', phone: '9876543210' },
        restaurants: { id: mockRestaurantId, name: 'Restraque Grill' },
      } as any);

      const req = new NextRequest(`http://localhost/api/v1/owner/orders/${mockOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);

      // Verify loyalty balance was not updated
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });
  });
});
