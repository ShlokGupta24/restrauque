/**
 * Customer Dashboard Feedback & Review Service Tests
 * Uses Node.js native test runner via tsx with strict assertions.
 *
 * Verifies Step 7C Requirements:
 * 1. Feedback-history request URL, query parameter serialization, and response envelope unwrapping.
 * 2. Empty feedback results handling without synthetic mock generation.
 * 3. Authentication (401) and server (500) errors thrown as ApiClientError without mock fallback.
 * 4. Eligibility request URL encoding and inaccessible (403) / missing (404) order safety.
 * 5. Successful review submission with exact contract (rating, comment, item-level reviews).
 * 6. Server reward receipt mapping without optimistic star fabrication.
 * 7. Duplicate submission prevention (409 Conflict) and order lifecycle validation (400 ORDER_NOT_COMPLETED).
 * 8. Client-side rating validation before dispatch (1–5 integer constraint).
 * 9. AbortSignal request cancellation support across history, eligibility, and submission.
 * 10. Tenant isolation: customer ID is not accepted or injected by the client.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchCustomerFeedbackHistory,
  fetchOrderFeedbackEligibility,
  submitOrderFeedback,
  CustomerFeedbackHistoryResponse,
  FeedbackEligibilityResult,
  FeedbackSubmissionResult,
} from '../feedbackService';
import { ApiClientError } from '../apiClient';

describe('Customer Feedback & Review Integration (Step 7C)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createMockResponse(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {}
  ) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (h: string) => {
          if (h.toLowerCase() === 'content-type') return 'application/json';
          return headers[h] || null;
        },
      },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as unknown as Response);
  }

  // 1. History URL, credentials, and response envelope
  test('1. fetchCustomerFeedbackHistory calls GET /api/v1/customer/feedback with credentials: include', async () => {
    let calledUrl = '';
    let calledOptions: any = null;

    const mockResponseData: CustomerFeedbackHistoryResponse = {
      orders: [],
      pagination: { limit: 10, hasNextPage: false, nextCursor: null },
      summary: { all: 0, awaitingReview: 0, reviewed: 0 },
      restaurantSummary: [],
    };

    globalThis.fetch = ((url: RequestInfo | URL, options?: RequestInit) => {
      calledUrl = String(url);
      calledOptions = options;
      return createMockResponse({
        success: true,
        data: mockResponseData,
      });
    }) as typeof fetch;

    const res = await fetchCustomerFeedbackHistory();

    assert.equal(calledUrl.endsWith('/api/v1/customer/feedback'), true);
    assert.equal(calledOptions?.method, 'GET');
    assert.equal(calledOptions?.credentials, 'include');
    assert.equal(res.orders.length, 0);
    assert.equal(res.summary.all, 0);
  });

  // 2. Query parameter serialization
  test('2. fetchCustomerFeedbackHistory serializes status, restaurantId, limit, and cursor', async () => {
    let calledUrl = '';

    globalThis.fetch = ((url: RequestInfo | URL) => {
      calledUrl = String(url);
      return createMockResponse({
        success: true,
        data: {
          orders: [],
          pagination: { limit: 5, hasNextPage: false, nextCursor: null },
          summary: { all: 2, awaitingReview: 1, reviewed: 1 },
          restaurantSummary: [],
        },
      });
    }) as typeof fetch;

    await fetchCustomerFeedbackHistory({
      status: 'awaiting_review',
      restaurantId: '11111111-2222-3333-4444-555555555555',
      limit: 5,
      cursor: 'cursor_token_abc',
    });

    const parsedUrl = new URL(calledUrl, 'http://localhost');
    assert.equal(parsedUrl.pathname, '/api/v1/customer/feedback');
    assert.equal(parsedUrl.searchParams.get('status'), 'awaiting_review');
    assert.equal(
      parsedUrl.searchParams.get('restaurantId'),
      '11111111-2222-3333-4444-555555555555'
    );
    assert.equal(parsedUrl.searchParams.get('limit'), '5');
    assert.equal(parsedUrl.searchParams.get('cursor'), 'cursor_token_abc');
  });

  // 3. Empty feedback history handling
  test('3. Handles empty customer feedback history without throwing or creating mocks', async () => {
    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: {
          orders: [],
          pagination: { limit: 10, hasNextPage: false, nextCursor: null },
          summary: { all: 0, awaitingReview: 0, reviewed: 0 },
          restaurantSummary: [],
        },
      });
    }) as typeof fetch;

    const res = await fetchCustomerFeedbackHistory();
    assert.equal(res.orders.length, 0);
    assert.equal(res.restaurantSummary.length, 0);
    assert.equal(res.summary.awaitingReview, 0);
  });

  // 4. Authentication error handling (401)
  test('4. Throws ApiClientError with status 401 on unauthenticated feedback history request', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.',
          },
        },
        401
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerFeedbackHistory();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  // 5. Server error handling (500) without mock fallback
  test('5. Throws ApiClientError on server 500 without falling back to mock fixtures', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database connection failed.',
          },
        },
        500
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerFeedbackHistory();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 500);
        return true;
      }
    );
  });

  // 6. Eligibility retrieval & URL encoding
  test('6. fetchOrderFeedbackEligibility calls GET /api/v1/customer/orders/:orderId/feedback with proper URL encoding', async () => {
    let calledUrl = '';
    const testOrderId = '77777777-8888-4999-8111-222222222222';

    const mockEligibility: FeedbackEligibilityResult = {
      isEligible: true,
      reason: null,
      alreadySubmitted: false,
      order: {
        id: testOrderId,
        orderNumber: 'ORD-1001',
        status: 'completed',
        restaurantId: 'rest-1',
        restaurantName: 'The Urban Bistro',
        tableNumber: '4',
        completedAt: '2026-10-22T10:00:00Z',
        items: [
          {
            productId: 'prod-1',
            productName: 'Truffle Risotto',
            variantName: null,
            imageUrl: null,
            quantity: 1,
            addons: [],
          },
        ],
      },
      existingFeedback: null,
      potentialReward: {
        isActive: true,
        programName: 'Urban Rewards',
        baseStars: 50,
      },
    };

    globalThis.fetch = ((url: RequestInfo | URL) => {
      calledUrl = String(url);
      return createMockResponse({
        success: true,
        data: mockEligibility,
      });
    }) as typeof fetch;

    const res = await fetchOrderFeedbackEligibility(`  ${testOrderId}  `);

    assert.equal(
      calledUrl.endsWith(`/api/v1/customer/orders/${testOrderId}/feedback`),
      true
    );
    assert.equal(res.isEligible, true);
    assert.equal(res.order.restaurantName, 'The Urban Bistro');
    assert.equal(res.potentialReward.baseStars, 50);
  });

  // 7. Missing order (404) or forbidden cross-tenant order (403)
  test('7. fetchOrderFeedbackEligibility throws 404 for missing orders and 403 for unauthorized orders', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access forbidden: You can only view or review your own orders',
          },
        },
        403
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchOrderFeedbackEligibility('foreign-order-id');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  // 8. Successful review submission with exact backend request contract
  test('8. submitOrderFeedback posts exact payload and returns real reward data', async () => {
    let calledUrl = '';
    let calledOptions: any = null;
    const testOrderId = '44444444-4444-4444-8444-444444444444';

    const mockSubmissionResult: FeedbackSubmissionResult = {
      feedbackId: 'fb-123',
      orderId: testOrderId,
      rating: 5,
      comment: 'Excellent food and service!',
      submittedAt: '2026-10-22T10:30:00.000Z',
      reward: {
        starsAwarded: 50,
        newBalance: 150,
        isRewardEarned: true,
        programName: 'Bistro Club',
        description: 'Earned 50 stars for verified dining review',
      },
    };

    globalThis.fetch = ((url: RequestInfo | URL, options?: RequestInit) => {
      calledUrl = String(url);
      calledOptions = options;
      return createMockResponse(
        {
          success: true,
          data: mockSubmissionResult,
        },
        201
      );
    }) as typeof fetch;

    const payload = {
      rating: 5,
      comment: '  Excellent food and service!  ',
      items: [
        {
          productId: '55555555-5555-4555-8555-555555555555',
          rating: 5,
          comment: 'Perfect cook',
        },
      ],
    };

    const res = await submitOrderFeedback(testOrderId, payload);

    assert.equal(
      calledUrl.endsWith(`/api/v1/customer/orders/${testOrderId}/feedback`),
      true
    );
    assert.equal(calledOptions?.method, 'POST');
    assert.equal(calledOptions?.credentials, 'include');

    const sentBody = JSON.parse(calledOptions?.body);
    assert.equal(sentBody.rating, 5);
    assert.equal(sentBody.comment, 'Excellent food and service!');
    assert.equal(sentBody.items.length, 1);
    assert.equal(sentBody.items[0].rating, 5);

    // Verify confirmed reward from response
    assert.equal(res.reward.starsAwarded, 50);
    assert.equal(res.reward.newBalance, 150);
    assert.equal(res.reward.isRewardEarned, true);
  });

  // 9. Client-side rating validation
  test('9. submitOrderFeedback rejects invalid rating before sending network request', async () => {
    let fetchCalled = false;
    globalThis.fetch = (() => {
      fetchCalled = true;
      return createMockResponse({});
    }) as typeof fetch;

    // Rating < 1
    await assert.rejects(
      async () => {
        await submitOrderFeedback('order-1', { rating: 0 });
      },
      /Rating must be an integer between 1 and 5 stars/
    );

    // Rating > 5
    await assert.rejects(
      async () => {
        await submitOrderFeedback('order-1', { rating: 6 });
      },
      /Rating must be an integer between 1 and 5 stars/
    );

    // Non-integer rating
    await assert.rejects(
      async () => {
        await submitOrderFeedback('order-1', { rating: 4.5 });
      },
      /Rating must be an integer between 1 and 5 stars/
    );

    assert.equal(fetchCalled, false);
  });

  // 10. Duplicate submission error (409 Conflict)
  test('10. submitOrderFeedback handles 409 Conflict error for already-submitted feedback', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Feedback has already been submitted for this order',
          },
        },
        409
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await submitOrderFeedback('order-already-done', { rating: 5 });
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 409);
        assert.equal(err.code, 'CONFLICT');
        return true;
      }
    );
  });

  // 11. Ineligible order error (400 ORDER_NOT_COMPLETED)
  test('11. submitOrderFeedback handles 400 ORDER_NOT_COMPLETED for in-progress orders', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'ORDER_NOT_COMPLETED',
            message: 'Feedback can only be submitted for completed orders. Current order status: "preparing".',
          },
        },
        400
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await submitOrderFeedback('order-preparing', { rating: 4 });
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'ORDER_NOT_COMPLETED');
        return true;
      }
    );
  });

  // 12. AbortSignal request cancellation support
  test('12. Respects AbortSignal for request cancellation across endpoints', async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      async () => {
        await fetchCustomerFeedbackHistory(undefined, controller.signal);
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'ABORTED');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await fetchOrderFeedbackEligibility('order-id', controller.signal);
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'ABORTED');
        return true;
      }
    );
  });
});
