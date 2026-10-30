/**
 * Restaurant Dashboard Owner Feedback Service Integration Tests
 * Uses Node.js native test runner via tsx and strict assertions.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackService } from '../feedbackService';
import { ApiClientError } from '../apiClient';

describe('Restaurant Dashboard — Owner Feedback Service (Step 8H)', () => {
  const originalFetch = globalThis.fetch;
  let mockFetchCalls: { url: string; options: RequestInit }[] = [];
  let mockFetchResponse: { ok: boolean; status: number; statusText: string; json: any } = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: {},
  };

  beforeEach(() => {
    mockFetchCalls = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      mockFetchCalls.push({ url, options: init || {} });

      return {
        ok: mockFetchResponse.ok,
        status: mockFetchResponse.status,
        statusText: mockFetchResponse.statusText,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockFetchResponse.json,
      } as unknown as Response;
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const sampleBackendFeedback = {
    restaurantId: 'rest-uuid-1',
    summary: {
      totalCount: 2,
      averageRating: 4.5,
      ratingDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 1,
        5: 1,
      },
    },
    items: [
      {
        id: 'fb-uuid-1',
        orderId: 'ord-uuid-1',
        orderNumber: 'ORD-1001',
        rating: 5,
        comment: 'Delicious meal!',
        status: 'published',
        createdAt: '2026-10-20T12:00:00.000Z',
        submittedAt: '2026-10-20T12:00:00.000Z',
        branchId: 'branch-uuid-1',
        branchName: 'Downtown Main',
        customerName: 'Alice Smith',
      },
      {
        id: 'fb-uuid-2',
        orderId: 'ord-uuid-2',
        orderNumber: 'ORD-1002',
        rating: 4,
        comment: null,
        status: 'published',
        createdAt: '2026-10-19T14:30:00.000Z',
        submittedAt: '2026-10-19T14:30:00.000Z',
        branchId: 'branch-uuid-1',
        branchName: 'Downtown Main',
        customerName: null,
      },
    ],
    pagination: {
      limit: 20,
      nextCursor: null,
      hasMore: false,
    },
  };

  test('1. getFeedback calls GET /api/v1/owner/feedback with credentials: include', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleBackendFeedback },
    };

    const res = await feedbackService.getFeedback({ restaurantId: 'rest-uuid-1' });

    assert.equal(mockFetchCalls.length, 1);
    assert.equal(mockFetchCalls[0].options.method, 'GET');
    assert.equal(mockFetchCalls[0].options.credentials, 'include');
    assert.match(mockFetchCalls[0].url, /\/api\/v1\/owner\/feedback\?restaurantId=rest-uuid-1/);
    assert.equal(res.restaurantId, 'rest-uuid-1');
    assert.equal(res.summary.totalCount, 2);
    assert.equal(res.summary.averageRating, 4.5);
    assert.equal(res.items.length, 2);
  });

  test('2. getFeedback omits restaurantId parameter when omitted by caller', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleBackendFeedback },
    };

    await feedbackService.getFeedback();

    assert.equal(mockFetchCalls.length, 1);
    assert.equal(mockFetchCalls[0].url.endsWith('/api/v1/owner/feedback'), true);
  });

  test('3. getFeedback appends branchId when specified and ignores "all"', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleBackendFeedback },
    };

    await feedbackService.getFeedback({ branchId: 'branch-uuid-1' });
    assert.match(mockFetchCalls[0].url, /branchId=branch-uuid-1/);

    await feedbackService.getFeedback({ branchId: 'all' });
    assert.equal(mockFetchCalls[1].url.includes('branchId'), false);
  });

  test('4. getFeedback passes limit, cursor, startDate, and endDate query params', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleBackendFeedback },
    };

    await feedbackService.getFeedback({
      limit: 10,
      cursor: 'cur_abc123',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-07T23:59:59.000Z',
    });

    const callUrl = mockFetchCalls[0].url;
    assert.match(callUrl, /limit=10/);
    assert.match(callUrl, /cursor=cur_abc123/);
    assert.match(callUrl, /startDate=2026-10-01T00%3A00%3A00.000Z/);
    assert.match(callUrl, /endDate=2026-10-07T23%3A59%3A59.000Z/);
  });

  test('5. Handles HTTP 401 Unauthorized throwing ApiClientError', async () => {
    mockFetchResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } },
    };

    await assert.rejects(
      async () => {
        await feedbackService.getFeedback();
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  test('6. Handles HTTP 403 Forbidden for cross-tenant access rejection', async () => {
    mockFetchResponse = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access forbidden: Not your restaurant' },
      },
    };

    await assert.rejects(
      async () => {
        await feedbackService.getFeedback({ restaurantId: 'foreign-id' });
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  test('7. Handles HTTP 500 server error without returning mock fallback', async () => {
    mockFetchResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Database error' },
      },
    };

    await assert.rejects(
      async () => {
        await feedbackService.getFeedback();
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 500);
        return true;
      }
    );
  });

  test('8. Propagates network failure with ApiClientError code NETWORK_ERROR', async () => {
    globalThis.fetch = async () => {
      throw new Error('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await feedbackService.getFeedback();
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert.equal(err.statusCode, 0);
        return true;
      }
    );
  });

  test('9. Respects AbortSignal for request cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = async (_input: any, init?: any) => {
      if (init?.signal?.aborted) {
        const error = new Error('This operation was aborted');
        error.name = 'AbortError';
        throw error;
      }
      return {} as Response;
    };

    await assert.rejects(async () => {
      await feedbackService.getFeedback({ signal: controller.signal });
    });
  });

  test('10. Handles empty restaurant feedback responses (averageRating: null, 0 counts)', async () => {
    const emptyResponse = {
      restaurantId: 'rest-uuid-empty',
      summary: {
        totalCount: 0,
        averageRating: null,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      },
      items: [],
      pagination: {
        limit: 20,
        nextCursor: null,
        hasMore: false,
      },
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: emptyResponse },
    };

    const res = await feedbackService.getFeedback();
    assert.equal(res.summary.totalCount, 0);
    assert.equal(res.summary.averageRating, null);
    assert.equal(res.items.length, 0);
    assert.equal(res.summary.ratingDistribution[1], 0);
    assert.equal(res.summary.ratingDistribution[5], 0);
  });

  test('11. Handles feedback items with null comments, missing order numbers, and optional fields', async () => {
    const itemWithNulls = {
      id: 'fb-uuid-nulls',
      orderId: 'ord-uuid-nulls',
      orderNumber: null,
      rating: null,
      comment: null,
      status: null,
      createdAt: '2026-10-18T10:00:00.000Z',
      submittedAt: '2026-10-18T10:00:00.000Z',
      branchId: null,
      branchName: null,
      customerName: null,
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: {
        success: true,
        data: {
          restaurantId: 'rest-uuid-1',
          summary: {
            totalCount: 1,
            averageRating: null,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          },
          items: [itemWithNulls],
          pagination: { limit: 20, nextCursor: null, hasMore: false },
        },
      },
    };

    const res = await feedbackService.getFeedback();
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].comment, null);
    assert.equal(res.items[0].orderNumber, null);
    assert.equal(res.items[0].rating, null);
    assert.equal(res.items[0].branchName, null);
    assert.equal(res.items[0].customerName, null);
  });

  test('12. Accurately reflects cursor-based pagination metadata (nextCursor, hasMore)', async () => {
    const pagedResponse = {
      restaurantId: 'rest-uuid-1',
      summary: {
        totalCount: 25,
        averageRating: 4.8,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 4, 5: 20 },
      },
      items: [sampleBackendFeedback.items[0]],
      pagination: {
        limit: 1,
        nextCursor: 'cursor_offset_anchor_xyz',
        hasMore: true,
      },
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: pagedResponse },
    };

    const res = await feedbackService.getFeedback({ limit: 1 });
    assert.equal(res.pagination.hasMore, true);
    assert.equal(res.pagination.nextCursor, 'cursor_offset_anchor_xyz');
    assert.equal(res.pagination.limit, 1);
  });

  test('13. Rating distribution percentage logic produces 0% safely when total ratings is 0', () => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const totalRated = dist[1] + dist[2] + dist[3] + dist[4] + dist[5];
    assert.equal(totalRated, 0);

    const rows = [5, 4, 3, 2, 1].map((stars) => {
      const count = dist[stars as 1 | 2 | 3 | 4 | 5];
      const percentage = totalRated > 0 ? Math.round((count / totalRated) * 100) : 0;
      return { stars, count, percentage };
    });

    for (const row of rows) {
      assert.equal(row.percentage, 0);
      assert.equal(row.count, 0);
    }
  });

  test('14. Rating distribution percentage logic calculates rounded proportions for active ratings', () => {
    const dist = { 1: 0, 2: 1, 3: 2, 4: 7, 5: 10 };
    const totalRated = dist[1] + dist[2] + dist[3] + dist[4] + dist[5]; // 20 total
    assert.equal(totalRated, 20);

    const p5 = Math.round((dist[5] / totalRated) * 100);
    const p4 = Math.round((dist[4] / totalRated) * 100);
    const p3 = Math.round((dist[3] / totalRated) * 100);
    const p2 = Math.round((dist[2] / totalRated) * 100);
    const p1 = Math.round((dist[1] / totalRated) * 100);

    assert.equal(p5, 50); // 10/20 = 50%
    assert.equal(p4, 35); // 7/20 = 35%
    assert.equal(p3, 10); // 2/20 = 10%
    assert.equal(p2, 5);  // 1/20 = 5%
    assert.equal(p1, 0);  // 0/20 = 0%
  });

  test('15. Does not fabricate topic or aspect sentiment scores in the service response', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleBackendFeedback },
    };

    const res = await feedbackService.getFeedback();
    // Verify that the response adheres strictly to verified backend contract without synthetic NLP fields
    assert.equal((res as any).topics, undefined);
    assert.equal((res as any).sentimentScore, undefined);
    assert.ok(res.summary);
    assert.ok(res.items);
  });
});
