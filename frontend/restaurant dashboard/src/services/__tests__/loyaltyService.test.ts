/**
 * Restaurant Dashboard Owner Loyalty Rules Integration Tests
 * Uses Node.js native test runner via tsx and strict assertions.
 *
 * Verifies:
 * 1. getLoyaltyRules calls GET /api/v1/owner/loyalty/rules with credentials: 'include'.
 * 2. getLoyaltyRules appends restaurantId when provided, or omits it to let backend resolve primary tenancy.
 * 3. Correct unwrapping of { restaurantId, restaurantName, loyaltyProgram } envelope.
 * 4. updateLoyaltyRules calls PUT /api/v1/owner/loyalty/rules with exact JSON body.
 * 5. updateLoyaltyRules preserves unsupported preview-only fields without fabricating persistence.
 * 6. Error handling: HTTP 401, HTTP 403, HTTP 500, and network failures throw ApiClientError.
 * 7. Cancellation via AbortSignal prevents stale response processing.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loyaltyService, UpdateLoyaltyRulesInput } from '../loyaltyService';
import { ApiClientError } from '../apiClient';

describe('Restaurant Dashboard — Owner Loyalty Rules Service (Step 8F)', () => {
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

  const sampleBackendProgram = {
    id: 'prog-uuid-1',
    restaurantId: 'rest-uuid-1',
    name: 'The Rustic Hearth Rewards',
    description: 'Earn stars on visits and reviews.',
    isActive: true,
    earningMode: 'visit_and_review',
    starsPerVisit: 5,
    starsPerReview: 10,
    redemptionRate: 1.5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  test('1. getLoyaltyRules calls GET /api/v1/owner/loyalty/rules with credentials: include', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: {
        success: true,
        data: {
          restaurantId: 'rest-uuid-1',
          restaurantName: 'The Rustic Hearth',
          loyaltyProgram: sampleBackendProgram,
        },
        timestamp: '2026-10-22T00:00:00.000Z',
      },
    };

    const result = await loyaltyService.getLoyaltyRules({ restaurantId: 'rest-uuid-1' });

    assert.equal(mockFetchCalls.length, 1);
    const call = mockFetchCalls[0];
    assert.ok(call.url.includes('/api/v1/owner/loyalty/rules?restaurantId=rest-uuid-1'));
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.credentials, 'include');

    assert.equal(result.restaurantId, 'rest-uuid-1');
    assert.equal(result.restaurantName, 'The Rustic Hearth');
    assert.equal(result.loyaltyProgram.name, 'The Rustic Hearth Rewards');
    assert.equal(result.loyaltyProgram.redemptionRate, 1.5);
    assert.equal(result.loyaltyProgram.starsPerVisit, 5);
  });

  test('2. getLoyaltyRules omits restaurantId parameter when omitted by caller', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: {
        success: true,
        data: {
          restaurantId: 'primary-rest-uuid',
          restaurantName: 'Primary Restaurant',
          loyaltyProgram: { ...sampleBackendProgram, restaurantId: 'primary-rest-uuid' },
        },
        timestamp: '2026-10-22T00:00:00.000Z',
      },
    };

    const result = await loyaltyService.getLoyaltyRules();

    assert.equal(mockFetchCalls.length, 1);
    const call = mockFetchCalls[0];
    assert.ok(call.url.endsWith('/api/v1/owner/loyalty/rules'));
    assert.ok(!call.url.includes('?restaurantId='));
    assert.equal(result.restaurantId, 'primary-rest-uuid');
  });

  test('3. updateLoyaltyRules calls PUT /api/v1/owner/loyalty/rules with JSON payload', async () => {
    const updatePayload: UpdateLoyaltyRulesInput = {
      name: 'VIP Diner Club',
      description: 'Exclusive dining perks and points.',
      isActive: true,
      earningMode: 'visit_and_review',
      starsPerVisit: 8,
      starsPerReview: 15,
      redemptionRate: 1.25,
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: {
        success: true,
        data: {
          restaurantId: 'rest-uuid-1',
          restaurantName: 'The Rustic Hearth',
          loyaltyProgram: {
            ...sampleBackendProgram,
            ...updatePayload,
            updatedAt: '2026-10-22T10:00:00.000Z',
          },
        },
        timestamp: '2026-10-22T10:00:00.000Z',
      },
    };

    const result = await loyaltyService.updateLoyaltyRules(updatePayload, {
      restaurantId: 'rest-uuid-1',
    });

    assert.equal(mockFetchCalls.length, 1);
    const call = mockFetchCalls[0];
    assert.equal(call.options.method, 'PUT');
    assert.equal(call.options.credentials, 'include');
    assert.ok(call.url.includes('/api/v1/owner/loyalty/rules?restaurantId=rest-uuid-1'));

    const parsedBody = JSON.parse(call.options.body as string);
    assert.equal(parsedBody.name, 'VIP Diner Club');
    assert.equal(parsedBody.starsPerVisit, 8);
    assert.equal(parsedBody.starsPerReview, 15);
    assert.equal(parsedBody.redemptionRate, 1.25);

    assert.equal(result.loyaltyProgram.name, 'VIP Diner Club');
    assert.equal(result.loyaltyProgram.starsPerVisit, 8);
  });

  test('4. updateLoyaltyRules sends only supported fields, leaving preview fields strictly client-side', async () => {
    const updatePayload: UpdateLoyaltyRulesInput = {
      name: 'Updated Program',
      isActive: false,
      starsPerVisit: 0,
      redemptionRate: 2.0,
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: {
        success: true,
        data: {
          restaurantId: 'rest-uuid-1',
          restaurantName: 'The Rustic Hearth',
          loyaltyProgram: { ...sampleBackendProgram, ...updatePayload },
        },
        timestamp: '2026-10-22T10:00:00.000Z',
      },
    };

    await loyaltyService.updateLoyaltyRules(updatePayload);

    const call = mockFetchCalls[0];
    const parsedBody = JSON.parse(call.options.body as string);
    // Assert unsupported fields are NOT in the payload
    assert.equal(parsedBody.tagline, undefined);
    assert.equal(parsedBody.minOrderAmount, undefined);
    assert.equal(parsedBody.tiers, undefined);
    assert.equal(parsedBody.expiryWindow, undefined);
    assert.equal(parsedBody.starsPerSpend, undefined);
  });

  test('5. Handles HTTP 401 Unauthorized throwing ApiClientError', async () => {
    mockFetchResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required: Session expired' },
        timestamp: '2026-10-22T00:00:00.000Z',
      },
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyRules({ restaurantId: 'rest-uuid-1' });
      },
      (err: ApiClientError) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        assert.ok(err.message.includes('Session expired'));
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
        error: { code: 'FORBIDDEN', message: 'You do not have access to this restaurant' },
        timestamp: '2026-10-22T00:00:00.000Z',
      },
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyRules({ restaurantId: 'unauthorized-uuid' });
      },
      (err: ApiClientError) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        assert.ok(err.message.includes('not have access'));
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
        error: { code: 'INTERNAL_ERROR', message: 'Database connection failed' },
        timestamp: '2026-10-22T00:00:00.000Z',
      },
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyRules();
      },
      (err: ApiClientError) => {
        assert.equal(err.statusCode, 500);
        return true;
      }
    );
  });

  test('8. Propagates network failure with ApiClientError code NETWORK_ERROR', async () => {
    globalThis.fetch = async (): Promise<Response> => {
      throw new Error('Connection refused at localhost:3000');
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyRules();
      },
      (err: ApiClientError) => {
        assert.equal(err.statusCode, 0);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert.ok(err.message.includes('Unable to connect to the server'));
        return true;
      }
    );
  });

  test('9. Respects AbortSignal for request cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (init?.signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: {} }),
      } as unknown as Response;
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyRules({ signal: controller.signal });
      },
      (err: any) => {
        assert.equal(err.name, 'ApiClientError');
        return true;
      }
    );
  });

  test('10. updateLoyaltyRules maps all backend earningMode enum variants properly', async () => {
    const modes: ('visit_and_review' | 'visit_only' | 'review_only')[] = [
      'visit_and_review',
      'visit_only',
      'review_only',
    ];

    for (const mode of modes) {
      mockFetchCalls = [];
      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: {
          success: true,
          data: {
            restaurantId: 'rest-uuid-1',
            restaurantName: 'The Rustic Hearth',
            loyaltyProgram: { ...sampleBackendProgram, earningMode: mode },
          },
          timestamp: '2026-10-22T00:00:00.000Z',
        },
      };

      const res = await loyaltyService.updateLoyaltyRules({ earningMode: mode });
      const call = mockFetchCalls[0];
      const parsed = JSON.parse(call.options.body as string);
      assert.equal(parsed.earningMode, mode);
      assert.equal(res.loyaltyProgram.earningMode, mode);
    }
  });

  test('11. Preserves decimal precision on redemptionRate in backend responses and updates', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: {
        success: true,
        data: {
          restaurantId: 'rest-uuid-1',
          restaurantName: 'The Rustic Hearth',
          loyaltyProgram: { ...sampleBackendProgram, redemptionRate: 0.75 },
        },
        timestamp: '2026-10-22T00:00:00.000Z',
      },
    };

    const res = await loyaltyService.updateLoyaltyRules({ redemptionRate: 0.75 });
    assert.equal(res.loyaltyProgram.redemptionRate, 0.75);
    const parsed = JSON.parse(mockFetchCalls[0].options.body as string);
    assert.equal(parsed.redemptionRate, 0.75);
  });
});

describe('Restaurant Dashboard — Owner Loyalty Accounts & Ledger Service (Step 8K)', () => {
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

  const sampleAccountsResponse = {
    restaurantId: 'rest-uuid-1',
    summary: {
      totalEnrolledAccounts: 48,
      activeAccounts: 45,
      totalPointsInCirculation: 12500,
      totalLifetimePointsEarned: 24000,
      totalLifetimePointsRedeemed: 11500,
    },
    accounts: [
      {
        id: 'acc-uuid-1',
        customerId: 'cust-uuid-1',
        customerName: 'Aarav Kapoor',
        starsBalance: 420,
        lifetimeStarsEarned: 620,
        lifetimeStarsRedeemed: 200,
        tier: 'gold',
        status: 'active',
        joinedAt: '2026-08-15T10:00:00.000Z',
        createdAt: '2026-08-15T10:00:00.000Z',
        updatedAt: '2026-10-20T12:00:00.000Z',
      },
      {
        id: 'acc-uuid-2',
        customerId: 'cust-uuid-2',
        customerName: 'Priya Sharma',
        starsBalance: 180,
        lifetimeStarsEarned: 180,
        lifetimeStarsRedeemed: 0,
        tier: 'standard',
        status: 'active',
        joinedAt: '2026-09-01T14:30:00.000Z',
        createdAt: '2026-09-01T14:30:00.000Z',
        updatedAt: '2026-09-01T14:30:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      totalCount: 48,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    },
  };

  const sampleAccountDetailResponse = {
    restaurantId: 'rest-uuid-1',
    account: {
      id: 'acc-uuid-1',
      customerId: 'cust-uuid-1',
      customerName: 'Aarav Kapoor',
      restaurantId: 'rest-uuid-1',
      loyaltyProgramId: 'prog-uuid-1',
      programName: 'VIP Dining Club',
      starsBalance: 420,
      lifetimeStarsEarned: 620,
      lifetimeStarsRedeemed: 200,
      tier: 'gold',
      status: 'active',
      joinedAt: '2026-08-15T10:00:00.000Z',
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
    },
    transactions: [
      {
        id: 'tx-uuid-1',
        transactionType: 'visit_reward',
        stars: 20,
        description: 'Spend reward (Order #ORD-101)',
        orderId: 'ord-uuid-1',
        orderNumber: 'ORD-101',
        feedbackId: null,
        createdAt: '2026-10-20T12:00:00.000Z',
      },
      {
        id: 'tx-uuid-2',
        transactionType: 'redemption',
        stars: -50,
        description: 'Redeemed 50 points for dining discount (Order #ORD-095)',
        orderId: 'ord-uuid-2',
        orderNumber: 'ORD-095',
        feedbackId: null,
        createdAt: '2026-10-18T18:30:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      totalCount: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  test('1. getLoyaltyAccounts constructs correct endpoint URL and query parameters', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleAccountsResponse, timestamp: '2026-10-23T00:00:00.000Z' },
    };

    const result = await loyaltyService.getLoyaltyAccounts({
      restaurantId: 'rest-uuid-1',
      page: 2,
      limit: 15,
      search: 'Aarav',
      status: 'active',
    });

    assert.equal(mockFetchCalls.length, 1);
    const call = mockFetchCalls[0];
    assert.ok(call.url.includes('/api/v1/owner/loyalty/accounts?'));
    assert.ok(call.url.includes('restaurantId=rest-uuid-1'));
    assert.ok(call.url.includes('page=2'));
    assert.ok(call.url.includes('limit=15'));
    assert.ok(call.url.includes('search=Aarav'));
    assert.ok(call.url.includes('status=active'));
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.credentials, 'include');

    assert.equal(result.accounts.length, 2);
    assert.equal(result.summary.totalEnrolledAccounts, 48);
    assert.equal(result.summary.totalPointsInCirculation, 12500);
    assert.equal(result.pagination.totalPages, 3);
  });

  test('2. getLoyaltyAccounts omits query parameters when not provided', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleAccountsResponse, timestamp: '2026-10-23T00:00:00.000Z' },
    };

    await loyaltyService.getLoyaltyAccounts();

    assert.equal(mockFetchCalls.length, 1);
    assert.equal(mockFetchCalls[0].url.endsWith('/api/v1/owner/loyalty/accounts'), true);
  });

  test('3. getLoyaltyAccounts safely parses empty account lists without calculating bogus client metrics', async () => {
    const emptyResponse = {
      restaurantId: 'rest-uuid-empty',
      summary: {
        totalEnrolledAccounts: 0,
        activeAccounts: 0,
        totalPointsInCirculation: 0,
        totalLifetimePointsEarned: 0,
        totalLifetimePointsRedeemed: 0,
      },
      accounts: [],
      pagination: {
        page: 1,
        limit: 20,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: emptyResponse, timestamp: '2026-10-23T00:00:00.000Z' },
    };

    const res = await loyaltyService.getLoyaltyAccounts({ restaurantId: 'rest-uuid-empty' });
    assert.equal(res.accounts.length, 0);
    assert.equal(res.summary.totalEnrolledAccounts, 0);
    assert.equal(res.summary.totalPointsInCirculation, 0);
    assert.equal(res.pagination.totalCount, 0);
  });

  test('4. getLoyaltyAccounts throws ApiClientError on HTTP 401, 403, and 500 without mock fallback', async () => {
    const testCases = [
      { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 403, code: 'FORBIDDEN', message: 'Access forbidden: Not restaurant owner' },
      { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Database connection failed' },
    ];

    for (const tc of testCases) {
      mockFetchResponse = {
        ok: false,
        status: tc.status,
        statusText: tc.code,
        json: {
          success: false,
          error: { code: tc.code, message: tc.message },
          timestamp: '2026-10-23T00:00:00.000Z',
        },
      };

      await assert.rejects(
        async () => {
          await loyaltyService.getLoyaltyAccounts();
        },
        (err: any) => {
          assert.equal(err instanceof ApiClientError, true);
          assert.equal(err.statusCode, tc.status);
          assert.equal(err.code, tc.code);
          return true;
        }
      );
    }
  });

  test('5. getLoyaltyAccounts propagates network errors properly', async () => {
    globalThis.fetch = async (): Promise<Response> => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyAccounts();
      },
      (err: any) => {
        assert.equal(err instanceof ApiClientError, true);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });

  test('6. getLoyaltyAccounts respects AbortSignal for request cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (init?.signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: {} }),
      } as unknown as Response;
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyAccounts({ signal: controller.signal });
      },
      (err: any) => {
        assert.equal(err.name, 'ApiClientError');
        return true;
      }
    );
  });

  test('7. getLoyaltyAccountDetail calls GET /api/v1/owner/loyalty/accounts/:accountId with clean encoding', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleAccountDetailResponse, timestamp: '2026-10-23T00:00:00.000Z' },
    };

    const result = await loyaltyService.getLoyaltyAccountDetail('acc-uuid-1', {
      restaurantId: 'rest-uuid-1',
      page: 1,
      limit: 10,
    });

    assert.equal(mockFetchCalls.length, 1);
    const call = mockFetchCalls[0];
    assert.ok(call.url.includes('/api/v1/owner/loyalty/accounts/acc-uuid-1?'));
    assert.ok(call.url.includes('restaurantId=rest-uuid-1'));
    assert.ok(call.url.includes('page=1'));
    assert.ok(call.url.includes('limit=10'));
    assert.equal(call.options.method, 'GET');
    assert.equal(call.options.credentials, 'include');

    assert.equal(result.account.id, 'acc-uuid-1');
    assert.equal(result.account.customerName, 'Aarav Kapoor');
    assert.equal(result.transactions.length, 2);
  });

  test('8. getLoyaltyAccountDetail parses signed points and null optional fields accurately', async () => {
    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: sampleAccountDetailResponse, timestamp: '2026-10-23T00:00:00.000Z' },
    };

    const result = await loyaltyService.getLoyaltyAccountDetail('acc-uuid-1');

    const txEarn = result.transactions[0];
    assert.equal(txEarn.transactionType, 'visit_reward');
    assert.equal(txEarn.stars, 20);
    assert.equal(txEarn.orderNumber, 'ORD-101');
    assert.equal(txEarn.feedbackId, null);

    const txRedeem = result.transactions[1];
    assert.equal(txRedeem.transactionType, 'redemption');
    assert.equal(txRedeem.stars, -50);
    assert.equal(txRedeem.orderNumber, 'ORD-095');
  });

  test('9. getLoyaltyAccountDetail handles empty transactions ledger', async () => {
    const emptyDetail = {
      ...sampleAccountDetailResponse,
      transactions: [],
      pagination: {
        page: 1,
        limit: 20,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };

    mockFetchResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { success: true, data: emptyDetail, timestamp: '2026-10-23T00:00:00.000Z' },
    };

    const result = await loyaltyService.getLoyaltyAccountDetail('acc-uuid-1');
    assert.equal(result.transactions.length, 0);
    assert.equal(result.pagination.totalCount, 0);
  });

  test('10. getLoyaltyAccountDetail throws ApiClientError on 404 or 403 without mock fallback', async () => {
    mockFetchResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Loyalty account not found' },
        timestamp: '2026-10-23T00:00:00.000Z',
      },
    };

    await assert.rejects(
      async () => {
        await loyaltyService.getLoyaltyAccountDetail('nonexistent-uuid');
      },
      (err: any) => {
        assert.equal(err instanceof ApiClientError, true);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );
  });
});

