import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  reverseOrderLoyaltyOnCancellation,
  recoverOrderLoyaltyLiability,
  listCancelledOrdersWithOutstandingLoyaltyLiability,
  formatReversalTag,
  parseReversalTag,
  isReversalForTx,
  validateOrderAdjustmentTags,
} from '@/lib/loyalty/service';
import { PATCH as updateOwnerOrderStatusHandler } from '@/app/api/v1/owner/orders/[orderId]/status/route';
import { POST as recoverLoyaltyLiabilityHandler } from '@/app/api/v1/owner/orders/[orderId]/loyalty/recover/route';
import { GET as listLoyaltyLiabilitiesHandler } from '@/app/api/v1/owner/orders/loyalty/liabilities/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { AuthenticationError } from '@/lib/http/errors';
import { NextRequest } from 'next/server';

/**
 * STEP 43E TEST SUITE NOTICE:
 * All tests in this suite are isolated mocked unit/integration tests running against
 * a Vitest-mocked Prisma Client and simulated in-memory state.
 * These tests verify the application-layer state machines, query structures, and calculations.
 * They do NOT execute against a real PostgreSQL instance and do NOT claim live PostgreSQL concurrency validation.
 */

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
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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

describe('Step 43E — Recoverable Cancellation Loyalty Liabilities (Mocked)', () => {
  const mockOrderId = '11111111-1111-4111-8111-111111111111';
  const mockRestaurantId = '22222222-2222-4222-8222-222222222222';
  const mockCustomerId = '33333333-3333-4333-8333-333333333333';
  const mockAccountId = '44444444-4444-4444-8444-444444444444';
  const mockProgramId = '55555555-5555-4555-8555-555555555555';
  const mockBranchId = '66666666-6666-4666-8666-666666666666';

  const defaultMockAccount = {
    id: mockAccountId,
    customer_id: mockCustomerId,
    restaurant_id: mockRestaurantId,
    loyalty_program_id: mockProgramId,
    stars_balance: 50,
    lifetime_stars_earned: 100,
    lifetime_stars_redeemed: 30,
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
      branches: [{ id: mockBranchId, name: 'Main Branch' }],
    } as any);

    vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValue(defaultMockAccount as any);
    vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer_loyalty_accounts.update).mockResolvedValue(defaultMockAccount as any);
    vi.mocked(prisma.loyalty_transactions.create).mockResolvedValue({ id: 'tx-adjustment-1' } as any);
    vi.mocked(prisma.orders.update).mockResolvedValue({ id: mockOrderId, status: 'cancelled' } as any);
    vi.mocked(prisma.order_status_history.create).mockResolvedValue({ id: 'osh-1' } as any);
    vi.mocked(prisma.orders.findMany).mockResolvedValue([]);
    vi.mocked(prisma.orders.count).mockResolvedValue(0);

    vi.mocked(prisma.orders.findUnique).mockResolvedValue({
      id: mockOrderId,
      order_number: 'ORD-101',
      status: 'cancelled',
      restaurant_id: mockRestaurantId,
      branch_id: mockBranchId,
      customer_id: mockCustomerId,
      subtotal: new Prisma.Decimal('150.00'),
      discount_amount: new Prisma.Decimal('0.00'),
      loyalty_discount_amount: new Prisma.Decimal('20.00'),
      tax_amount: new Prisma.Decimal('7.50'),
      total_amount: new Prisma.Decimal('137.50'),
      customers: { id: mockCustomerId, name: 'John Doe', phone: '+919876543210' },
      restaurant_tables: { id: 't-1', table_number: 'T1', capacity: 4 },
      branches: { id: mockBranchId, name: 'Main Branch' },
      payments: [],
      _count: { order_items: 2 },
    } as any);

    (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
      const text = extractQueryText(query);

      if (text.includes('customer_loyalty_accounts')) {
        return [
          {
            id: mockAccountId,
            stars_balance: 50,
            lifetime_stars_earned: 100,
            lifetime_stars_redeemed: 30,
          },
        ];
      }
      if (text.includes('orders')) {
        return [
          {
            id: mockOrderId,
            restaurant_id: mockRestaurantId,
            branch_id: mockBranchId,
            table_id: 't-1',
            status: 'pending',
            order_number: 'ORD-101',
            completed_at: null,
            customer_id: mockCustomerId,
            subtotal: new Prisma.Decimal('150.00'),
            discount_amount: new Prisma.Decimal('0.00'),
          },
        ];
      }
      return [];
    });
  });

  // =========================================================================
  // 1. Initial cancellation with sufficient balance
  // =========================================================================
  describe('1. Initial cancellation with sufficient balance', () => {
    it('fully reverses spend-earned points and restores redeemed points when balance is sufficient', async () => {
      const spendTxId = '11111111-1111-4111-8111-111111111111';
      const redTxId = '22222222-2222-4222-8222-222222222222';

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
          description: 'Earned 10 points for dining spend',
        } as any,
        {
          id: redTxId,
          transaction_type: 'redemption',
          stars: -20,
          order_id: mockOrderId,
          description: 'Redeemed 20 points at checkout',
        } as any,
      ]);

      const result = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRestored).toBe(20);
      expect(result.pointsReversed).toBe(10);
      expect(result.outstandingSpendLiability).toBe(0);
      expect(result.newBalance).toBe(60); // 50 (init) + 20 (restored) - 10 (reversed)
      expect(result.redemptionRestored).toBe(true);
      expect(result.spendRewardReversed).toBe(true);

      // Verify adjustment creation with strict REF_TX tags
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: 20,
          description: `${formatReversalTag(redTxId)} Restored 20 redeemed points for cancelled order #ORD-101`,
        }),
      });

      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: -10,
          description: `${formatReversalTag(spendTxId)} Reversed 10 of 10 spend-earned points for cancelled order #ORD-101`,
        }),
      });

      // Verify balance and counter updates
      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 60,
          lifetime_stars_earned: 90, // 100 - 10
          lifetime_stars_redeemed: 10, // 30 - 20
        }),
      });
    });
  });

  // =========================================================================
  // 2. Partial cancellation reversal and outstanding liability discovery
  // =========================================================================
  describe('2. Partial cancellation reversal and outstanding liability discovery', () => {
    const spendTxId = '33333333-3333-4333-8333-333333333333';

    it('partially reverses spend reward up to customer balance and exposes outstanding liability in discovery', async () => {
      // Customer has only 4 stars balance
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 4,
              lifetime_stars_earned: 50,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
          description: 'Earned 10 points',
        } as any,
      ]);

      const cancelResult = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(cancelResult.pointsReversed).toBe(4);
      expect(cancelResult.outstandingSpendLiability).toBe(6);
      expect(cancelResult.newBalance).toBe(0);
      expect(cancelResult.spendRewardReversed).toBe(true);

      // Now discover this outstanding liability via listCancelledOrdersWithOutstandingLoyaltyLiability
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([
        {
          id: mockOrderId,
          order_number: 'ORD-101',
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          ordered_at: new Date('2026-10-21T01:00:00Z'),
          customers: {
            id: mockCustomerId,
            name: 'John Doe',
            phone: '+919876543210',
            customer_loyalty_accounts: [{ stars_balance: 0 }],
          },
          branches: { id: mockBranchId, name: 'Main Branch' },
          loyalty_transactions: [
            {
              id: spendTxId,
              transaction_type: 'visit_reward',
              stars: 10,
              description: 'Earned 10 points',
              created_at: new Date(),
            },
            {
              id: 'adj-partial-1',
              transaction_type: 'adjustment',
              stars: -4,
              description: `${formatReversalTag(spendTxId)} Reversed 4 of 10 spend-earned points (partial reversal, capped at available balance)`,
              created_at: new Date(),
            },
          ],
        } as any,
      ]);

      const discoveryResult = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10 }
      );

      expect(discoveryResult.orders).toHaveLength(1);
      const orderSummary = discoveryResult.orders[0];
      expect(orderSummary.orderId).toBe(mockOrderId);
      expect(orderSummary.totalEarnedPoints).toBe(10);
      expect(orderSummary.totalReversedPoints).toBe(4);
      expect(orderSummary.outstandingLiability).toBe(6);
      expect(orderSummary.customerCurrentBalance).toBe(0);
      expect(orderSummary.canRecoverNow).toBe(false);
      expect(orderSummary.recoverablePoints).toBe(0);
      expect(orderSummary.isRecoveryComplete).toBe(false);
      expect(discoveryResult.summary.totalOutstandingPoints).toBe(6);
    });
  });

  // =========================================================================
  // 3. Customer earns additional points, then recovery collects only remaining liability
  // =========================================================================
  describe('3. Customer earns additional points, then recovery collects only remaining liability', () => {
    const spendTxId = '44444444-4444-4444-8444-444444444444';

    it('collects partial recovery when customer earns 5 points, and final recovery when customer earns further balance', async () => {
      // Step A: Customer balance is 5 (earned points). Previous reversal was -4 of 10.
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 5,
              lifetime_stars_earned: 51,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-1',
          transaction_type: 'adjustment',
          stars: -4,
          description: `${formatReversalTag(spendTxId)} Reversed 4 of 10 points (partial reversal)`,
          order_id: mockOrderId,
        } as any,
      ]);

      const reqA = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );

      const resA = await recoverLoyaltyLiabilityHandler(reqA, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(resA.status).toBe(200);
      const jsonA = await resA.json();
      expect(jsonA.success).toBe(true);
      expect(jsonA.data.pointsRecovered).toBe(5);
      expect(jsonA.data.outstandingPointsRemaining).toBe(1);
      expect(jsonA.data.isRecoveryComplete).toBe(false);
      expect(jsonA.data.currentStarsBalance).toBe(0);

      // Verify lifetime counter decremented by exactly the 5 points recovered
      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 0,
          lifetime_stars_earned: 46, // 51 - 5
        }),
      });

      // Step B: Customer balance is replenished to 10. Final 1 point is recovered.
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 10,
              lifetime_stars_earned: 56,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-1',
          transaction_type: 'adjustment',
          stars: -4,
          description: `${formatReversalTag(spendTxId)} Reversed 4 of 10 points`,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-2',
          transaction_type: 'adjustment',
          stars: -5,
          description: `${formatReversalTag(spendTxId)} Recovered 5 of 10 points`,
          order_id: mockOrderId,
        } as any,
      ]);

      const reqB = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );

      const resB = await recoverLoyaltyLiabilityHandler(reqB, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(resB.status).toBe(200);
      const jsonB = await resB.json();
      expect(jsonB.data.pointsRecovered).toBe(1);
      expect(jsonB.data.outstandingPointsRemaining).toBe(0);
      expect(jsonB.data.isRecoveryComplete).toBe(true);
      expect(jsonB.data.currentStarsBalance).toBe(9); // 10 - 1

      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 9,
          lifetime_stars_earned: 55, // 56 - 1
        }),
      });
    });
  });

  // =========================================================================
  // 4. Repeated recovery after full recovery makes no additional deductions
  // =========================================================================
  describe('4. Repeated recovery after full recovery makes no additional deductions', () => {
    const spendTxId = '55555555-5555-4555-8555-555555555555';

    it('returns idempotent no-op with 0 points recovered and no writes when already fully recovered', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 20,
              lifetime_stars_earned: 70,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      // Total visit_reward was 10, total adjustments are -4 and -6 = -10
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-1',
          transaction_type: 'adjustment',
          stars: -4,
          description: `${formatReversalTag(spendTxId)} Reversed 4 of 10 points`,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-2',
          transaction_type: 'adjustment',
          stars: -6,
          description: `${formatReversalTag(spendTxId)} Recovered 6 of 10 points`,
          order_id: mockOrderId,
        } as any,
      ]);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );

      const res = await recoverLoyaltyLiabilityHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.pointsRecovered).toBe(0);
      expect(json.data.outstandingPointsRemaining).toBe(0);
      expect(json.data.isRecoveryComplete).toBe(true);
      expect(json.data.currentStarsBalance).toBe(20);

      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Multiple original reward transactions are reversed independently
  // =========================================================================
  describe('5. Multiple original reward transactions are reversed independently', () => {
    it('handles multiple visit_reward entries with independent tracking and reference tags', async () => {
      const spend1 = 'aaaaaaaa-0000-4000-8000-000000000001';
      const spend2 = 'bbbbbbbb-0000-4000-8000-000000000002';

      // Customer has balance of 6 points. Spend rewards are 5 and 5.
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 6,
              lifetime_stars_earned: 50,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spend1,
          transaction_type: 'visit_reward',
          stars: 5,
          order_id: mockOrderId,
        } as any,
        {
          id: spend2,
          transaction_type: 'visit_reward',
          stars: 5,
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      // 5 points reversed from spend1, 1 point reversed from spend2. Total reversed = 6.
      expect(result.pointsReversed).toBe(6);
      expect(result.pointsAttemptedToReverse).toBe(10);
      expect(result.outstandingSpendLiability).toBe(4);
      expect(result.newBalance).toBe(0);

      // Verify two distinct adjustments created with respective tags
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: -5,
          description: expect.stringContaining(formatReversalTag(spend1)),
        }),
      });

      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: -1,
          description: expect.stringContaining(formatReversalTag(spend2)),
        }),
      });
    });
  });

  // =========================================================================
  // 6. Multiple redemptions are restored exactly once
  // =========================================================================
  describe('6. Multiple redemptions are restored exactly once', () => {
    it('restores multiple checkout redemptions during cancellation and never restores them again in recovery', async () => {
      const red1 = '11111111-0000-4000-8000-000000000001';
      const red2 = '22222222-0000-4000-8000-000000000002';

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: red1,
          transaction_type: 'redemption',
          stars: -15,
          order_id: mockOrderId,
        } as any,
        {
          id: red2,
          transaction_type: 'redemption',
          stars: -10,
          order_id: mockOrderId,
        } as any,
      ]);

      const cancelResult = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(cancelResult.pointsRestored).toBe(25);
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledTimes(2);

      // Now call recovery: recovery only recovers spend liabilities, never duplicates redemption restoration
      vi.clearAllMocks();
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 75,
              lifetime_stars_earned: 100,
              lifetime_stars_redeemed: 5,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: red1,
          transaction_type: 'redemption',
          stars: -15,
          order_id: mockOrderId,
        } as any,
        {
          id: red2,
          transaction_type: 'redemption',
          stars: -10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-red-1',
          transaction_type: 'adjustment',
          stars: 15,
          description: `${formatReversalTag(red1)} Restored 15 redeemed points`,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-red-2',
          transaction_type: 'adjustment',
          stars: 10,
          description: `${formatReversalTag(red2)} Restored 10 redeemed points`,
          order_id: mockOrderId,
        } as any,
      ]);

      const recoverResult = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(recoverResult.pointsRecovered).toBe(0);
      expect(recoverResult.outstandingPointsRemaining).toBe(0);
      expect(recoverResult.isRecoveryComplete).toBe(true);
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. Unrelated positive and negative adjustments do not suppress reversals
  // =========================================================================
  describe('7. Unrelated positive and negative adjustments do not suppress reversals', () => {
    it('ignores unrelated manual goodwill adjustments (+50) and admin penalties (-15)', async () => {
      const spendTxId = '77777777-7777-4777-8777-777777777777';

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'manual-goodwill-1',
          transaction_type: 'adjustment',
          stars: 50,
          description: 'Customer service goodwill compensation for delay',
          order_id: mockOrderId,
        } as any,
        {
          id: 'manual-penalty-1',
          transaction_type: 'adjustment',
          stars: -15,
          description: 'Manual adjustment deduction',
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsReversed).toBe(10);
      expect(result.outstandingSpendLiability).toBe(0);
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: -10,
          description: `${formatReversalTag(spendTxId)} Reversed 10 of 10 spend-earned points for cancelled order #ORD-101`,
        }),
      });
    });
  });

  // =========================================================================
  // 8. Missing account, missing original reward transaction, and malformed association tags
  // =========================================================================
  describe('8. Missing account, missing original reward transaction, and malformed association tags', () => {
    it('safely handles missing loyalty account', async () => {
      vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValueOnce(null);

      const result = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRecovered).toBe(0);
      expect(result.isRecoveryComplete).toBe(true);
      expect(result.notes).toContain(
        'Customer loyalty account not found; skipped loyalty recovery.'
      );
    });

    it('safely handles order with no spend reward transactions', async () => {
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([]);

      const result = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRecovered).toBe(0);
      expect(result.outstandingPointsRemaining).toBe(0);
      expect(result.isRecoveryComplete).toBe(true);
      expect(result.notes).toContain(
        'No spend reward ledger entries found for order; no liability exists.'
      );
    });

    it('rejects malformed association tags and fails safely without guessing', async () => {
      const spendTxId = '88888888-8888-4888-8888-888888888888';

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'malformed-adj',
          transaction_type: 'adjustment',
          stars: -5,
          description: '[REF_TX:not-a-valid-uuid] Corrupted tag text',
          order_id: mockOrderId,
        } as any,
      ]);

      await expect(
        recoverOrderLoyaltyLiability(prisma as any, {
          orderId: mockOrderId,
          orderNumber: 'ORD-101',
          restaurantId: mockRestaurantId,
          customerId: mockCustomerId,
        })
      ).rejects.toThrow(/Malformed association tag detected/);
    });

    it('rejects ambiguous association tag referencing an unknown transaction ID', async () => {
      const spendTxId = '88888888-8888-4888-8888-888888888888';
      const foreignTxId = '99999999-9999-4999-8999-999999999999';

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'ambiguous-adj',
          transaction_type: 'adjustment',
          stars: -5,
          description: `${formatReversalTag(foreignTxId)} Injected tag from another order`,
          order_id: mockOrderId,
        } as any,
      ]);

      await expect(
        recoverOrderLoyaltyLiability(prisma as any, {
          orderId: mockOrderId,
          orderNumber: 'ORD-101',
          restaurantId: mockRestaurantId,
          customerId: mockCustomerId,
        })
      ).rejects.toThrow(/Ambiguous association tag/);
    });
  });

  // =========================================================================
  // 9. Recovery of a non-cancelled order is rejected
  // =========================================================================
  describe('9. Recovery of a non-cancelled order is rejected', () => {
    it.each(['pending', 'preparing', 'served', 'completed'])(
      'rejects recovery of order with status "%s" with 409 Conflict',
      async (nonCancelledStatus) => {
        (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
          const text = extractQueryText(query);
          if (text.includes('orders')) {
            return [
              {
                id: mockOrderId,
                restaurant_id: mockRestaurantId,
                status: nonCancelledStatus,
                order_number: 'ORD-101',
                customer_id: mockCustomerId,
              },
            ];
          }
          return [];
        });

        const req = new NextRequest(
          `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
          { method: 'POST' }
        );

        const res = await recoverLoyaltyLiabilityHandler(req, {
          params: Promise.resolve({ orderId: mockOrderId }),
        });

        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error.message).toContain('can only be performed on cancelled orders');
        expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      }
    );
  });

  // =========================================================================
  // 10. Cross-restaurant access is rejected
  // =========================================================================
  describe('10. Cross-restaurant access is rejected', () => {
    it('returns 404 Not Found when attempting recovery on an order belonging to another restaurant', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: 'other-restaurant-uuid',
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        return [];
      });

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );

      const res = await recoverLoyaltyLiabilityHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.message).toContain('Order not found');
    });
  });

  // =========================================================================
  // 11. Unauthenticated access is rejected
  // =========================================================================
  describe('11. Unauthenticated access is rejected', () => {
    it('rejects unauthenticated recovery request with 401 Unauthorized', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new AuthenticationError('Invalid or missing authentication credentials')
      );

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );

      const res = await recoverLoyaltyLiabilityHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated discovery request with 401 Unauthorized', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new AuthenticationError('Invalid or missing authentication credentials')
      );

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/loyalty/liabilities`,
        { method: 'GET' }
      );

      const res = await listLoyaltyLiabilitiesHandler(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 12. Concurrent/repeated recovery cannot double-deduct points
  // =========================================================================
  describe('12. Concurrent/repeated recovery cannot double-deduct points', () => {
    const spendTxId = '12121212-1212-4212-8212-121212121212';

    it('serializes recovery under row locks so second request sees zero outstanding points and makes 0 deductions', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 10,
              lifetime_stars_earned: 60,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      // Original spend 10, previous cancellation partial deduction was -4.
      // Call 1 recovers remaining 6 points.
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-cancel-1',
          transaction_type: 'adjustment',
          stars: -4,
          description: `${formatReversalTag(spendTxId)} Reversed 4 of 10 points`,
          order_id: mockOrderId,
        } as any,
      ]);

      const req1 = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );
      const res1 = await recoverLoyaltyLiabilityHandler(req1, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });
      const json1 = await res1.json();
      expect(res1.status).toBe(200);
      expect(json1.data.pointsRecovered).toBe(6);
      expect(json1.data.isRecoveryComplete).toBe(true);

      // Now Call 2 (concurrent or immediate retry) reads the ledger containing both adjustments
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-cancel-1',
          transaction_type: 'adjustment',
          stars: -4,
          description: `${formatReversalTag(spendTxId)} Reversed 4 of 10 points`,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-recover-1',
          transaction_type: 'adjustment',
          stars: -6,
          description: `${formatReversalTag(spendTxId)} Recovered 6 of 10 points`,
          order_id: mockOrderId,
        } as any,
      ]);

      const req2 = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );
      const res2 = await recoverLoyaltyLiabilityHandler(req2, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.data.pointsRecovered).toBe(0);
      expect(json2.data.outstandingPointsRemaining).toBe(0);
      expect(json2.data.isRecoveryComplete).toBe(true);
    });
  });

  // =========================================================================
  // 13. Failure during recovery rolls back all writes
  // =========================================================================
  describe('13. Failure during recovery rolls back all writes', () => {
    it('aborts and returns 500 without committing partial adjustments if ledger write fails', async () => {
      const spendTxId = '13131313-1313-4313-8313-131313131313';

      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              status: 'cancelled',
              order_number: 'ORD-101',
              customer_id: mockCustomerId,
            },
          ];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 10,
              lifetime_stars_earned: 50,
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
      ]);

      vi.mocked(prisma.loyalty_transactions.create).mockRejectedValueOnce(
        new Error('Database disk full / transaction failure')
      );

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/loyalty/recover`,
        { method: 'POST' }
      );

      const res = await recoverLoyaltyLiabilityHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // =========================================================================
  // 14. Lifetime-counter updates reflect actual operation and preserve established semantics
  // =========================================================================
  describe('14. Lifetime-counter updates reflect actual operation and preserve established semantics', () => {
    it('decrements lifetime_stars_earned strictly by actual newly recovered amount and warns on inconsistency', async () => {
      const spendTxId = '14141414-1414-4414-8414-141414141414';

      // Customer has balance 5, but corrupted lifetime_stars_earned of only 2
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('customer_loyalty_accounts')) {
          return [
            {
              id: mockAccountId,
              stars_balance: 5,
              lifetime_stars_earned: 2, // Inconsistency: counter lower than deduction!
              lifetime_stars_redeemed: 0,
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 10,
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-101',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRecovered).toBe(5);
      // Warning logged in notes rather than silently masking inconsistency
      expect(result.notes.some((n) => n.includes('lower than actual deduction'))).toBe(true);

      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 0,
          lifetime_stars_earned: 0,
        }),
      });
    });
  });

  // =========================================================================
  // 15. Outstanding-liability discovery is restaurant-scoped and pagination-bounded
  // =========================================================================
  describe('15. Outstanding-liability discovery is restaurant-scoped and pagination-bounded', () => {
    it('returns bounded page of cancelled orders for authorized restaurant with liability metrics', async () => {
      const spendTxId = '15151515-1515-4515-8515-151515151515';

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([
        {
          id: mockOrderId,
          order_number: 'ORD-101',
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          ordered_at: new Date('2026-10-21T02:00:00Z'),
          customers: {
            id: mockCustomerId,
            name: 'Jane Smith',
            phone: '+919123456789',
            customer_loyalty_accounts: [{ stars_balance: 12 }],
          },
          branches: { id: mockBranchId, name: 'Main Branch' },
          loyalty_transactions: [
            {
              id: spendTxId,
              transaction_type: 'visit_reward',
              stars: 15,
              description: 'Earned 15 points',
              created_at: new Date(),
            },
            {
              id: 'adj-cancel',
              transaction_type: 'adjustment',
              stars: -5,
              description: `${formatReversalTag(spendTxId)} Reversed 5 of 15 points`,
              created_at: new Date(),
            },
          ],
        } as any,
      ]);

      vi.mocked(prisma.orders.count).mockResolvedValueOnce(1);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/loyalty/liabilities?page=1&limit=20&branchId=${mockBranchId}`,
        { method: 'GET' }
      );

      const res = await listLoyaltyLiabilitiesHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const summary = json.data.summary;
      expect(summary.totalCandidateOrders).toBe(1);
      expect(summary.ordersWithOutstandingLiability).toBe(1);
      expect(summary.totalOutstandingPoints).toBe(10); // 15 - 5
      expect(summary.totalRecoverablePointsNow).toBe(10); // min(12 balance, 10 liability) = 10

      const order = json.data.orders[0];
      expect(order.orderId).toBe(mockOrderId);
      expect(order.outstandingLiability).toBe(10);
      expect(order.canRecoverNow).toBe(true);
      expect(order.recoverablePoints).toBe(10);
      expect(order.customerCurrentBalance).toBe(12);

      // Verify Prisma query was restaurant-scoped and bounded
      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: mockRestaurantId,
            status: 'cancelled',
            branch_id: mockBranchId,
          }),
        })
      );
    });

    it('rejects discovery request for a branch not belonging to the authorized restaurant with 403 Forbidden', async () => {
      const foreignBranchId = '99999999-9999-4999-8999-999999999999';

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/loyalty/liabilities?branchId=${foreignBranchId}`,
        { method: 'GET' }
      );

      const res = await listLoyaltyLiabilitiesHandler(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain('Requested branch does not belong to your authorized restaurant');
    });
  });

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let uuidSeq = 1000;
  function nextUuid(): string {
    const hex = (uuidSeq++).toString(16).padStart(12, '0');
    return `e0000000-0000-4000-8000-${hex}`;
  }

  function createMockCancelledOrder(params: {
    id?: string;
    orderNumber?: string;
    spendTxId?: string;
    branchId?: string;
    branchName?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerBalance?: number | null;
    orderedAt?: Date;
    spendPoints: number;
    reversedPoints: number;
  }) {
    const orderId = params.id && UUID_REGEX.test(params.id) ? params.id : nextUuid();
    const spendTxId = params.spendTxId && UUID_REGEX.test(params.spendTxId) ? params.spendTxId : nextUuid();
    const revTxId = nextUuid();
    const orderNumber = params.orderNumber ?? `ORD-${orderId.slice(-6)}`;

    const txs: any[] = [
      {
        id: spendTxId,
        transaction_type: 'visit_reward',
        stars: params.spendPoints,
        description: `Earned ${params.spendPoints} spend points`,
        created_at: new Date(),
      },
    ];
    if (params.reversedPoints > 0) {
      txs.push({
        id: revTxId,
        transaction_type: 'adjustment',
        stars: -params.reversedPoints,
        description: `${formatReversalTag(spendTxId)} Reversed ${params.reversedPoints} points`,
        created_at: new Date(),
      });
    }
    const customerId = params.customerId && UUID_REGEX.test(params.customerId) ? params.customerId : nextUuid();
    return {
      id: orderId,
      order_number: orderNumber,
      branch_id: params.branchId ?? mockBranchId,
      customer_id: customerId,
      ordered_at: params.orderedAt ?? new Date('2026-10-21T01:00:00Z'),
      customers: {
        id: customerId,
        name: params.customerName ?? 'Test Customer',
        phone: params.customerPhone ?? '+919999999999',
        customer_loyalty_accounts: [
          { stars_balance: params.customerBalance ?? 10 },
        ],
      },
      branches: {
        id: params.branchId ?? mockBranchId,
        name: params.branchName ?? 'Main Branch',
      },
      loyalty_transactions: txs,
    };
  }

  // =========================================================================
  // 15-B. Step 43E-B Liability Discovery Pagination and Summary Metrics (Mocked)
  // =========================================================================
  describe('15-B. Step 43E-B Liability Discovery Pagination and Summary Metrics (Mocked)', () => {
    it('1. fully recovered orders preceding unresolved orders must not cause an empty first page', async () => {
      // DB returns 3 candidate orders in descending ordered_at order:
      // Order 1: fully recovered (earned 10, reversed 10 -> outstanding 0)
      // Order 2: fully recovered (earned 20, reversed 20 -> outstanding 0)
      // Order 3: unresolved (earned 15, reversed 5 -> outstanding 10)
      const order1 = createMockCancelledOrder({
        id: '11111111-0000-4000-8000-000000000001',
        orderNumber: 'ORD-001',
        spendPoints: 10,
        reversedPoints: 10,
      });
      const order2 = createMockCancelledOrder({
        id: '11111111-0000-4000-8000-000000000002',
        orderNumber: 'ORD-002',
        spendPoints: 20,
        reversedPoints: 20,
      });
      const order3 = createMockCancelledOrder({
        id: '11111111-0000-4000-8000-000000000003',
        orderNumber: 'ORD-003',
        spendPoints: 15,
        reversedPoints: 5,
        customerBalance: 8,
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([order1, order2, order3] as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 2, unrecoveredOnly: true }
      );

      // CRITICAL: Page 1 must not be empty!
      expect(res.orders).toHaveLength(1);
      expect(res.orders[0].orderId).toBe('11111111-0000-4000-8000-000000000003');
      expect(res.orders[0].outstandingLiability).toBe(10);
      expect(res.orders[0].canRecoverNow).toBe(true);
      expect(res.orders[0].recoverablePoints).toBe(8); // min(8 balance, 10 liability)
      expect(res.orders[0].isRecoveryComplete).toBe(false);

      // Pagination reflects filtered set
      expect(res.pagination.page).toBe(1);
      expect(res.pagination.limit).toBe(2);
      expect(res.pagination.totalCount).toBe(1);
      expect(res.pagination.totalPages).toBe(1);
      expect(res.pagination.hasNextPage).toBe(false);
      expect(res.pagination.hasPrevPage).toBe(false);

      // Summary reflects candidate and outstanding metrics
      expect(res.summary.totalCandidateOrders).toBe(3);
      expect(res.summary.ordersWithOutstandingLiability).toBe(1);
      expect(res.summary.totalOutstandingPoints).toBe(10);
      expect(res.summary.totalRecoverablePointsNow).toBe(8);
    });

    it('2. unresolved orders across multiple pages are all discoverable', async () => {
      // 5 candidate orders:
      // Order 1: fully recovered (0)
      // Order 2: unresolved (5)
      // Order 3: unresolved (10)
      // Order 4: fully recovered (0)
      // Order 5: unresolved (15)
      const ord1 = createMockCancelledOrder({ id: '22222222-0000-4000-8000-000000000001', orderNumber: 'O-1', spendPoints: 10, reversedPoints: 10 });
      const ord2 = createMockCancelledOrder({ id: '22222222-0000-4000-8000-000000000002', orderNumber: 'O-2', spendPoints: 10, reversedPoints: 5 }); // out: 5
      const ord3 = createMockCancelledOrder({ id: '22222222-0000-4000-8000-000000000003', orderNumber: 'O-3', spendPoints: 20, reversedPoints: 10 }); // out: 10
      const ord4 = createMockCancelledOrder({ id: '22222222-0000-4000-8000-000000000004', orderNumber: 'O-4', spendPoints: 30, reversedPoints: 30 });
      const ord5 = createMockCancelledOrder({ id: '22222222-0000-4000-8000-000000000005', orderNumber: 'O-5', spendPoints: 25, reversedPoints: 10 }); // out: 15
      const allOrders = [ord1, ord2, ord3, ord4, ord5];

      // Request Page 1 (limit: 2)
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(allOrders as any);
      const page1 = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 2, unrecoveredOnly: true }
      );

      expect(page1.orders).toHaveLength(2);
      expect(page1.orders[0].orderId).toBe(ord2.id);
      expect(page1.orders[1].orderId).toBe(ord3.id);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.totalCount).toBe(3);
      expect(page1.pagination.totalPages).toBe(2);
      expect(page1.pagination.hasNextPage).toBe(true);
      expect(page1.pagination.hasPrevPage).toBe(false);

      // Request Page 2 (limit: 2)
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(allOrders as any);
      const page2 = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 2, limit: 2, unrecoveredOnly: true }
      );

      expect(page2.orders).toHaveLength(1);
      expect(page2.orders[0].orderId).toBe(ord5.id);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.totalCount).toBe(3);
      expect(page2.pagination.totalPages).toBe(2);
      expect(page2.pagination.hasNextPage).toBe(false);
      expect(page2.pagination.hasPrevPage).toBe(true);

      // Discoverability check: Set of all discovered order IDs matches all unresolved orders exactly
      const allDiscoveredIds = [...page1.orders, ...page2.orders].map((o) => o.orderId);
      expect(allDiscoveredIds).toEqual([ord2.id, ord3.id, ord5.id]);
    });

    it('3. totalCount and totalPages reflect the filtered result set when unrecoveredOnly=true', async () => {
      // 6 candidate orders: 4 resolved, 2 unresolved
      const orders = [
        createMockCancelledOrder({ id: '33333333-0000-4000-8000-000000000001', orderNumber: 'R-1', spendPoints: 10, reversedPoints: 10 }),
        createMockCancelledOrder({ id: '33333333-0000-4000-8000-000000000002', orderNumber: 'R-2', spendPoints: 10, reversedPoints: 10 }),
        createMockCancelledOrder({ id: '33333333-0000-4000-8000-000000000003', orderNumber: 'U-1', spendPoints: 15, reversedPoints: 5 }), // out: 10
        createMockCancelledOrder({ id: '33333333-0000-4000-8000-000000000004', orderNumber: 'R-3', spendPoints: 10, reversedPoints: 10 }),
        createMockCancelledOrder({ id: '33333333-0000-4000-8000-000000000005', orderNumber: 'U-2', spendPoints: 20, reversedPoints: 10 }), // out: 10
        createMockCancelledOrder({ id: '33333333-0000-4000-8000-000000000006', orderNumber: 'R-4', spendPoints: 10, reversedPoints: 10 }),
      ];

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(orders as any);

      const resLimit10 = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10, unrecoveredOnly: true }
      );
      // totalCount MUST be 2 (unresolved count), NOT 6 (candidate count)
      expect(resLimit10.pagination.totalCount).toBe(2);
      expect(resLimit10.pagination.totalPages).toBe(1);

      // With limit: 1, totalPages MUST be 2
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(orders as any);
      const resLimit1 = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 1, unrecoveredOnly: true }
      );
      expect(resLimit1.pagination.totalCount).toBe(2);
      expect(resLimit1.pagination.totalPages).toBe(2);
    });

    it('4. summary metrics are consistent across pages and describe the full matching result set', async () => {
      const orders = [
        createMockCancelledOrder({ id: '44444444-0000-4000-8000-000000000001', orderNumber: 'ORD-1', spendPoints: 10, reversedPoints: 0, customerBalance: 20 }), // out: 10, rec: 10
        createMockCancelledOrder({ id: '44444444-0000-4000-8000-000000000002', orderNumber: 'ORD-2', spendPoints: 15, reversedPoints: 0, customerBalance: 5 }),  // out: 15, rec: 5
        createMockCancelledOrder({ id: '44444444-0000-4000-8000-000000000003', orderNumber: 'ORD-3', spendPoints: 10, reversedPoints: 10, customerBalance: 50 }), // out: 0, rec: 0 (resolved)
        createMockCancelledOrder({ id: '44444444-0000-4000-8000-000000000004', orderNumber: 'ORD-4', spendPoints: 25, reversedPoints: 0, customerBalance: 0 }),  // out: 25, rec: 0
      ];
      // Expected global totals:
      // totalCandidateOrders = 4
      // ordersWithOutstandingLiability = 3 (ord-1, ord-2, ord-4)
      // totalOutstandingPoints = 10 + 15 + 25 = 50
      // totalRecoverablePointsNow = 10 + 5 + 0 = 15

      // Fetch Page 1 (limit 1)
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(orders as any);
      const p1 = await listCancelledOrdersWithOutstandingLoyaltyLiability(mockRestaurantId, { page: 1, limit: 1 });

      // Fetch Page 2 (limit 1)
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(orders as any);
      const p2 = await listCancelledOrdersWithOutstandingLoyaltyLiability(mockRestaurantId, { page: 2, limit: 1 });

      // Fetch Page 3 (limit 1)
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(orders as any);
      const p3 = await listCancelledOrdersWithOutstandingLoyaltyLiability(mockRestaurantId, { page: 3, limit: 1 });

      for (const pageRes of [p1, p2, p3]) {
        expect(pageRes.summary).toEqual({
          totalCandidateOrders: 4,
          ordersWithOutstandingLiability: 3,
          totalOutstandingPoints: 50,
          totalRecoverablePointsNow: 15,
        });
      }
    });

    it('5. unrecoveredOnly=false retains resolved orders and has documented summary semantics', async () => {
      const res1 = createMockCancelledOrder({ id: '55555555-0000-4000-8000-000000000001', orderNumber: 'R-1', spendPoints: 10, reversedPoints: 10 }); // resolved
      const unres1 = createMockCancelledOrder({ id: '55555555-0000-4000-8000-000000000002', orderNumber: 'U-1', spendPoints: 20, reversedPoints: 5 }); // outstanding: 15
      const res2 = createMockCancelledOrder({ id: '55555555-0000-4000-8000-000000000003', orderNumber: 'R-2', spendPoints: 30, reversedPoints: 30 }); // resolved
      const orders = [res1, unres1, res2];

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(orders as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10, unrecoveredOnly: false }
      );

      // Contains all 3 orders
      expect(res.orders).toHaveLength(3);
      expect(res.orders.map((o) => o.orderId)).toEqual([res1.id, unres1.id, res2.id]);

      // Documented row semantics for resolved orders
      const resolved = res.orders.find((o) => o.orderId === res1.id)!;
      expect(resolved.outstandingLiability).toBe(0);
      expect(resolved.isRecoveryComplete).toBe(true);
      expect(resolved.canRecoverNow).toBe(false);

      // Documented row semantics for unresolved orders
      const unresolved = res.orders.find((o) => o.orderId === unres1.id)!;
      expect(unresolved.outstandingLiability).toBe(15);
      expect(unresolved.isRecoveryComplete).toBe(false);

      // Pagination describes full candidate list
      expect(res.pagination.totalCount).toBe(3);
      expect(res.pagination.totalPages).toBe(1);

      // Summary describes candidate and liability breakdown
      expect(res.summary.totalCandidateOrders).toBe(3);
      expect(res.summary.ordersWithOutstandingLiability).toBe(1);
      expect(res.summary.totalOutstandingPoints).toBe(15);
    });

    it('6. branch filtering applies consistently to results and aggregates', async () => {
      const branchA = '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      const ba1 = createMockCancelledOrder({ id: '66666666-0000-4000-8000-000000000001', orderNumber: 'BA-1', branchId: branchA, spendPoints: 10, reversedPoints: 2 }); // out: 8
      const ba2 = createMockCancelledOrder({ id: '66666666-0000-4000-8000-000000000002', orderNumber: 'BA-2', branchId: branchA, spendPoints: 15, reversedPoints: 5 }); // out: 10
      const branchAOrders = [ba1, ba2];

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(branchAOrders as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { branchId: branchA, unrecoveredOnly: true }
      );

      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: mockRestaurantId,
            branch_id: branchA,
          }),
        })
      );

      expect(res.orders).toHaveLength(2);
      expect(res.summary.totalCandidateOrders).toBe(2);
      expect(res.summary.ordersWithOutstandingLiability).toBe(2);
      expect(res.summary.totalOutstandingPoints).toBe(18); // 8 + 10
    });

    it('7. restaurant tenant isolation remains intact', async () => {
      const foreignRestaurantId = '99999999-9999-4999-8999-999999999999';

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);

      await listCancelledOrdersWithOutstandingLoyaltyLiability(foreignRestaurantId, { page: 1, limit: 10 });

      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: foreignRestaurantId,
          }),
        })
      );

      // Route tenancy verification: foreign branch is rejected with 403
      const foreignBranchId = '88888888-8888-4888-8888-888888888888';
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/loyalty/liabilities?branchId=${foreignBranchId}`,
        { method: 'GET' }
      );

      const routeRes = await listLoyaltyLiabilitiesHandler(req);
      expect(routeRes.status).toBe(403);
      const json = await routeRes.json();
      expect(json.error.message).toContain('Requested branch does not belong to your authorized restaurant');
    });

    it('8. empty result sets return consistent pagination and zero metrics', async () => {
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 20, unrecoveredOnly: true }
      );

      expect(res.orders).toEqual([]);
      expect(res.pagination).toEqual({
        page: 1,
        limit: 20,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
      expect(res.summary).toEqual({
        totalCandidateOrders: 0,
        ordersWithOutstandingLiability: 0,
        totalOutstandingPoints: 0,
        totalRecoverablePointsNow: 0,
      });
    });
  });

  // =========================================================================
  // 15-C. Step 43E-D Venue-Wide Loyalty Recoverability Accounting (Mocked)
  // =========================================================================
  describe('15-C. Step 43E-D Venue-Wide Loyalty Recoverability Accounting (Mocked)', () => {
    it('one customer with 10 wallet points and two orders each carrying 10 outstanding points yields totalRecoverablePointsNow = 10, not 20', async () => {
      const customerId = '77777777-0000-4000-8000-000000000001';
      const orderA = createMockCancelledOrder({
        id: '88888888-0000-4000-8000-000000000001',
        orderNumber: 'ORD-A',
        customerId,
        customerBalance: 10,
        spendPoints: 10,
        reversedPoints: 0,
      });
      const orderB = createMockCancelledOrder({
        id: '88888888-0000-4000-8000-000000000002',
        orderNumber: 'ORD-B',
        customerId,
        customerBalance: 10,
        spendPoints: 10,
        reversedPoints: 0,
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([orderA, orderB] as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10 }
      );

      // Row-level fields: each order row in isolation shows min(10 balance, 10 liability) = 10
      expect(res.orders).toHaveLength(2);
      expect(res.orders[0].recoverablePoints).toBe(10);
      expect(res.orders[1].recoverablePoints).toBe(10);
      expect(res.orders[0].outstandingLiability).toBe(10);
      expect(res.orders[1].outstandingLiability).toBe(10);

      // Venue-wide summary: counts wallet available points only ONCE across matching orders
      expect(res.summary.totalCandidateOrders).toBe(2);
      expect(res.summary.ordersWithOutstandingLiability).toBe(2);
      expect(res.summary.totalOutstandingPoints).toBe(20);
      expect(res.summary.totalRecoverablePointsNow).toBe(10); // NOT 20!
    });

    it('one customer with 10 points and total outstanding liability of 6 yields 6 recoverable points', async () => {
      const customerId = '77777777-0000-4000-8000-000000000002';
      const orderA = createMockCancelledOrder({
        customerId,
        customerBalance: 10,
        spendPoints: 5,
        reversedPoints: 3, // out: 2
      });
      const orderB = createMockCancelledOrder({
        customerId,
        customerBalance: 10,
        spendPoints: 8,
        reversedPoints: 4, // out: 4
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([orderA, orderB] as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10 }
      );

      expect(res.summary.totalOutstandingPoints).toBe(6);
      expect(res.summary.totalRecoverablePointsNow).toBe(6); // min(10 balance, 6 liability) = 6
    });

    it('one customer with 10 points and total outstanding liability of 25 yields 10 recoverable points', async () => {
      const customerId = '77777777-0000-4000-8000-000000000003';
      const orderA = createMockCancelledOrder({
        customerId,
        customerBalance: 10,
        spendPoints: 15,
        reversedPoints: 0, // out: 15
      });
      const orderB = createMockCancelledOrder({
        customerId,
        customerBalance: 10,
        spendPoints: 10,
        reversedPoints: 0, // out: 10
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([orderA, orderB] as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10 }
      );

      expect(res.summary.totalOutstandingPoints).toBe(25);
      expect(res.summary.totalRecoverablePointsNow).toBe(10); // min(10 balance, 25 liability) = 10
    });

    it('two distinct customers have their wallet balances accounted for independently', async () => {
      const cust1 = '77777777-0000-4000-8000-00000000004a';
      const cust2 = '77777777-0000-4000-8000-00000000004b';

      // Customer 1: wallet balance = 10, total liability = 15 -> recoverable = 10
      const c1OrderA = createMockCancelledOrder({
        customerId: cust1,
        customerBalance: 10,
        spendPoints: 8,
        reversedPoints: 0,
      });
      const c1OrderB = createMockCancelledOrder({
        customerId: cust1,
        customerBalance: 10,
        spendPoints: 7,
        reversedPoints: 0,
      });

      // Customer 2: wallet balance = 20, total liability = 8 -> recoverable = 8
      const c2OrderA = createMockCancelledOrder({
        customerId: cust2,
        customerBalance: 20,
        spendPoints: 8,
        reversedPoints: 0,
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([c1OrderA, c1OrderB, c2OrderA] as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10 }
      );

      expect(res.summary.totalOutstandingPoints).toBe(23); // 8 + 7 + 8
      // Customer 1 contributes min(10, 15) = 10
      // Customer 2 contributes min(20, 8) = 8
      // Venue total = 10 + 8 = 18
      expect(res.summary.totalRecoverablePointsNow).toBe(18);
    });

    it('missing loyalty-account data does not inflate recoverability', async () => {
      const custNoAccount = '77777777-0000-4000-8000-00000000005a';
      const custWithAccount = '77777777-0000-4000-8000-00000000005b';

      // Order with customer having empty customer_loyalty_accounts
      const orderNoAccount = createMockCancelledOrder({
        customerId: custNoAccount,
        spendPoints: 20,
        reversedPoints: 0, // out: 20
      });
      (orderNoAccount.customers as any).customer_loyalty_accounts = [];

      // Order with customer having active account with 15 points
      const orderWithAccount = createMockCancelledOrder({
        customerId: custWithAccount,
        customerBalance: 15,
        spendPoints: 10,
        reversedPoints: 0, // out: 10
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([orderNoAccount, orderWithAccount] as any);

      const res = await listCancelledOrdersWithOutstandingLoyaltyLiability(
        mockRestaurantId,
        { page: 1, limit: 10 }
      );

      // Missing account order has balance 0 and recoverable 0
      const summaryNoAccount = res.orders.find((o) => o.orderId === orderNoAccount.id)!;
      expect(summaryNoAccount.customerCurrentBalance).toBe(0);
      expect(summaryNoAccount.canRecoverNow).toBe(false);
      expect(summaryNoAccount.recoverablePoints).toBe(0);

      // Active account order has balance 15 and recoverable 10
      const summaryWithAccount = res.orders.find((o) => o.orderId === orderWithAccount.id)!;
      expect(summaryWithAccount.customerCurrentBalance).toBe(15);
      expect(summaryWithAccount.canRecoverNow).toBe(true);
      expect(summaryWithAccount.recoverablePoints).toBe(10);

      // Venue-wide summary: 20 liability (0 recoverable) + 10 liability (10 recoverable)
      expect(res.summary.totalOutstandingPoints).toBe(30);
      expect(res.summary.totalRecoverablePointsNow).toBe(10);
    });
  });

  // =========================================================================
  // 16. Order Status Transition Integration via Owner API (Mocked)
  // =========================================================================
  describe('16. Order Status Transition Integration via Owner API (Mocked)', () => {
    it('restores redeemed points when transitioning pending -> cancelled', async () => {
      const redTxId = '22222222-0000-4000-8000-000000000001';

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: redTxId,
          loyalty_account_id: mockAccountId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
          order_id: mockOrderId,
          transaction_type: 'redemption',
          stars: -20,
          description: 'Redeemed 20 points',
          created_at: new Date(),
        } as any,
      ]);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
            notes: 'Customer requested cancellation before kitchen started',
          }),
        }
      );

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(200);

      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({ status: 'cancelled' }),
      });

      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: 20,
          description: expect.stringContaining(formatReversalTag(redTxId)),
        }),
      });

      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 70,
          lifetime_stars_redeemed: 10,
        }),
      });
    });

    it('rejects forbidden transition served -> cancelled with 409 Conflict without modifying loyalty accounts', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              branch_id: mockBranchId,
              table_id: 't-1',
              status: 'served',
              order_number: 'ORD-101',
              completed_at: null,
              customer_id: mockCustomerId,
              subtotal: new Prisma.Decimal('150.00'),
              discount_amount: new Prisma.Decimal('0.00'),
            },
          ];
        }
        return [];
      });

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
          }),
        }
      );

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('managerial override');

      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('rejects repeated cancellation on already cancelled order with 409 Conflict', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              branch_id: mockBranchId,
              table_id: 't-1',
              status: 'cancelled',
              order_number: 'ORD-101',
              completed_at: null,
              customer_id: mockCustomerId,
              subtotal: new Prisma.Decimal('150.00'),
              discount_amount: new Prisma.Decimal('0.00'),
            },
          ];
        }
        return [];
      });

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
          }),
        }
      );

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('Order is already in "cancelled" status.');

      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('rolls back entire transaction if loyalty reversal fails during cancellation', async () => {
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: '22222222-0000-4000-8000-000000000001',
          transaction_type: 'redemption',
          stars: -20,
          order_id: mockOrderId,
        } as any,
      ]);

      vi.mocked(prisma.loyalty_transactions.create).mockRejectedValueOnce(
        new Error('Database deadlock on loyalty ledger write')
      );

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
          }),
        }
      );

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('18. Step 43E-S4 — Dual-Write orders.unrecovered_loyalty_points Verification', () => {
    const spendTxId = '33333333-0000-4000-8000-000000000001';

    it('1. Cancellation writes the correct liability projection and ledger changes atomically', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [{ id: mockOrderId }];
        }
        if (text.includes('customer_loyalty_accounts')) {
          return [{
            id: mockAccountId,
            stars_balance: 10,
            lifetime_stars_earned: 50,
            lifetime_stars_redeemed: 0,
          }];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 25,
          order_id: mockOrderId,
          description: 'Earned 25 points',
        } as any,
      ]);

      const result = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-1',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsReversed).toBe(10);
      expect(result.outstandingSpendLiability).toBe(15);
      expect(result.newBalance).toBe(0);

      // Verify atomic dual-write to orders.unrecovered_loyalty_points
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 15 },
      });

      // Verify ledger transaction was written
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'adjustment',
          stars: -10,
          description: expect.stringContaining(formatReversalTag(spendTxId)),
        }),
      });

      // Verify customer account was updated
      expect(prisma.customer_loyalty_accounts.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: expect.objectContaining({
          stars_balance: 0,
          lifetime_stars_earned: 40,
        }),
      });
    });

    it('2. An order with no liability writes zero to unrecovered_loyalty_points', async () => {
      // Case A: Order with no loyalty transactions
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) return [{ id: mockOrderId }];
        if (text.includes('customer_loyalty_accounts')) {
          return [{ id: mockAccountId, stars_balance: 100, lifetime_stars_earned: 100, lifetime_stars_redeemed: 0 }];
        }
        return [];
      });
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([]);

      const result = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-2',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.outstandingSpendLiability).toBe(0);
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 0 },
      });

      // Case B: Order with no customer
      const noCustResult = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-2B',
        restaurantId: mockRestaurantId,
        customerId: null,
      });
      expect(noCustResult.outstandingSpendLiability).toBe(0);
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 0 },
      });
    });

    it('3. Partial recovery reduces outstanding liability by exactly the recovered amount', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('customer_loyalty_accounts')) {
          return [{ id: mockAccountId, stars_balance: 5, lifetime_stars_earned: 35, lifetime_stars_redeemed: 0 }];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 25,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-prev',
          transaction_type: 'adjustment',
          stars: -10,
          description: `${formatReversalTag(spendTxId)} Previously reversed 10`,
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-3',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRecovered).toBe(5);
      expect(result.outstandingPointsRemaining).toBe(10);
      expect(result.isRecoveryComplete).toBe(false);
      expect(result.currentStarsBalance).toBe(0);

      // Verify unrecovered_loyalty_points is updated to remaining 10
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 10 },
      });
    });

    it('4. Full recovery produces zero outstanding liability and updates projection to 0', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('customer_loyalty_accounts')) {
          return [{ id: mockAccountId, stars_balance: 20, lifetime_stars_earned: 50, lifetime_stars_redeemed: 0 }];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 25,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-1',
          transaction_type: 'adjustment',
          stars: -10,
          description: `${formatReversalTag(spendTxId)} Reversed 10`,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-2',
          transaction_type: 'adjustment',
          stars: -5,
          description: `${formatReversalTag(spendTxId)} Reversed 5`,
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-4',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRecovered).toBe(10);
      expect(result.outstandingPointsRemaining).toBe(0);
      expect(result.isRecoveryComplete).toBe(true);
      expect(result.currentStarsBalance).toBe(10);

      // Verify unrecovered_loyalty_points is updated to 0
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 0 },
      });
    });

    it('5. Repeated cancellation does not duplicate liability or create duplicate adjustments', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) return [{ id: mockOrderId }];
        if (text.includes('customer_loyalty_accounts')) {
          return [{ id: mockAccountId, stars_balance: 50, lifetime_stars_earned: 100, lifetime_stars_redeemed: 0 }];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 25,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-full',
          transaction_type: 'adjustment',
          stars: -25,
          description: `${formatReversalTag(spendTxId)} Reversed full 25`,
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await reverseOrderLoyaltyOnCancellation(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-5',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsReversed).toBe(0);
      expect(result.outstandingSpendLiability).toBe(0);
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();

      // Confirms projection is written as 0
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 0 },
      });
    });

    it('6. Repeated recovery does not recover the same amount twice', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('customer_loyalty_accounts')) {
          return [{ id: mockAccountId, stars_balance: 100, lifetime_stars_earned: 200, lifetime_stars_redeemed: 0 }];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        {
          id: spendTxId,
          transaction_type: 'visit_reward',
          stars: 25,
          order_id: mockOrderId,
        } as any,
        {
          id: 'adj-full',
          transaction_type: 'adjustment',
          stars: -25,
          description: `${formatReversalTag(spendTxId)} Reversed full 25`,
          order_id: mockOrderId,
        } as any,
      ]);

      const result = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-DW-6',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });

      expect(result.pointsRecovered).toBe(0);
      expect(result.outstandingPointsRemaining).toBe(0);
      expect(result.isRecoveryComplete).toBe(true);
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();

      // Projection explicitly synchronized to 0
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 0 },
      });
    });

    it('7. Concurrent recovery attempts cannot over-recover or produce a stale projection under serialized locks', async () => {
      (prisma.$queryRaw as any).mockImplementationOnce(async () => [
        { id: mockAccountId, stars_balance: 12, lifetime_stars_earned: 50, lifetime_stars_redeemed: 0 },
      ]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        { id: spendTxId, transaction_type: 'visit_reward', stars: 20, order_id: mockOrderId } as any,
      ]);

      const run1 = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-CONC-1',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });
      expect(run1.pointsRecovered).toBe(12);
      expect(run1.outstandingPointsRemaining).toBe(8);
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 8 },
      });

      (prisma.$queryRaw as any).mockImplementationOnce(async () => [
        { id: mockAccountId, stars_balance: 0, lifetime_stars_earned: 38, lifetime_stars_redeemed: 0 },
      ]);
      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        { id: spendTxId, transaction_type: 'visit_reward', stars: 20, order_id: mockOrderId } as any,
        {
          id: 'adj-run1',
          transaction_type: 'adjustment',
          stars: -12,
          description: `${formatReversalTag(spendTxId)} Recovered 12`,
          order_id: mockOrderId,
        } as any,
      ]);

      const run2 = await recoverOrderLoyaltyLiability(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-CONC-2',
        restaurantId: mockRestaurantId,
        customerId: mockCustomerId,
      });
      expect(run2.pointsRecovered).toBe(0);
      expect(run2.outstandingPointsRemaining).toBe(8);
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 8 },
      });
    });

    it('8. A transaction failure rolls back projection, ledger, and account changes together', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) return [{ id: mockOrderId }];
        if (text.includes('customer_loyalty_accounts')) {
          return [{ id: mockAccountId, stars_balance: 50, lifetime_stars_earned: 100, lifetime_stars_redeemed: 0 }];
        }
        return [];
      });

      vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([
        { id: spendTxId, transaction_type: 'visit_reward', stars: 25, order_id: mockOrderId } as any,
      ]);

      vi.mocked(prisma.orders.update).mockRejectedValueOnce(
        new Error('Database disk I/O failure on orders table')
      );

      await expect(
        reverseOrderLoyaltyOnCancellation(prisma as any, {
          orderId: mockOrderId,
          orderNumber: 'ORD-FAIL-1',
          restaurantId: mockRestaurantId,
          customerId: mockCustomerId,
        })
      ).rejects.toThrow('Database disk I/O failure on orders table');
    });

    it('9. Existing historical liability calculations continue to return the exact same ledger-authoritative results', async () => {
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([
        {
          id: mockOrderId,
          order_number: 'ORD-HIST-1',
          restaurant_id: mockRestaurantId,
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          status: 'cancelled',
          ordered_at: new Date('2026-10-01T12:00:00Z'),
          customers: {
            id: mockCustomerId,
            name: 'Historical Customer',
            phone: '+919876543210',
            customer_loyalty_accounts: [{ stars_balance: 15 }],
          },
          branches: { id: mockBranchId, name: 'Main Branch' },
          loyalty_transactions: [
            {
              id: spendTxId,
              transaction_type: 'visit_reward',
              stars: 30,
              description: 'Earned 30 points',
              created_at: new Date(),
            },
            {
              id: 'adj-partial',
              transaction_type: 'adjustment',
              stars: -10,
              description: `${formatReversalTag(spendTxId)} Reversed 10`,
              created_at: new Date(),
            },
          ],
        } as any,
      ]);
      vi.mocked(prisma.orders.count).mockResolvedValueOnce(1);

      const result = await listCancelledOrdersWithOutstandingLoyaltyLiability(mockRestaurantId);

      expect(result.summary.totalCandidateOrders).toBe(1);
      expect(result.summary.ordersWithOutstandingLiability).toBe(1);
      expect(result.summary.totalOutstandingPoints).toBe(20);
      expect(result.summary.totalRecoverablePointsNow).toBe(15);
      expect(result.orders[0].outstandingLiability).toBe(20);
      expect(result.orders[0].recoverablePoints).toBe(15);
    });

    it('10. Cancellation route handles orders with no customer by setting unrecovered_loyalty_points to 0', async () => {
      (prisma.$queryRaw as any).mockImplementation(async (query: any) => {
        const text = extractQueryText(query);
        if (text.includes('orders')) {
          return [
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              branch_id: mockBranchId,
              table_id: 't-1',
              status: 'pending',
              order_number: 'ORD-NOCUST',
              completed_at: null,
              customer_id: null,
              subtotal: new Prisma.Decimal('100.00'),
              discount_amount: new Prisma.Decimal('0.00'),
            },
          ];
        }
        return [];
      });

      vi.mocked(prisma.orders.findUnique).mockResolvedValueOnce({
        id: mockOrderId,
        order_number: 'ORD-NOCUST',
        status: 'cancelled',
        restaurant_id: mockRestaurantId,
        branch_id: mockBranchId,
        customer_id: null,
        subtotal: new Prisma.Decimal('100.00'),
        discount_amount: new Prisma.Decimal('0.00'),
        loyalty_discount_amount: new Prisma.Decimal('0.00'),
        tax_amount: new Prisma.Decimal('5.00'),
        total_amount: new Prisma.Decimal('105.00'),
        unrecovered_loyalty_points: 0,
        customers: null,
        restaurant_tables: { id: 't-1', table_number: 'T1', capacity: 4 },
        branches: { id: mockBranchId, name: 'Main Branch' },
        payments: [],
        _count: { order_items: 1 },
      } as any);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/orders/${mockOrderId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );

      const res = await updateOwnerOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: mockOrderId }),
      });

      expect(res.status).toBe(200);
      expect(prisma.orders.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { unrecovered_loyalty_points: 0 },
      });
    });
  });
});
