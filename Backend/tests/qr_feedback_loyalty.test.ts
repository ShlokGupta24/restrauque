import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFeedbackSchema,
  itemFeedbackInputSchema,
  updateLoyaltyRulesSchema,
} from '@/lib/validation/feedback';
import {
  getOrCreateRestaurantLoyaltyProgram,
  updateRestaurantLoyaltyRules,
  awardFeedbackLoyaltyReward,
  getCustomerLoyaltySummary,
} from '@/lib/loyalty/service';
import {
  getOrderFeedbackEligibility,
  submitOrderFeedback,
} from '@/lib/feedback/service';
import { prisma } from '@/lib/db/prisma';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/http/errors';

// Mock Prisma Client
vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn(async (callback: any) => {
      return await callback(mockPrisma);
    }),
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
      create: vi.fn(),
      findMany: vi.fn(),
    },
    orders: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    order_items: {
      findMany: vi.fn(),
    },
    feedback: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    feedback_products: {
      create: vi.fn(),
    },
    feedback_aspects: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 4 — Customer Feedback, Loyalty Rules, and Reward Integrity', () => {
  const mockCustomerId = '11111111-1111-4111-8111-111111111111';
  const mockOtherCustomerId = '99999999-9999-4999-8999-999999999999';
  const mockRestaurantId = '22222222-2222-4222-8222-222222222222';
  const mockBranchId = '33333333-3333-4333-8333-333333333333';
  const mockOrderId = '44444444-4444-4444-8444-444444444444';
  const mockProductId1 = '55555555-5555-4555-8555-555555555555';
  const mockProductId2 = '66666666-6666-4666-8666-666666666666';
  const mockUnorderedProductId = '77777777-7777-4777-8777-777777777777';
  const mockFeedbackId = '88888888-8888-4888-8888-888888888888';
  const mockAccountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const mockProgramId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. Validation Schemas & Boundaries
  // ==========================================
  describe('1. Validation Schemas & Boundary Rules', () => {
    it('accepts valid overall feedback with item ratings and comments', () => {
      const payload = {
        rating: 5,
        comment: 'Exceptional dining experience! The pasta was perfectly al dente.',
        items: [
          {
            productId: mockProductId1,
            rating: 5,
            comment: 'Crispy and fresh.',
          },
          {
            productId: mockProductId2,
            rating: 4,
            comment: null,
          },
        ],
      };

      const result = createFeedbackSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rating).toBe(5);
        expect(result.data.items).toHaveLength(2);
      }
    });

    it('rejects overall ratings outside 1–5 range', () => {
      expect(createFeedbackSchema.safeParse({ rating: 0 }).success).toBe(false);
      expect(createFeedbackSchema.safeParse({ rating: 6 }).success).toBe(false);
      expect(createFeedbackSchema.safeParse({ rating: -1 }).success).toBe(false);
      expect(createFeedbackSchema.safeParse({ rating: 3.5 }).success).toBe(false);
    });

    it('rejects invalid item ratings', () => {
      expect(
        itemFeedbackInputSchema.safeParse({
          productId: mockProductId1,
          rating: 0,
        }).success
      ).toBe(false);

      expect(
        itemFeedbackInputSchema.safeParse({
          productId: mockProductId1,
          rating: 6,
        }).success
      ).toBe(false);

      expect(
        itemFeedbackInputSchema.safeParse({
          productId: 'invalid-uuid',
          rating: 4,
        }).success
      ).toBe(false);
    });

    it('rejects comments that exceed length limits', () => {
      const longOverallComment = 'a'.repeat(1001);
      expect(
        createFeedbackSchema.safeParse({
          rating: 5,
          comment: longOverallComment,
        }).success
      ).toBe(false);

      const longItemComment = 'b'.repeat(501);
      expect(
        itemFeedbackInputSchema.safeParse({
          productId: mockProductId1,
          rating: 5,
          comment: longItemComment,
        }).success
      ).toBe(false);
    });

    it('validates owner loyalty rule configuration updates', () => {
      const valid = updateLoyaltyRulesSchema.safeParse({
        name: 'VIP Diner Rewards',
        description: 'Earn stars on every meal',
        isActive: true,
        starsPerReview: 25,
        starsPerVisit: 10,
        earningMode: 'visit_and_review',
      });
      expect(valid.success).toBe(true);

      const negativeStars = updateLoyaltyRulesSchema.safeParse({
        starsPerReview: -5,
      });
      expect(negativeStars.success).toBe(false);

      const excessiveStars = updateLoyaltyRulesSchema.safeParse({
        starsPerReview: 1000,
      });
      expect(excessiveStars.success).toBe(false);
    });
  });

  // ==========================================
  // 2. Feedback Eligibility Checks
  // ==========================================
  describe('2. Feedback Eligibility & Order Ownership Checks', () => {
    it('verifies an eligible completed order for the authenticated customer', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-20261017-001',
        status: 'completed',
        completed_at: new Date(),
        restaurants: { id: mockRestaurantId, name: 'Bistro Luxe' },
        restaurant_tables: { id: 'table-1', table_number: 'T-04' },
        order_items: [
          {
            product_id: mockProductId1,
            product_name: 'Truffle Pasta',
            variant_name: 'Regular',
            quantity: 1,
            products: { id: mockProductId1, image_url: 'https://example.com/pasta.jpg' },
            order_item_addons: [],
          },
        ],
        feedback: [],
      });

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        description: 'Test program',
        is_active: true,
        earning_mode: 'visit_and_review',
        stars_per_visit: 5,
        stars_per_review: 10,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getOrderFeedbackEligibility(mockOrderId, mockCustomerId);

      expect(result.isEligible).toBe(true);
      expect(result.alreadySubmitted).toBe(false);
      expect(result.order.orderNumber).toBe('ORD-20261017-001');
      expect(result.order.items).toHaveLength(1);
      expect(result.potentialReward.baseStars).toBe(10);
    });

    it('rejects eligibility when the order belongs to another customer', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockOtherCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-20261017-002',
        status: 'completed',
      });

      await expect(
        getOrderFeedbackEligibility(mockOrderId, mockCustomerId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects eligibility when the order is not completed (e.g. preparing or served)', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-20261017-003',
        status: 'served',
        restaurants: { id: mockRestaurantId, name: 'Bistro Luxe' },
        restaurant_tables: { id: 'table-1', table_number: 'T-04' },
        order_items: [],
        feedback: [],
      });

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: true,
        stars_per_review: 10,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getOrderFeedbackEligibility(mockOrderId, mockCustomerId);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('served');
    });

    it('detects when feedback was already submitted for an order', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-20261017-004',
        status: 'completed',
        restaurants: { id: mockRestaurantId, name: 'Bistro Luxe' },
        restaurant_tables: { id: 'table-1', table_number: 'T-04' },
        order_items: [],
        feedback: [
          {
            id: mockFeedbackId,
            rating: 5,
            comment: 'Great dinner!',
            submitted_at: new Date(),
            feedback_aspects: [],
            feedback_products: [],
          },
        ],
      });

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: true,
        stars_per_review: 10,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getOrderFeedbackEligibility(mockOrderId, mockCustomerId);
      expect(result.isEligible).toBe(false);
      expect(result.alreadySubmitted).toBe(true);
      expect(result.existingFeedback?.rating).toBe(5);
    });
  });

  // ==========================================
  // 3. Feedback Submission & Item Integrity
  // ==========================================
  describe('3. Feedback Submission & Item Integrity Checks', () => {
    it('successfully processes valid feedback for a completed order and awards stars', async () => {
      // Row lock order query result
      (prisma.$queryRaw as any).mockResolvedValue([
        {
          id: mockOrderId,
          restaurant_id: mockRestaurantId,
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          status: 'completed',
          order_number: 'ORD-20261017-005',
        },
      ]);

      // No existing feedback
      (prisma.feedback.findFirst as any).mockResolvedValue(null);

      // Order items
      (prisma.order_items.findMany as any).mockResolvedValue([
        { product_id: mockProductId1, product_name: 'Truffle Pasta' },
        { product_id: mockProductId2, product_name: 'Tiramisu' },
      ]);

      // Create feedback
      (prisma.feedback.create as any).mockResolvedValue({
        id: mockFeedbackId,
        restaurant_id: mockRestaurantId,
        branch_id: mockBranchId,
        order_id: mockOrderId,
        customer_id: mockCustomerId,
        rating: 5,
        comment: 'Delicious meal!',
        submitted_at: new Date(),
      });

      (prisma.feedback_products.create as any).mockResolvedValue({ id: 'fp-1' });
      (prisma.feedback_aspects.create as any).mockResolvedValue({ id: 'fa-1' });

      // Loyalty program mock
      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        description: 'Test program',
        is_active: true,
        earning_mode: 'visit_and_review',
        stars_per_visit: 5,
        stars_per_review: 10,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // No existing reward transaction
      (prisma.loyalty_transactions.findFirst as any).mockResolvedValue(null);

      // Customer loyalty account
      (prisma.customer_loyalty_accounts.findUnique as any).mockResolvedValue({
        id: mockAccountId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        stars_balance: 20,
        lifetime_stars_earned: 20,
      });

      // Account and order row lock mock
      (prisma.$queryRaw as any).mockImplementation((query: any) => {
        const text =
          typeof query === 'string'
            ? query
            : Array.isArray(query)
            ? query.join(' ')
            : Array.isArray(query?.strings)
            ? query.strings.join(' ')
            : JSON.stringify(query);
        if (text.includes('orders')) {
          return Promise.resolve([
            {
              id: mockOrderId,
              restaurant_id: mockRestaurantId,
              branch_id: mockBranchId,
              customer_id: mockCustomerId,
              status: 'completed',
              order_number: 'ORD-20261017-005',
            },
          ]);
        }
        if (text.includes('customer_loyalty_accounts')) {
          return Promise.resolve([
            {
              id: mockAccountId,
              stars_balance: 20,
              lifetime_stars_earned: 20,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.loyalty_transactions.create as any).mockResolvedValue({ id: 'tx-1' });
      (prisma.customer_loyalty_accounts.update as any).mockResolvedValue({
        id: mockAccountId,
        stars_balance: 32,
        lifetime_stars_earned: 32,
      });

      const result = await submitOrderFeedback(mockCustomerId, mockOrderId, {
        rating: 5,
        comment: 'Delicious meal!',
        items: [
          { productId: mockProductId1, rating: 5, comment: 'Super flavorful' },
          { productId: mockProductId2, rating: 4, comment: null },
        ],
      });

      expect(result.feedbackId).toBe(mockFeedbackId);
      expect(result.rating).toBe(5);
      expect(result.reward.isRewardEarned).toBe(true);
      // Base 10 + 2 items reviewed = 12 stars awarded
      expect(result.reward.starsAwarded).toBe(12);
      expect(result.reward.newBalance).toBe(32);
      expect(prisma.feedback_products.create).toHaveBeenCalledTimes(2);
      expect(prisma.loyalty_transactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transaction_type: 'review_reward',
          feedback_id: mockFeedbackId,
          order_id: mockOrderId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
        }),
      });
    });

    it('rejects feedback for products not included in the order', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([
        {
          id: mockOrderId,
          restaurant_id: mockRestaurantId,
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          status: 'completed',
          order_number: 'ORD-20261017-006',
        },
      ]);

      (prisma.feedback.findFirst as any).mockResolvedValue(null);

      // Order contains only productId1
      (prisma.order_items.findMany as any).mockResolvedValue([
        { product_id: mockProductId1, product_name: 'Truffle Pasta' },
      ]);

      await expect(
        submitOrderFeedback(mockCustomerId, mockOrderId, {
          rating: 4,
          comment: 'Good',
          items: [
            { productId: mockUnorderedProductId, rating: 5, comment: 'Never ordered this' },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects duplicate item reviews in the same submission', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([
        {
          id: mockOrderId,
          restaurant_id: mockRestaurantId,
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          status: 'completed',
          order_number: 'ORD-20261017-007',
        },
      ]);

      (prisma.feedback.findFirst as any).mockResolvedValue(null);

      (prisma.order_items.findMany as any).mockResolvedValue([
        { product_id: mockProductId1, product_name: 'Truffle Pasta' },
      ]);

      await expect(
        submitOrderFeedback(mockCustomerId, mockOrderId, {
          rating: 4,
          comment: 'Good',
          items: [
            { productId: mockProductId1, rating: 5, comment: 'First review' },
            { productId: mockProductId1, rating: 4, comment: 'Duplicate review' },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('rejects feedback if order is in preparing or served status', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([
        {
          id: mockOrderId,
          restaurant_id: mockRestaurantId,
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          status: 'preparing', // Incomplete state
          order_number: 'ORD-20261017-008',
        },
      ]);

      await expect(
        submitOrderFeedback(mockCustomerId, mockOrderId, {
          rating: 5,
          comment: 'Too early',
          items: [],
        })
      ).rejects.toThrow(AppError);
    });

    it('rejects duplicate overall feedback submission under transaction lock', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([
        {
          id: mockOrderId,
          restaurant_id: mockRestaurantId,
          branch_id: mockBranchId,
          customer_id: mockCustomerId,
          status: 'completed',
          order_number: 'ORD-20261017-009',
        },
      ]);

      // Existing feedback already in database
      (prisma.feedback.findFirst as any).mockResolvedValue({
        id: mockFeedbackId,
        order_id: mockOrderId,
        customer_id: mockCustomerId,
      });

      await expect(
        submitOrderFeedback(mockCustomerId, mockOrderId, {
          rating: 5,
          comment: 'Trying to review again',
          items: [],
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  // ==========================================
  // 4. Loyalty Rules & Idempotent Rewards
  // ==========================================
  describe('4. Loyalty Rules & Authoritative Reward Calculation', () => {
    it('awards zero points when loyalty program is disabled by restaurant owner', async () => {
      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: false, // Disabled
        stars_per_review: 10,
        stars_per_visit: 5,
      });

      (prisma.loyalty_transactions.findFirst as any).mockResolvedValue(null);
      (prisma.customer_loyalty_accounts.findUnique as any).mockResolvedValue({
        id: mockAccountId,
        stars_balance: 50,
      });

      const result = await awardFeedbackLoyaltyReward(prisma as any, {
        customerId: mockCustomerId,
        restaurantId: mockRestaurantId,
        orderId: mockOrderId,
        feedbackId: mockFeedbackId,
        itemCount: 2,
      });

      expect(result.starsAwarded).toBe(0);
      expect(result.isRewardEarned).toBe(false);
      expect(result.newBalance).toBe(50);
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
    });

    it('prevents double-awarding if reward transaction was already persisted (Idempotency)', async () => {
      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: true,
        stars_per_review: 10,
        stars_per_visit: 5,
      });

      // Existing transaction record found
      (prisma.loyalty_transactions.findFirst as any).mockResolvedValue({
        id: 'existing-tx',
        stars: 12,
        description: 'Earned 10 stars for order review',
      });

      (prisma.customer_loyalty_accounts.findUnique as any).mockResolvedValue({
        id: mockAccountId,
        stars_balance: 62,
      });

      const result = await awardFeedbackLoyaltyReward(prisma as any, {
        customerId: mockCustomerId,
        restaurantId: mockRestaurantId,
        orderId: mockOrderId,
        feedbackId: mockFeedbackId,
        itemCount: 2,
      });

      expect(result.starsAwarded).toBe(12);
      expect(result.newBalance).toBe(62);
      expect(prisma.loyalty_transactions.findFirst).toHaveBeenCalledWith({
        where: {
          feedback_id: mockFeedbackId,
          transaction_type: 'review_reward',
        },
      });
      expect(prisma.loyalty_transactions.create).not.toHaveBeenCalled();
      expect(prisma.customer_loyalty_accounts.update).not.toHaveBeenCalled();
    });

    it('isolates customer loyalty balances per restaurant', async () => {
      const restaurantBId = '99999999-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: 'prog-b',
        restaurant_id: restaurantBId,
        name: 'Restaurant B Rewards',
        is_active: true,
      });

      (prisma.customer_loyalty_accounts.findUnique as any).mockImplementation(
        ({ where }: any) => {
          if (where.customer_id_restaurant_id.restaurant_id === mockRestaurantId) {
            return Promise.resolve({
              id: mockAccountId,
              customer_id: mockCustomerId,
              restaurant_id: mockRestaurantId,
              stars_balance: 100,
              lifetime_stars_earned: 100,
              tier: 'gold',
              status: 'active',
              loyalty_transactions: [],
            });
          }
          if (where.customer_id_restaurant_id.restaurant_id === restaurantBId) {
            return Promise.resolve({
              id: 'account-b',
              customer_id: mockCustomerId,
              restaurant_id: restaurantBId,
              stars_balance: 15,
              lifetime_stars_earned: 15,
              tier: 'standard',
              status: 'active',
              loyalty_transactions: [],
            });
          }
          return Promise.resolve(null);
        }
      );

      const summaryA = await getCustomerLoyaltySummary(mockCustomerId, mockRestaurantId);
      const summaryB = await getCustomerLoyaltySummary(mockCustomerId, restaurantBId);

      expect(summaryA.starsBalance).toBe(100);
      expect(summaryB.starsBalance).toBe(15);
      expect(summaryA.restaurantId).toBe(mockRestaurantId);
      expect(summaryB.restaurantId).toBe(restaurantBId);
    });

    it('updates restaurant loyalty rules accurately', async () => {
      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Old Name',
        is_active: true,
        stars_per_visit: 5,
        stars_per_review: 10,
        earning_mode: 'visit_and_review',
        created_at: new Date(),
        updated_at: new Date(),
      });

      (prisma.loyalty_programs.update as any).mockResolvedValue({
        id: mockProgramId,
        restaurant_id: mockRestaurantId,
        name: 'Gourmet Club Rewards',
        description: 'New Description',
        is_active: true,
        stars_per_visit: 10,
        stars_per_review: 20,
        earning_mode: 'review_only',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const updated = await updateRestaurantLoyaltyRules(mockRestaurantId, {
        name: 'Gourmet Club Rewards',
        description: 'New Description',
        starsPerVisit: 10,
        starsPerReview: 20,
        earningMode: 'review_only',
      });

      expect(updated.name).toBe('Gourmet Club Rewards');
      expect(updated.starsPerReview).toBe(20);
      expect(updated.earningMode).toBe('review_only');
      expect(prisma.loyalty_programs.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { restaurant_id: mockRestaurantId },
        })
      );
    });
  });
});
