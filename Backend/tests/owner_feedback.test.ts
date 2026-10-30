import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/owner/feedback/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { prisma } from '@/lib/db/prisma';
import { AuthenticationError, ForbiddenError } from '@/lib/http/errors';
import { encodeFeedbackCursor } from '@/lib/feedback/service';

vi.mock('@/lib/auth/tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tenancy')>();
  return {
    ...actual,
    requireAuthorizedRestaurant: vi.fn(),
  };
});

vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    feedback: {
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    branches: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 8G: Owner Feedback List & Summary API (GET /api/v1/owner/feedback)', () => {
  const authorizedRestaurantId = '11111111-1111-4111-8111-111111111111';
  const unauthorizedRestaurantId = '99999999-9999-4999-8999-999999999999';
  const authorizedBranchId = '22222222-2222-4222-8222-222222222222';
  const foreignBranchId = '33333333-3333-4333-8333-333333333333';

  const mockFeedbackItem1 = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    restaurant_id: authorizedRestaurantId,
    branch_id: authorizedBranchId,
    order_id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo1',
    customer_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    rating: 5,
    comment: 'Exceptional food and service!',
    feedback_type: 'review',
    status: 'published',
    submitted_at: new Date('2026-10-20T12:00:00.000Z'),
    created_at: new Date('2026-10-20T12:00:00.000Z'),
    updated_at: new Date('2026-10-20T12:00:00.000Z'),
    branches: { id: authorizedBranchId, name: 'Downtown Main' },
    orders: { id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo1', order_number: 'ORD-1001' },
    customers: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01', name: 'Alice Smith' },
  };

  const mockFeedbackItem2 = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    restaurant_id: authorizedRestaurantId,
    branch_id: authorizedBranchId,
    order_id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo2',
    customer_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
    rating: 4,
    comment: 'Great ambience, slightly crowded.',
    feedback_type: 'review',
    status: 'published',
    submitted_at: new Date('2026-10-19T14:30:00.000Z'),
    created_at: new Date('2026-10-19T14:30:00.000Z'),
    updated_at: new Date('2026-10-19T14:30:00.000Z'),
    branches: { id: authorizedBranchId, name: 'Downtown Main' },
    orders: { id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo2', order_number: 'ORD-1002' },
    customers: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02', name: 'Bob Jones' },
  };

  const mockFeedbackItem3 = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    restaurant_id: authorizedRestaurantId,
    branch_id: authorizedBranchId,
    order_id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo3',
    customer_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03',
    rating: 4,
    comment: null,
    feedback_type: 'review',
    status: 'published',
    submitted_at: new Date('2026-10-18T10:15:00.000Z'),
    created_at: new Date('2026-10-18T10:15:00.000Z'),
    updated_at: new Date('2026-10-18T10:15:00.000Z'),
    branches: { id: authorizedBranchId, name: 'Downtown Main' },
    orders: { id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo3', order_number: 'ORD-1003' },
    customers: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03', name: 'Charlie Ray' },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuthorizedRestaurant).mockResolvedValue({
      owner: { id: 'owner-uuid-1', role: 'RESTAURANT_OWNER' } as any,
      restaurant: {
        id: authorizedRestaurantId,
        name: 'The Rustic Hearth',
        status: 'active',
      } as any,
      branches: [
        {
          id: authorizedBranchId,
          restaurantId: authorizedRestaurantId,
          name: 'Downtown Main',
          status: 'active',
        } as any,
      ],
    });

    (vi.mocked(prisma.branches.findUnique).mockImplementation as any)(async ({ where }: any) => {
      if (where.id === authorizedBranchId) {
        return {
          id: authorizedBranchId,
          restaurant_id: authorizedRestaurantId,
          name: 'Downtown Main',
          status: 'active',
        } as any;
      }
      if (where.id === foreignBranchId) {
        return {
          id: foreignBranchId,
          restaurant_id: unauthorizedRestaurantId,
          name: 'Foreign Branch',
          status: 'active',
        } as any;
      }
      return null;
    });
  });

  describe('1. Owner can retrieve feedback for their authorized restaurant', () => {
    it('returns 200 with feedback list and summary metrics', async () => {
      vi.mocked(prisma.feedback.count).mockResolvedValue(2);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({
        _avg: { rating: 4.5 },
      } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([
        { rating: 5, _count: { id: 1 } },
        { rating: 4, _count: { id: 1 } },
      ] as any);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([
        mockFeedbackItem1,
        mockFeedbackItem2,
      ] as any);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/feedback?restaurantId=${authorizedRestaurantId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurantId).toBe(authorizedRestaurantId);
      expect(json.data.summary).toEqual({
        totalCount: 2,
        averageRating: 4.5,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 1,
          5: 1,
        },
      });
      expect(json.data.items).toHaveLength(2);
      expect(json.data.items[0]).toEqual({
        id: mockFeedbackItem1.id,
        orderId: mockFeedbackItem1.order_id,
        orderNumber: 'ORD-1001',
        rating: 5,
        comment: 'Exceptional food and service!',
        status: 'published',
        createdAt: '2026-10-20T12:00:00.000Z',
        submittedAt: '2026-10-20T12:00:00.000Z',
        branchId: authorizedBranchId,
        branchName: 'Downtown Main',
        customerName: 'Alice Smith',
      });
      expect(json.data.pagination).toEqual({
        limit: 20,
        nextCursor: null,
        hasMore: false,
      });
    });
  });

  describe('2. Unauthenticated requests are rejected (401)', () => {
    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new AuthenticationError('Invalid or missing authentication credentials')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback');
      const response = await GET(request);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('3. Customer sessions cannot use the owner endpoint (403)', () => {
    it('returns 403 FORBIDDEN when accessed with customer credentials', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new ForbiddenError('Access forbidden: Restaurant owner credentials required')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback');
      const response = await GET(request);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Cross-restaurant IDs are rejected and never leak feedback (403)', () => {
    it('rejects requested restaurantId belonging to another owner', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new ForbiddenError(
          'Access forbidden: You do not have ownership or authorization for this restaurant'
        )
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/feedback?restaurantId=${unauthorizedRestaurantId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('5. Empty restaurants return empty list, averageRating: null, and five zero counts', () => {
    it('returns empty results and correct default metrics for a restaurant with zero feedback', async () => {
      vi.mocked(prisma.feedback.count).mockResolvedValue(0);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({
        _avg: { rating: null },
      } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback');
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.summary).toEqual({
        totalCount: 0,
        averageRating: null,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      });
      expect(json.data.items).toEqual([]);
      expect(json.data.pagination).toEqual({
        limit: 20,
        nextCursor: null,
        hasMore: false,
      });
    });
  });

  describe('6. Rating counts and average are calculated correctly for known fixtures', () => {
    it('calculates rounded averageRating (4.3) and correct distribution for 3 items (ratings: 5, 4, 4)', async () => {
      vi.mocked(prisma.feedback.count).mockResolvedValue(3);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({
        _avg: { rating: 4.333333333333333 },
      } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([
        { rating: 5, _count: { id: 1 } },
        { rating: 4, _count: { id: 2 } },
      ] as any);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([
        mockFeedbackItem1,
        mockFeedbackItem2,
        mockFeedbackItem3,
      ] as any);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback');
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.summary.totalCount).toBe(3);
      expect(json.data.summary.averageRating).toBe(4.3);
      expect(json.data.summary.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 2,
        5: 1,
      });
    });
  });

  describe('7. Pagination returns deterministic results and correct hasMore/cursor behavior', () => {
    it('returns hasMore: true and valid nextCursor when records exceed limit', async () => {
      vi.mocked(prisma.feedback.count).mockResolvedValue(5);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({ _avg: { rating: 4.5 } } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([
        mockFeedbackItem1,
        mockFeedbackItem2,
        mockFeedbackItem3,
      ] as any);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback?limit=2');
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.items).toHaveLength(2);
      expect(json.data.pagination.limit).toBe(2);
      expect(json.data.pagination.hasMore).toBe(true);
      expect(json.data.pagination.nextCursor).toBeTruthy();

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
          orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
        })
      );
    });

    it('processes cursor parameter to seek next page of results', async () => {
      const cursor = encodeFeedbackCursor(mockFeedbackItem1.id, mockFeedbackItem1.submitted_at);

      vi.mocked(prisma.feedback.findFirst).mockResolvedValue({
        id: mockFeedbackItem1.id,
        submitted_at: mockFeedbackItem1.submitted_at,
      } as any);

      vi.mocked(prisma.feedback.count).mockResolvedValue(5);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({ _avg: { rating: 4.0 } } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([mockFeedbackItem2] as any);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/feedback?cursor=${cursor}&limit=1`
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].id).toBe(mockFeedbackItem2.id);

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: authorizedRestaurantId,
            OR: [
              { submitted_at: { lt: mockFeedbackItem1.submitted_at } },
              {
                submitted_at: mockFeedbackItem1.submitted_at,
                id: { lt: mockFeedbackItem1.id },
              },
            ],
          }),
        })
      );
    });
  });

  describe('8. Summary totals are not limited to the current page', () => {
    it('computes summary from all matching records even when limit is 1', async () => {
      vi.mocked(prisma.feedback.count).mockResolvedValue(100);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({ _avg: { rating: 4.8 } } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([
        { rating: 5, _count: { id: 80 } },
        { rating: 4, _count: { id: 20 } },
      ] as any);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([mockFeedbackItem1] as any);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback?limit=1');
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.items).toHaveLength(1);
      expect(json.data.summary.totalCount).toBe(100);
      expect(json.data.summary.averageRating).toBe(4.8);
      expect(json.data.summary.ratingDistribution[5]).toBe(80);
      expect(json.data.summary.ratingDistribution[4]).toBe(20);
    });
  });

  describe('9. Branch/date filters affect both list and summary consistently', () => {
    it('applies branchId filter to count, aggregate, groupBy, and findMany', async () => {
      vi.mocked(prisma.feedback.count).mockResolvedValue(1);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({ _avg: { rating: 5.0 } } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([{ rating: 5, _count: { id: 1 } }] as any);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([mockFeedbackItem1] as any);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/feedback?branchId=${authorizedBranchId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const expectedWhere = {
        restaurant_id: authorizedRestaurantId,
        branch_id: authorizedBranchId,
      };

      expect(prisma.feedback.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(prisma.feedback.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining(expectedWhere),
        })
      );
      expect(prisma.feedback.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining(expectedWhere),
        })
      );
      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining(expectedWhere),
        })
      );
    });

    it('rejects branchId belonging to another restaurant with 403 Forbidden', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/feedback?branchId=${foreignBranchId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('rejects non-existent branchId with 404 Not Found', async () => {
      const unknownBranchId = '44444444-4444-4444-8444-444444444444';
      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/feedback?branchId=${unknownBranchId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(404);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  describe('10. Invalid query parameters produce the standard validation error (400)', () => {
    it('rejects invalid UUID for restaurantId with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback?restaurantId=not-a-uuid');
      const response = await GET(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative or non-numeric limit with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback?limit=-5');
      const response = await GET(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects limit exceeding 100 with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback?limit=101');
      const response = await GET(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects startDate that occurs after endDate with 400 Validation Error', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/owner/feedback?startDate=2026-10-25T00:00:00.000Z&endDate=2026-10-20T00:00:00.000Z'
      );
      const response = await GET(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('11. Database/service failures use the project standard safe error response (500)', () => {
    it('returns safe 500 without leaking stack traces on database error', async () => {
      vi.mocked(prisma.feedback.count).mockRejectedValueOnce(
        new Error('Database connection terminated unexpectedly')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback');
      const response = await GET(request);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(json.error.message).toBe('An unexpected internal server error occurred');
      expect(json.stack).toBeUndefined();
    });
  });

  describe('12. Feedback records with nullable comments or optional fields are handled correctly', () => {
    it('handles nullable comment, null status, and optional branch/order fields cleanly', async () => {
      const feedbackWithNulls = {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        restaurant_id: authorizedRestaurantId,
        branch_id: null,
        order_id: 'oooooooo-oooo-4ooo-8ooo-ooooooooooo4',
        customer_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc04',
        rating: null,
        comment: null,
        feedback_type: 'review',
        status: null,
        submitted_at: new Date('2026-10-17T09:00:00.000Z'),
        created_at: new Date('2026-10-17T09:00:00.000Z'),
        updated_at: new Date('2026-10-17T09:00:00.000Z'),
        branches: null,
        orders: null,
        customers: null,
      };

      vi.mocked(prisma.feedback.count).mockResolvedValue(1);
      vi.mocked(prisma.feedback.aggregate).mockResolvedValue({ _avg: { rating: null } } as any);
      vi.mocked(prisma.feedback.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.feedback.findMany).mockResolvedValue([feedbackWithNulls] as any);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/feedback');
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.items[0]).toEqual({
        id: feedbackWithNulls.id,
        orderId: feedbackWithNulls.order_id,
        orderNumber: null,
        rating: null,
        comment: null,
        status: null,
        createdAt: '2026-10-17T09:00:00.000Z',
        submittedAt: '2026-10-17T09:00:00.000Z',
        branchId: null,
        branchName: null,
        customerName: null,
      });
    });
  });
});
