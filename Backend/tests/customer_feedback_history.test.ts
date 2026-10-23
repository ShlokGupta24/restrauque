import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCustomer } from '@/lib/auth/guard';
import { GET as getCustomerFeedbackHandler } from '@/app/api/v1/customer/feedback/route';
import { GET as getCustomerOrdersHandler } from '@/app/api/v1/customer/orders/route';
import {
  getCustomerFeedbackHistory,
} from '@/lib/customer/feedback';
import {
  evaluateOrderFeedbackEligibility,
  getOrderFeedbackEligibility,
} from '@/lib/feedback/service';
import {
  AuthenticationError,
  ForbiddenError,
  ValidationError,
} from '@/lib/http/errors';

// Mock Prisma Client
vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    orders: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    restaurants: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    loyalty_programs: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    feedback: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock Auth Guard
vi.mock('@/lib/auth/guard', () => ({
  requireCustomer: vi.fn(),
}));

describe('Step 22 — Customer Feedback History and Order Filter API', () => {
  const mockCustomerId = '11111111-1111-4111-8111-111111111111';
  const mockOtherCustomerId = '99999999-9999-4999-8999-999999999999';
  const mockRestaurant1Id = '22222222-2222-4222-8222-222222222222';
  const mockRestaurant2Id = '33333333-3333-4333-8333-333333333333';
  const mockOrder1Id = '44444444-4444-4444-8444-444444444444';
  const mockOrder2Id = '55555555-5555-4555-8555-555555555555';
  const mockOrder3Id = '66666666-6666-4666-8666-666666666666';
  const mockProductId1 = '77777777-7777-4777-8777-777777777777';
  const mockProductId2 = '88888888-8888-4888-8888-888888888888';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Unauthenticated and Unauthorized Access
  // =========================================================================
  describe('1. Unauthenticated and Unauthorized Access', () => {
    it('returns 401 UNAUTHORIZED when authentication credentials are missing', async () => {
      vi.mocked(requireCustomer).mockRejectedValueOnce(
        new AuthenticationError('Authentication required: Missing credentials')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/customer/feedback');
      const response = await getCustomerFeedbackHandler(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 FORBIDDEN when user role is not CUSTOMER (e.g. RESTAURANT_OWNER)', async () => {
      vi.mocked(requireCustomer).mockRejectedValueOnce(
        new ForbiddenError('Access forbidden: Requires one of [CUSTOMER] role')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/customer/feedback');
      const response = await getCustomerFeedbackHandler(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 2. Empty History State
  // =========================================================================
  describe('2. Empty History State', () => {
    it('returns 200 OK with empty orders array and zeroed summaries for customer without orders', async () => {
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.groupBy)
        .mockResolvedValueOnce([]) // totalPerRest
        .mockResolvedValueOnce([]) // pendingPerRest
        .mockResolvedValueOnce([]); // reviewedPerRest
      vi.mocked(prisma.restaurants.findMany).mockResolvedValueOnce([]);

      const result = await getCustomerFeedbackHistory(mockCustomerId, {
        status: 'all',
        limit: 10,
      });

      expect(result.orders).toEqual([]);
      expect(result.pagination).toEqual({
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      });
      expect(result.summary).toEqual({
        all: 0,
        awaitingReview: 0,
        reviewed: 0,
      });
      expect(result.restaurantSummary).toEqual([]);
    });
  });

  // =========================================================================
  // 3. All Orders Filter & Explanations
  // =========================================================================
  describe('3. All Orders Filter', () => {
    it('returns completed, in-progress, and reviewed orders with accurate eligibility reasons', async () => {
      const mockOrdersData = [
        // Order 1: Completed, awaiting review
        {
          id: mockOrder1Id,
          order_number: 'ORD-001',
          status: 'completed',
          total_amount: 500,
          ordered_at: new Date('2026-10-19T18:00:00.000Z'),
          completed_at: new Date('2026-10-19T18:40:00.000Z'),
          restaurants: {
            id: mockRestaurant1Id,
            name: 'The Truffle Table',
            loyalty_programs: { name: 'Dine Rewards', is_active: true, stars_per_review: 10 },
          },
          branches: { id: 'b1', name: 'Downtown' },
          restaurant_tables: { id: 't1', table_number: 'T1' },
          order_items: [
            {
              product_id: mockProductId1,
              product_name: 'Pasta',
              variant_name: 'Large',
              quantity: 1,
              products: { image_url: 'https://example.com/pasta.jpg' },
              order_item_addons: [{ addon_name: 'Extra Cheese' }],
            },
          ],
          feedback: [],
        },
        // Order 2: In-progress (preparing)
        {
          id: mockOrder2Id,
          order_number: 'ORD-002',
          status: 'preparing',
          total_amount: 300,
          ordered_at: new Date('2026-10-19T19:00:00.000Z'),
          completed_at: null,
          restaurants: {
            id: mockRestaurant1Id,
            name: 'The Truffle Table',
            loyalty_programs: { name: 'Dine Rewards', is_active: true, stars_per_review: 10 },
          },
          branches: { id: 'b1', name: 'Downtown' },
          restaurant_tables: { id: 't1', table_number: 'T1' },
          order_items: [],
          feedback: [],
        },
      ];

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce(mockOrdersData as any);
      vi.mocked(prisma.orders.groupBy)
        .mockResolvedValueOnce([{ restaurant_id: mockRestaurant1Id, _count: { id: 2 } }] as any) // total
        .mockResolvedValueOnce([{ restaurant_id: mockRestaurant1Id, _count: { id: 1 } }] as any) // pending
        .mockResolvedValueOnce([]); // reviewed
      vi.mocked(prisma.restaurants.findMany).mockResolvedValueOnce([
        { id: mockRestaurant1Id, name: 'The Truffle Table' },
      ] as any);

      const result = await getCustomerFeedbackHistory(mockCustomerId, { status: 'all' });

      expect(result.orders).toHaveLength(2);

      // Order 1: eligible
      expect(result.orders[0].orderId).toBe(mockOrder1Id);
      expect(result.orders[0].eligibility.isEligible).toBe(true);
      expect(result.orders[0].eligibility.reason).toBeNull();
      expect(result.orders[0].hasFeedback).toBe(false);
      expect(result.orders[0].potentialReward).toEqual({
        isActive: true,
        programName: 'Dine Rewards',
        basePoints: 10,
        baseStars: 10,
      });

      // Order 2: ineligible with clear reason
      expect(result.orders[1].orderId).toBe(mockOrder2Id);
      expect(result.orders[1].eligibility.isEligible).toBe(false);
      expect(result.orders[1].eligibility.reason).toContain('Order status is "preparing"');
      expect(result.orders[1].hasFeedback).toBe(false);
    });
  });

  // =========================================================================
  // 4 & 5. Awaiting Review Filter Exclusions
  // =========================================================================
  describe('4 & 5. Awaiting Review Filter Correctness', () => {
    it('excludes non-completed and already-reviewed orders from database query', async () => {
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.restaurants.findMany).mockResolvedValue([]);

      await getCustomerFeedbackHistory(mockCustomerId, {
        status: 'awaiting_review',
      });

      // Verify Prisma query strictly enforces completed status and no feedback
      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customer_id: mockCustomerId,
            status: 'completed',
            feedback: { none: {} },
          },
        })
      );
    });
  });

  // =========================================================================
  // 6. Reviewed Filter & Persisted Feedback Details
  // =========================================================================
  describe('6. Reviewed Filter & Persisted Feedback Details', () => {
    it('returns persisted overall feedback, dish-level ratings/comments, and reward info', async () => {
      const mockReviewedOrder = {
        id: mockOrder3Id,
        order_number: 'ORD-003',
        status: 'completed',
        total_amount: 850,
        ordered_at: new Date('2026-10-18T14:00:00.000Z'),
        completed_at: new Date('2026-10-18T14:45:00.000Z'),
        restaurants: {
          id: mockRestaurant1Id,
          name: 'The Truffle Table',
          loyalty_programs: { name: 'Dine Rewards', is_active: true, stars_per_review: 10 },
        },
        branches: { id: 'b1', name: 'Downtown' },
        restaurant_tables: { id: 't2', table_number: 'T2' },
        order_items: [
          {
            product_id: mockProductId1,
            product_name: 'Truffle Tagliatelle',
            variant_name: null,
            quantity: 1,
            products: { image_url: null },
            order_item_addons: [],
          },
          {
            product_id: mockProductId2,
            product_name: 'Tiramisu',
            variant_name: null,
            quantity: 1,
            products: { image_url: null },
            order_item_addons: [],
          },
        ],
        feedback: [
          {
            id: 'fb-123',
            rating: 5,
            comment: 'Outstanding dinner!',
            submitted_at: new Date('2026-10-18T15:00:00.000Z'),
            feedback_aspects: [
              {
                product_id: mockProductId1,
                aspect: 'item_rating',
                aspect_value: '5',
              },
              {
                product_id: mockProductId1,
                aspect: 'item_comment',
                aspect_value: 'Rich and aromatic',
              },
              {
                product_id: mockProductId2,
                aspect: 'item_rating',
                aspect_value: '4',
              },
            ],
            loyalty_transactions: [
              {
                stars: 12,
                transaction_type: 'review_reward',
                description: 'Earned 10 stars for review + 2 bonus stars for items',
              },
            ],
          },
        ],
      };

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([mockReviewedOrder as any]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.restaurants.findMany).mockResolvedValue([]);

      const result = await getCustomerFeedbackHistory(mockCustomerId, {
        status: 'reviewed',
      });

      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customer_id: mockCustomerId,
            feedback: { some: {} },
          },
        })
      );

      expect(result.orders).toHaveLength(1);
      const order = result.orders[0];
      expect(order.hasFeedback).toBe(true);
      expect(order.eligibility.isEligible).toBe(false);
      expect(order.eligibility.reason).toBe('Feedback has already been submitted for this order');

      expect(order.feedback).toBeDefined();
      expect(order.feedback?.rating).toBe(5);
      expect(order.feedback?.comment).toBe('Outstanding dinner!');
      expect(order.feedback?.submittedAt).toBe('2026-10-18T15:00:00.000Z');

      // Dish-level reviews
      expect(order.feedback?.itemFeedback).toHaveLength(2);
      const pastaReview = order.feedback?.itemFeedback.find((i) => i.productId === mockProductId1);
      expect(pastaReview).toEqual({
        productId: mockProductId1,
        productName: 'Truffle Tagliatelle',
        rating: 5,
        comment: 'Rich and aromatic',
      });

      const dessertReview = order.feedback?.itemFeedback.find((i) => i.productId === mockProductId2);
      expect(dessertReview).toEqual({
        productId: mockProductId2,
        productName: 'Tiramisu',
        rating: 4,
        comment: null,
      });

      // Reward details
      expect(order.feedback?.reward).toEqual({
        isAwarded: true,
        pointsAwarded: 12,
        starsAwarded: 12,
        transactionType: 'review_reward',
        description: 'Earned 10 stars for review + 2 bonus stars for items',
      });

      expect(order.potentialReward).toBeNull();
    });
  });

  // =========================================================================
  // 7. Restaurant Filtering
  // =========================================================================
  describe('7. Restaurant Filtering', () => {
    it('applies restaurantId filter to orders while retaining global restaurantSummary options', async () => {
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.groupBy)
        .mockResolvedValueOnce([
          { restaurant_id: mockRestaurant1Id, _count: { id: 3 } },
          { restaurant_id: mockRestaurant2Id, _count: { id: 2 } },
        ] as any)
        .mockResolvedValueOnce([
          { restaurant_id: mockRestaurant1Id, _count: { id: 1 } },
          { restaurant_id: mockRestaurant2Id, _count: { id: 0 } },
        ] as any)
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.restaurants.findMany).mockResolvedValueOnce([
        { id: mockRestaurant1Id, name: 'The Truffle Table' },
        { id: mockRestaurant2Id, name: 'Spice Route' },
      ] as any);

      const result = await getCustomerFeedbackHistory(mockCustomerId, {
        restaurantId: mockRestaurant1Id,
        status: 'all',
      });

      // Order query has restaurant_id filter
      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customer_id: mockCustomerId,
            restaurant_id: mockRestaurant1Id,
          }),
        })
      );

      // But restaurantSummary includes BOTH restaurants so the frontend selector has all choices
      expect(result.restaurantSummary).toHaveLength(2);
      expect(result.restaurantSummary[0].restaurantId).toBe(mockRestaurant1Id);
      expect(result.restaurantSummary[0].pendingFeedbackCount).toBe(1);
      expect(result.restaurantSummary[1].restaurantId).toBe(mockRestaurant2Id);
      expect(result.restaurantSummary[1].pendingFeedbackCount).toBe(0);
    });
  });

  // =========================================================================
  // 8. Correct Restaurant-Specific Pending Counts (Pagination Boundaries)
  // =========================================================================
  describe('8. Correct Restaurant-Specific Pending Counts Across Pagination', () => {
    it('computes global pending feedback counts independent of page limit', async () => {
      // Mock page returning only 1 order due to limit=1
      const singleOrder = {
        id: mockOrder1Id,
        order_number: 'ORD-001',
        status: 'completed',
        total_amount: 100,
        ordered_at: new Date('2026-10-19T18:00:00.000Z'),
        completed_at: new Date('2026-10-19T18:30:00.000Z'),
        restaurants: { id: mockRestaurant1Id, name: 'The Truffle Table' },
        branches: null,
        restaurant_tables: null,
        order_items: [],
        feedback: [],
      };

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([singleOrder as any, singleOrder as any]); // 2 returned for limit=1 (hasNextPage=true)
      vi.mocked(prisma.orders.groupBy)
        .mockResolvedValueOnce([
          { restaurant_id: mockRestaurant1Id, _count: { id: 5 } },
          { restaurant_id: mockRestaurant2Id, _count: { id: 3 } },
        ] as any)
        .mockResolvedValueOnce([
          { restaurant_id: mockRestaurant1Id, _count: { id: 4 } }, // 4 pending at Restaurant 1
          { restaurant_id: mockRestaurant2Id, _count: { id: 2 } }, // 2 pending at Restaurant 2
        ] as any)
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.restaurants.findMany).mockResolvedValueOnce([
        { id: mockRestaurant1Id, name: 'The Truffle Table' },
        { id: mockRestaurant2Id, name: 'Spice Route' },
      ] as any);

      const result = await getCustomerFeedbackHistory(mockCustomerId, {
        limit: 1,
        status: 'all',
      });

      expect(result.orders).toHaveLength(1);
      expect(result.pagination.hasNextPage).toBe(true);

      // Crucial requirement: pending counts must NOT be derived only from the current 1-item page
      expect(result.summary.awaitingReview).toBe(6); // 4 + 2
      expect(result.restaurantSummary.find((r) => r.restaurantId === mockRestaurant1Id)?.pendingFeedbackCount).toBe(4);
      expect(result.restaurantSummary.find((r) => r.restaurantId === mockRestaurant2Id)?.pendingFeedbackCount).toBe(2);
    });
  });

  // =========================================================================
  // 9. Customer Isolation
  // =========================================================================
  describe('9. Customer Isolation and Privacy Protection', () => {
    it('strictly confines all order and feedback queries to the authenticated customer ID', async () => {
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.restaurants.findMany).mockResolvedValue([]);

      await getCustomerFeedbackHistory(mockCustomerId, { status: 'all' });

      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customer_id: mockCustomerId }),
        })
      );

      for (const call of vi.mocked(prisma.orders.groupBy).mock.calls) {
        expect(call[0].where).toEqual(
          expect.objectContaining({ customer_id: mockCustomerId })
        );
      }
    });
  });

  // =========================================================================
  // 10. Existing Eligibility Endpoint Parity
  // =========================================================================
  describe('10. Existing Eligibility Endpoint Parity', () => {
    it('evaluates eligibility identically between feedback history and getOrderFeedbackEligibility', async () => {
      // 1. Completed without feedback
      const eligible = evaluateOrderFeedbackEligibility('completed', false);
      expect(eligible.isEligible).toBe(true);
      expect(eligible.reason).toBeNull();

      // 2. Completed with existing feedback
      const reviewed = evaluateOrderFeedbackEligibility('completed', true);
      expect(reviewed.isEligible).toBe(false);
      expect(reviewed.reason).toBe('Feedback has already been submitted for this order');

      // 3. Preparing
      const preparing = evaluateOrderFeedbackEligibility('preparing', false);
      expect(preparing.isEligible).toBe(false);
      expect(preparing.reason).toBe(
        'Order status is "preparing". Feedback can only be submitted once your meal is marked as completed.'
      );

      // 4. Cancelled
      const cancelled = evaluateOrderFeedbackEligibility('cancelled', false);
      expect(cancelled.isEligible).toBe(false);
      expect(cancelled.reason).toBe(
        'Order status is "cancelled". Feedback can only be submitted once your meal is marked as completed.'
      );

      // Verify parity with getOrderFeedbackEligibility mock call
      vi.mocked(prisma.orders.findUnique).mockResolvedValueOnce({
        id: mockOrder1Id,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurant1Id,
        status: 'completed',
        order_number: 'ORD-001',
        restaurant_tables: null,
        order_items: [],
        feedback: [],
        restaurants: { id: mockRestaurant1Id, name: 'The Truffle Table' },
      } as any);

      vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValueOnce({
        id: 'lp-1',
        restaurant_id: mockRestaurant1Id,
        name: 'Dine Rewards',
        is_active: true,
        earning_mode: 'visit_and_review',
        stars_per_visit: 5,
        stars_per_review: 10,
      } as any);

      const eligibilityResult = await getOrderFeedbackEligibility(mockOrder1Id, mockCustomerId);
      expect(eligibilityResult.isEligible).toBe(eligible.isEligible);
      expect(eligibilityResult.reason).toBe(eligible.reason);
    });
  });

  // =========================================================================
  // 11. Malformed Filter / Restaurant Parameters
  // =========================================================================
  describe('11. Malformed Query Parameters', () => {
    it('returns 400 Bad Request when status query parameter is unrecognized', async () => {
      vi.mocked(requireCustomer).mockResolvedValueOnce({
        user: { id: mockCustomerId } as any,
        sessionId: 'session-1',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/customer/feedback?status=invalid_tab'
      );
      const response = await getCustomerFeedbackHandler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 Bad Request when restaurantId is not a valid UUID', async () => {
      vi.mocked(requireCustomer).mockResolvedValueOnce({
        user: { id: mockCustomerId } as any,
        sessionId: 'session-1',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/customer/feedback?restaurantId=not-a-uuid'
      );
      const response = await getCustomerFeedbackHandler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 Bad Request when limit is non-positive or exceeds max 50', async () => {
      vi.mocked(requireCustomer).mockResolvedValueOnce({
        user: { id: mockCustomerId } as any,
        sessionId: 'session-1',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/customer/feedback?limit=100'
      );
      const response = await getCustomerFeedbackHandler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 12. Backward Compatibility for Existing Order History Clients
  // =========================================================================
  describe('12. Backward Compatibility for Existing Order History Clients', () => {
    it('preserves existing GET /api/v1/customer/orders behavior when feedbackStatus is omitted', async () => {
      vi.mocked(requireCustomer).mockResolvedValueOnce({
        user: { id: mockCustomerId } as any,
        sessionId: 'session-1',
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/v1/customer/orders');
      const response = await getCustomerOrdersHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.orders).toEqual([]);
      expect(body.data.summary).toBeDefined();

      // Verify where clause in existing handler has no feedback filter when omitted
      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customer_id: mockCustomerId,
          },
        })
      );
    });

    it('applies feedbackStatus filter on GET /api/v1/customer/orders when supplied', async () => {
      vi.mocked(requireCustomer).mockResolvedValueOnce({
        user: { id: mockCustomerId } as any,
        sessionId: 'session-1',
      });

      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.groupBy).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/customer/orders?feedbackStatus=awaiting_review'
      );
      const response = await getCustomerOrdersHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      expect(prisma.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customer_id: mockCustomerId,
            status: 'completed',
            feedback: { none: {} },
          },
        })
      );
    });
  });
});
