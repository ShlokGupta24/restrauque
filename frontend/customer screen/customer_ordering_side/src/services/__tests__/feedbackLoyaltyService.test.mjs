import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOrderFeedbackEligibility,
  submitOrderFeedback,
  isValidUuid,
} from '../feedbackService.ts';
import {
  fetchCustomerLoyalty,
} from '../loyaltyService.ts';
import { ApiClientError } from '../apiClient.ts';

describe('Restrauque Customer Feedback & Loyalty Services', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const validOrderId = '11111111-1111-4111-8111-111111111111';
  const validRestaurantId = '22222222-2222-4222-8222-222222222222';
  const validProductId = '33333333-3333-4333-8333-333333333333';
  const validSecondProductId = '44444444-4444-4444-8444-444444444444';

  const sampleEligibilityResponse = {
    isEligible: true,
    reason: null,
    alreadySubmitted: false,
    order: {
      id: validOrderId,
      orderNumber: 'ORD-20261018-0042',
      status: 'completed',
      restaurantId: validRestaurantId,
      restaurantName: 'The Truffle Table',
      tableNumber: '14A',
      completedAt: '2026-10-18T14:30:00.000Z',
      items: [
        {
          productId: validProductId,
          productName: 'Truffle Tagliatelle',
          variantName: 'Full Portion',
          imageUrl: 'https://example.com/pasta.jpg',
          quantity: 2,
          addons: ['Parmigiano Reggiano'],
        },
      ],
    },
    existingFeedback: null,
    potentialReward: {
      isActive: true,
      programName: 'Dine Rewards',
      baseStars: 10,
    },
  };

  const sampleSubmissionSuccessResponse = {
    feedbackId: '55555555-5555-4555-8555-555555555555',
    orderId: validOrderId,
    rating: 5,
    comment: 'Exceptional dining experience!',
    submittedAt: '2026-10-18T14:35:00.000Z',
    reward: {
      starsAwarded: 10,
      newBalance: 45,
      isRewardEarned: true,
      programName: 'Dine Rewards',
      description: 'Earned 10 stars for order review',
    },
  };

  const sampleLoyaltyResponse = {
    accountId: '66666666-6666-4666-8666-666666666666',
    customerId: '77777777-7777-4777-8777-777777777777',
    restaurantId: validRestaurantId,
    programName: 'Dine Rewards',
    starsBalance: 45,
    lifetimeStarsEarned: 60,
    lifetimeStarsRedeemed: 15,
    tier: 'Gold',
    status: 'active',
    recentTransactions: [
      {
        id: 'tx-1',
        transactionType: 'feedback_reward',
        stars: 10,
        description: 'Earned 10 stars for order review',
        createdAt: '2026-10-18T14:35:00.000Z',
      },
    ],
  };

  // ==========================================================================
  // 1. Feedback Eligibility Tests (fetchOrderFeedbackEligibility)
  // ==========================================================================
  describe('fetchOrderFeedbackEligibility', () => {
    test('1. Calls GET /api/v1/customer/orders/[orderId]/feedback with credentials and returns eligibility', async () => {
      let requestedUrl = '';
      let requestedInit = null;

      globalThis.fetch = async (url, init) => {
        requestedUrl = String(url);
        requestedInit = init;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: sampleEligibilityResponse }),
        };
      };

      const result = await fetchOrderFeedbackEligibility(validOrderId);

      assert.ok(requestedUrl.includes(`/api/v1/customer/orders/${validOrderId}/feedback`));
      assert.equal(requestedInit.method, 'GET');
      assert.equal(requestedInit.credentials, 'include');
      assert.equal(result.isEligible, true);
      assert.equal(result.order.id, validOrderId);
      assert.equal(result.potentialReward.baseStars, 10);
      assert.equal(result.order.items.length, 1);
    });

    test('2. Fast-fails without HTTP call when orderId is missing or non-UUID', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility(''),
        (err) => err instanceof ApiClientError && err.code === 'INVALID_ORDER_ID'
      );

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility('ord-not-a-uuid'),
        (err) => err instanceof ApiClientError && err.code === 'INVALID_ORDER_ID'
      );

      assert.equal(fetchCalled, false);
    });

    test('3. Propagates 404 NOT_FOUND when order does not exist', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        }),
      });

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility(validOrderId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 404);
          assert.equal(err.code, 'NOT_FOUND');
          assert.equal(err.message, 'Order not found');
          return true;
        }
      );
    });

    test('4. Propagates 403 FORBIDDEN when customer does not own order', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access forbidden: You can only view your own orders' },
        }),
      });

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility(validOrderId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 403);
          assert.equal(err.code, 'FORBIDDEN');
          assert.equal(err.message, 'Access forbidden: You can only view your own orders');
          return true;
        }
      );
    });

    test('5. Propagates 401 UNAUTHORIZED when session is missing', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Customer session required' },
        }),
      });

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility(validOrderId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 401);
          assert.equal(err.code, 'UNAUTHORIZED');
          return true;
        }
      );
    });

    test('6. Correctly returns alreadySubmitted: true and existingFeedback details', async () => {
      const submittedResponse = {
        ...sampleEligibilityResponse,
        isEligible: false,
        alreadySubmitted: true,
        reason: 'Feedback has already been submitted for this order',
        existingFeedback: {
          id: 'fb-100',
          rating: 4,
          comment: 'Really enjoyed the pasta!',
          submittedAt: '2026-10-18T12:00:00.000Z',
          itemFeedback: [{ productId: validProductId, rating: 5, comment: 'Cooked al dente' }],
        },
      };

      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: submittedResponse }),
      });

      const result = await fetchOrderFeedbackEligibility(validOrderId);
      assert.equal(result.isEligible, false);
      assert.equal(result.alreadySubmitted, true);
      assert.equal(result.existingFeedback.rating, 4);
      assert.equal(result.existingFeedback.itemFeedback[0].productId, validProductId);
    });

    test('7. Fails cleanly on network drop and does not fall back to mock order fixtures', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility(validOrderId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'NETWORK_ERROR');
          return true;
        }
      );
    });

    test('8. Supports request cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      await assert.rejects(
        async () => await fetchOrderFeedbackEligibility(validOrderId, controller.signal),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'ABORTED');
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 2. Feedback Submission Tests (submitOrderFeedback)
  // ==========================================================================
  describe('submitOrderFeedback', () => {
    test('1. Sends strict backend-conforming payload to POST /api/v1/customer/orders/[orderId]/feedback', async () => {
      let requestedUrl = '';
      let requestedInit = null;

      globalThis.fetch = async (url, init) => {
        requestedUrl = String(url);
        requestedInit = init;
        return {
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: sampleSubmissionSuccessResponse }),
        };
      };

      const result = await submitOrderFeedback(validOrderId, {
        rating: 5,
        comment: 'Exceptional dining experience!',
        items: [
          {
            productId: validProductId,
            rating: 5,
            comment: 'Perfect seasoning',
          },
        ],
      });

      assert.ok(requestedUrl.includes(`/api/v1/customer/orders/${validOrderId}/feedback`));
      assert.equal(requestedInit.method, 'POST');
      assert.equal(requestedInit.credentials, 'include');

      const parsedBody = JSON.parse(requestedInit.body);
      assert.equal(parsedBody.rating, 5);
      assert.equal(parsedBody.comment, 'Exceptional dining experience!');
      assert.equal(parsedBody.items.length, 1);
      assert.equal(parsedBody.items[0].productId, validProductId);
      assert.equal(parsedBody.items[0].rating, 5);
      assert.equal(parsedBody.items[0].comment, 'Perfect seasoning');

      assert.equal(result.feedbackId, sampleSubmissionSuccessResponse.feedbackId);
      assert.equal(result.reward.starsAwarded, 10);
      assert.equal(result.reward.newBalance, 45);
    });

    test('2. Fast-fails without HTTP call when overall rating is missing or out of bounds (1-5)', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 0 }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 6 }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 3.5 }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      assert.equal(fetchCalled, false);
    });

    test('3. Fast-fails without HTTP call when overall comment exceeds 1000 characters', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      const longComment = 'a'.repeat(1001);
      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 5, comment: longComment }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      assert.equal(fetchCalled, false);
    });

    test('4. Fast-fails without HTTP call when an item has invalid non-UUID productId', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      await assert.rejects(
        async () =>
          await submitOrderFeedback(validOrderId, {
            rating: 5,
            items: [{ productId: 'invalid-id', rating: 5 }],
          }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      assert.equal(fetchCalled, false);
    });

    test('5. Fast-fails without HTTP call when duplicate product reviews exist in items', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      await assert.rejects(
        async () =>
          await submitOrderFeedback(validOrderId, {
            rating: 5,
            items: [
              { productId: validProductId, rating: 5 },
              { productId: validProductId, rating: 4 },
            ],
          }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      assert.equal(fetchCalled, false);
    });

    test('6. Fast-fails without HTTP call when an item rating is outside 1..5', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      await assert.rejects(
        async () =>
          await submitOrderFeedback(validOrderId, {
            rating: 5,
            items: [{ productId: validProductId, rating: 0 }],
          }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      assert.equal(fetchCalled, false);
    });

    test('7. Fast-fails without HTTP call when an item comment exceeds 500 characters', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      const longItemComment = 'b'.repeat(501);
      await assert.rejects(
        async () =>
          await submitOrderFeedback(validOrderId, {
            rating: 5,
            items: [{ productId: validProductId, rating: 5, comment: longItemComment }],
          }),
        (err) => err instanceof ApiClientError && err.code === 'VALIDATION_ERROR'
      );

      assert.equal(fetchCalled, false);
    });

    test('8. Propagates 400 ORDER_NOT_COMPLETED when order is not yet finished', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'ORDER_NOT_COMPLETED',
            message: 'Feedback can only be submitted for completed orders. Current status: "preparing".',
          },
        }),
      });

      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 5 }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 400);
          assert.equal(err.code, 'ORDER_NOT_COMPLETED');
          return true;
        }
      );
    });

    test('9. Propagates 409 CONFLICT when feedback was already submitted', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Feedback has already been submitted for this order',
          },
        }),
      });

      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 5 }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 409);
          assert.equal(err.code, 'CONFLICT');
          return true;
        }
      );
    });

    test('10. Fails visibly on network drop and never pretends feedback succeeded', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => await submitOrderFeedback(validOrderId, { rating: 5 }),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'NETWORK_ERROR');
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 3. Loyalty Integration Tests (fetchCustomerLoyalty)
  // ==========================================================================
  describe('fetchCustomerLoyalty', () => {
    test('1. Calls GET /api/v1/customer/loyalty?restaurantId=[uuid] and returns customer loyalty summary', async () => {
      let requestedUrl = '';
      let requestedInit = null;

      globalThis.fetch = async (url, init) => {
        requestedUrl = String(url);
        requestedInit = init;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: sampleLoyaltyResponse }),
        };
      };

      const result = await fetchCustomerLoyalty(validRestaurantId);

      assert.ok(requestedUrl.includes('/api/v1/customer/loyalty'));
      assert.ok(requestedUrl.includes(`restaurantId=${validRestaurantId}`));
      assert.equal(requestedInit.method, 'GET');
      assert.equal(requestedInit.credentials, 'include');
      assert.equal(result.starsBalance, 45);
      assert.equal(result.tier, 'Gold');
      assert.equal(result.programName, 'Dine Rewards');
      assert.equal(result.recentTransactions.length, 1);
    });

    test('2. Fast-fails without HTTP call when restaurantId is missing or non-UUID', async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return { ok: true };
      };

      await assert.rejects(
        async () => await fetchCustomerLoyalty(''),
        (err) => err instanceof ApiClientError && err.code === 'INVALID_RESTAURANT_ID'
      );

      await assert.rejects(
        async () => await fetchCustomerLoyalty('restaurant-123'),
        (err) => err instanceof ApiClientError && err.code === 'INVALID_RESTAURANT_ID'
      );

      assert.equal(fetchCalled, false);
    });

    test('3. Propagates 401 UNAUTHORIZED when session is missing', async () => {
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
      });

      await assert.rejects(
        async () => await fetchCustomerLoyalty(validRestaurantId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 401);
          assert.equal(err.code, 'UNAUTHORIZED');
          return true;
        }
      );
    });

    test('4. Throws MALFORMED_RESPONSE when server envelope lacks loyalty account or balance', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { unexpected: 'format' },
        }),
      });

      await assert.rejects(
        async () => await fetchCustomerLoyalty(validRestaurantId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'MALFORMED_RESPONSE');
          return true;
        }
      );
    });

    test('5. Fails cleanly on network drop and does not fabricate points or balance', async () => {
      globalThis.fetch = async () => {
        throw new TypeError('Network error');
      };

      await assert.rejects(
        async () => await fetchCustomerLoyalty(validRestaurantId),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'NETWORK_ERROR');
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 4. UUID Validation Utility
  // ==========================================================================
  describe('isValidUuid utility', () => {
    test('1. Validates standard UUID formats accurately', () => {
      assert.equal(isValidUuid(validOrderId), true);
      assert.equal(isValidUuid(validRestaurantId), true);
      assert.equal(isValidUuid('00000000-0000-0000-0000-000000000000'), true);
      assert.equal(isValidUuid('invalid-uuid'), false);
      assert.equal(isValidUuid('ord-1042'), false);
      assert.equal(isValidUuid(null), false);
      assert.equal(isValidUuid(undefined), false);
      assert.equal(isValidUuid(12345), false);
    });
  });
});
