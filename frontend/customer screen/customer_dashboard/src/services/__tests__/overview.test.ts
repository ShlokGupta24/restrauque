/**
 * Customer Dashboard Overview Service & Live Integration Tests
 * Uses Node.js native test runner via tsx with strict assertions.
 *
 * Verifies Step 7A Requirements:
 * 1. GET /api/v1/customer/dashboard/overview is called with credentials: 'include'.
 * 2. Successful response envelope unwrapping and mapping of customer profile, feedback metrics, loyalty accounts, and recent points activity.
 * 3. Handling of empty customer state (0 visits, 0 feedback, empty loyalty accounts array).
 * 4. Handling of partially populated response data safely.
 * 5. Authentication / session failure (HTTP 401) throws ApiClientError with status 401.
 * 6. Authorization failure (HTTP 403) throws ApiClientError with status 403.
 * 7. Server failure (HTTP 500) throws ApiClientError with recoverable message.
 * 8. Cancellation via AbortSignal is handled cleanly.
 * 9. Restaurant-specific loyalty isolation: points are kept separate per restaurant.
 * 10. Live failure does not fabricate or fall back to mock demo values.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchCustomerDashboardOverview,
  CustomerDashboardOverviewResponse,
} from '../overviewService';
import { ApiClientError } from '../apiClient';

describe('Customer Dashboard Overview Integration (Step 7A)', () => {
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

  // 1. URL and Credentials
  test('1. Overview service calls GET /api/v1/customer/dashboard/overview with credentials: include', async () => {
    let calledUrl = '';
    let calledOptions: any = null;

    globalThis.fetch = ((url: RequestInfo | URL, options?: RequestInit) => {
      calledUrl = String(url);
      calledOptions = options;
      return createMockResponse({
        success: true,
        data: {
          customer: { id: 'cust_1', name: 'Aarav Patel', phone: '+919876543210' },
          feedbackSummary: {
            pendingFeedbackCount: 1,
            submittedFeedbackCount: 4,
            completedOrdersCount: 5,
          },
          loyaltyAccounts: [],
          recentRestaurants: [],
          recentPointsActivity: [],
        },
      });
    }) as typeof fetch;

    const data = await fetchCustomerDashboardOverview();

    assert.equal(calledUrl.endsWith('/api/v1/customer/dashboard/overview'), true);
    assert.equal(calledOptions?.method, 'GET');
    assert.equal(calledOptions?.credentials, 'include');
    assert.equal(data.customer.name, 'Aarav Patel');
  });

  // 2. Full Response Envelope Unwrapping and Field Mapping
  test('2. Correctly unwraps backend envelope and maps profile, metrics, loyalty accounts, and activity', async () => {
    const mockOverview: CustomerDashboardOverviewResponse = {
      customer: {
        id: 'cust_abc_123',
        name: 'Priya Sharma',
        phone: '+919876543211',
      },
      feedbackSummary: {
        pendingFeedbackCount: 2,
        submittedFeedbackCount: 8,
        completedOrdersCount: 10,
      },
      loyaltyAccounts: [
        {
          accountId: 'acc_1',
          restaurantId: 'res_nbc',
          restaurantName: 'NBC Cafe',
          programName: 'Campus Rewards',
          pointsBalance: 350,
          starsBalance: 0,
          lifetimePointsEarned: 500,
          lifetimeStarsEarned: 0,
          lifetimePointsRedeemed: 150,
          lifetimeStarsRedeemed: 0,
          tier: 'Gold',
          status: 'ACTIVE',
        },
        {
          accountId: 'acc_2',
          restaurantId: 'res_bhoj',
          restaurantName: 'The Bhoj Family Restaurant',
          programName: 'Family Dining Club',
          pointsBalance: 200,
          starsBalance: 0,
          lifetimePointsEarned: 300,
          lifetimeStarsEarned: 0,
          lifetimePointsRedeemed: 100,
          lifetimeStarsRedeemed: 0,
          tier: 'Silver',
          status: 'ACTIVE',
        },
      ],
      recentRestaurants: [
        {
          restaurantId: 'res_nbc',
          restaurantName: 'NBC Cafe',
          lastOrderDate: '2026-10-20T14:30:00.000Z',
          visitCount: 7,
        },
      ],
      recentPointsActivity: [
        {
          id: 'tx_1',
          restaurantId: 'res_nbc',
          restaurantName: 'NBC Cafe',
          transactionType: 'EARN_PURCHASE',
          pointsDelta: 50,
          points: 50,
          stars: 0,
          action: 'earn',
          isEarned: true,
          balanceAfter: 350,
          description: 'Dining visit reward',
          createdAt: '2026-10-20T14:35:00.000Z',
        },
      ],
    };

    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: mockOverview,
      });
    }) as typeof fetch;

    const data = await fetchCustomerDashboardOverview();

    // Verify customer profile
    assert.equal(data.customer.id, 'cust_abc_123');
    assert.equal(data.customer.name, 'Priya Sharma');
    assert.equal(data.customer.phone, '+919876543211');

    // Verify feedback summary
    assert.equal(data.feedbackSummary.pendingFeedbackCount, 2);
    assert.equal(data.feedbackSummary.submittedFeedbackCount, 8);
    assert.equal(data.feedbackSummary.completedOrdersCount, 10);

    // Verify loyalty accounts
    assert.equal(data.loyaltyAccounts.length, 2);
    assert.equal(data.loyaltyAccounts[0].restaurantName, 'NBC Cafe');
    assert.equal(data.loyaltyAccounts[0].pointsBalance, 350);
    assert.equal(data.loyaltyAccounts[1].restaurantName, 'The Bhoj Family Restaurant');
    assert.equal(data.loyaltyAccounts[1].pointsBalance, 200);

    // Verify recent points activity
    assert.equal(data.recentPointsActivity.length, 1);
    assert.equal(data.recentPointsActivity[0].action, 'earn');
    assert.equal(data.recentPointsActivity[0].pointsDelta, 50);
    assert.equal(data.recentPointsActivity[0].balanceAfter, 350);
  });

  // 3. Empty Customer State
  test('3. Handles new customer with empty orders, feedback, and loyalty accounts', async () => {
    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: {
          customer: { id: 'cust_new', name: 'New Diner', phone: '+919876543299' },
          feedbackSummary: {
            pendingFeedbackCount: 0,
            submittedFeedbackCount: 0,
            completedOrdersCount: 0,
          },
          loyaltyAccounts: [],
          recentRestaurants: [],
          recentPointsActivity: [],
        },
      });
    }) as typeof fetch;

    const data = await fetchCustomerDashboardOverview();

    assert.equal(data.customer.name, 'New Diner');
    assert.equal(data.feedbackSummary.completedOrdersCount, 0);
    assert.equal(data.feedbackSummary.pendingFeedbackCount, 0);
    assert.equal(data.feedbackSummary.submittedFeedbackCount, 0);
    assert.equal(data.loyaltyAccounts.length, 0);
    assert.equal(data.recentPointsActivity.length, 0);
  });

  // 4. Safe handling of partially populated response data
  test('4. Safe handling of partially populated response data (null phone, empty activity)', async () => {
    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: {
          customer: { id: 'cust_partial', name: 'Walk-in Guest', phone: null },
          feedbackSummary: {
            pendingFeedbackCount: 0,
            submittedFeedbackCount: 1,
            completedOrdersCount: 1,
          },
          loyaltyAccounts: [
            {
              accountId: 'acc_part',
              restaurantId: 'res_1',
              restaurantName: 'Cafe One',
              programName: 'Rewards',
              pointsBalance: 25,
              starsBalance: 0,
              lifetimePointsEarned: 25,
              lifetimeStarsEarned: 0,
              lifetimePointsRedeemed: 0,
              lifetimeStarsRedeemed: 0,
              tier: 'Bronze',
              status: 'ACTIVE',
            },
          ],
          recentRestaurants: [],
          recentPointsActivity: [],
        },
      });
    }) as typeof fetch;

    const data = await fetchCustomerDashboardOverview();

    assert.equal(data.customer.phone, null);
    assert.equal(data.loyaltyAccounts.length, 1);
    assert.equal(data.loyaltyAccounts[0].pointsBalance, 25);
    assert.equal(data.recentPointsActivity.length, 0);
  });

  // 5. Authentication Failure (HTTP 401)
  test('5. Throws ApiClientError with code UNAUTHORIZED on HTTP 401', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required: Missing credentials',
          },
        },
        401
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerDashboardOverview();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        assert.equal(err.message, 'Authentication required: Missing credentials');
        return true;
      }
    );
  });

  // 6. Authorization Failure (HTTP 403)
  test('6. Throws ApiClientError with code FORBIDDEN on HTTP 403', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access forbidden: Requires one of [CUSTOMER] role',
          },
        },
        403
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerDashboardOverview();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  // 7. Server Error (HTTP 500)
  test('7. Throws ApiClientError with recoverable message on HTTP 500', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve customer dashboard overview',
          },
        },
        500
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerDashboardOverview();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 500);
        assert.equal(err.code, 'INTERNAL_SERVER_ERROR');
        return true;
      }
    );
  });

  // 8. AbortSignal Support
  test('8. Respects AbortSignal for request cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      async () => {
        await fetchCustomerDashboardOverview(controller.signal);
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'ABORTED');
        return true;
      }
    );
  });

  // 9. Separate Restaurant Loyalty Isolation
  test('9. Loyalty accounts maintain strict restaurant isolation without pooling points', async () => {
    const mockAccounts = [
      {
        accountId: 'acc_res_1',
        restaurantId: 'res_1',
        restaurantName: 'Restaurant Alpha',
        programName: 'Alpha Club',
        pointsBalance: 120,
        starsBalance: 0,
        lifetimePointsEarned: 120,
        lifetimeStarsEarned: 0,
        lifetimePointsRedeemed: 0,
        lifetimeStarsRedeemed: 0,
        tier: 'Standard',
        status: 'ACTIVE',
      },
      {
        accountId: 'acc_res_2',
        restaurantId: 'res_2',
        restaurantName: 'Restaurant Beta',
        programName: 'Beta Club',
        pointsBalance: 300,
        starsBalance: 0,
        lifetimePointsEarned: 300,
        lifetimeStarsEarned: 0,
        lifetimePointsRedeemed: 0,
        lifetimeStarsRedeemed: 0,
        tier: 'Gold',
        status: 'ACTIVE',
      },
    ];

    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: {
          customer: { id: 'cust_iso', name: 'Tester', phone: '+919999999999' },
          feedbackSummary: { pendingFeedbackCount: 0, submittedFeedbackCount: 0, completedOrdersCount: 2 },
          loyaltyAccounts: mockAccounts,
          recentRestaurants: [],
          recentPointsActivity: [],
        },
      });
    }) as typeof fetch;

    const data = await fetchCustomerDashboardOverview();

    // Verify restaurants are isolated
    assert.equal(data.loyaltyAccounts[0].restaurantId, 'res_1');
    assert.equal(data.loyaltyAccounts[0].pointsBalance, 120);
    assert.equal(data.loyaltyAccounts[1].restaurantId, 'res_2');
    assert.equal(data.loyaltyAccounts[1].pointsBalance, 300);
    assert.notEqual(data.loyaltyAccounts[0].restaurantId, data.loyaltyAccounts[1].restaurantId);
  });

  // 10. No accidental display of mock demo data on failure
  test('10. Service does not fall back to mock demo fixtures when backend fails', async () => {
    globalThis.fetch = (() => {
      throw new Error('Connection refused');
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerDashboardOverview();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });
});
