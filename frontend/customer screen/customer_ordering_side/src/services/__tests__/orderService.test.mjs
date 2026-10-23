import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  submitOrder,
  fetchOrderById,
  fetchCustomerOrders,
  generateIdempotencyKey,
  extractStoredOrderId,
  storePendingOrderAttempt,
  getPendingOrderAttempt,
  clearPendingOrderAttempt,
  normalizeCustomerOrder,
  normalizeCustomerOrdersResponse,
} from '../orderService.ts';
import { ApiClientError } from '../apiClient.ts';

describe('Restrauque Customer Order Service (orderService)', () => {
  let originalFetch;
  let originalWindow;
  let originalSessionStorage;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;
    originalSessionStorage = globalThis.sessionStorage;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
  });

  const validQrToken = 'q7W9xK2mP4vL8nB1jR5tY0uI3';
  const validTableId = '11111111-1111-4111-8111-111111111111';
  const validProductId = '22222222-2222-4222-8222-222222222222';
  const validVariantId = '33333333-3333-4333-8333-333333333333';
  const validAddonId = '44444444-4444-4444-8444-444444444444';
  const validOrderId = '99999999-9999-4999-8999-999999999999';
  const validIdempotencyKey = '88888888-8888-4888-8888-888888888888';

  const sampleBackendOrder = {
    id: validOrderId,
    orderNumber: 'ORD-20261018-0001',
    status: 'pending',
    orderType: 'dine_in',
    table: {
      id: validTableId,
      tableNumber: '12B',
    },
    branchName: 'Downtown Branch',
    restaurantName: 'NBC Coffee Lounge',
    pricing: {
      subtotal: 960,
      subtotalFormatted: '960.00',
      discountAmount: 100,
      discountAmountFormatted: '100.00',
      taxAmount: 43,
      taxAmountFormatted: '43.00',
      totalAmount: 903,
      totalAmountFormatted: '903.00',
      currency: 'INR',
    },
    notes: 'Near terrace window',
    orderedAt: '2026-10-18T10:30:00.000Z',
    completedAt: null,
    items: [
      {
        id: 'item-1',
        productId: validProductId,
        productName: 'Woodfired Truffle Pizza',
        variantId: validVariantId,
        variantName: 'Large 14"',
        quantity: 2,
        unitPrice: 420,
        unitPriceFormatted: '420.00',
        totalPrice: 960,
        totalPriceFormatted: '960.00',
        specialInstructions: 'Extra crispy',
        addons: [
          {
            id: 'item-addon-1',
            productAddonId: validAddonId,
            addonName: 'Extra Mozzarella',
            quantity: 2,
            unitPrice: 60,
            unitPriceFormatted: '60.00',
            totalPrice: 120,
            totalPriceFormatted: '120.00',
          },
        ],
      },
    ],
    statusHistory: [
      {
        status: 'pending',
        notes: 'Customer placed dine-in order',
        changedAt: '2026-10-18T10:30:00.000Z',
      },
    ],
  };

  // --------------------------------------------------------------------------
  // 1. Exact Request Body and Headers
  // --------------------------------------------------------------------------
  test('1. Sends exact request payload without client-calculated prices or names', async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    let requestedBody = null;

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedMethod = options.method;
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: sampleBackendOrder }),
      };
    };

    const request = {
      qrToken: validQrToken,
      tableId: validTableId,
      idempotencyKey: validIdempotencyKey,
      expectedTotal: 903,
      items: [
        {
          productId: validProductId,
          variantId: validVariantId,
          addonIds: [validAddonId],
          quantity: 2,
          specialInstructions: 'Extra crispy',
        },
      ],
      couponCode: 'WELCOME100',
      notes: 'Near terrace window',
    };

    const order = await submitOrder(request);

    assert.equal(requestedUrl, '/api/v1/customer/orders');
    assert.equal(requestedMethod, 'POST');
    assert.equal(requestedBody.qrToken, validQrToken);
    assert.equal(requestedBody.tableId, validTableId);
    assert.equal(requestedBody.idempotencyKey, validIdempotencyKey);
    assert.equal(requestedBody.expectedTotal, 903);
    assert.equal(requestedBody.couponCode, 'WELCOME100');
    assert.equal(requestedBody.notes, 'Near terrace window');
    assert.equal(requestedBody.items.length, 1);
    assert.equal(requestedBody.items[0].productId, validProductId);
    assert.equal(requestedBody.items[0].variantId, validVariantId);
    assert.deepEqual(requestedBody.items[0].addonIds, [validAddonId]);
    assert.equal(requestedBody.items[0].quantity, 2);

    // Verify strict body omits client prices and product names
    assert.equal('unitPrice' in requestedBody.items[0], false);
    assert.equal('totalPrice' in requestedBody.items[0], false);
    assert.equal('productName' in requestedBody.items[0], false);

    // Verify response normalization
    assert.equal(order.id, validOrderId);
    assert.equal(order.orderNumber, 'ORD-20261018-0001');
    assert.equal(order.status, 'pending');
    assert.equal(order.pricing.totalAmount, 903);
    assert.equal(order.pricing.currency, 'INR');
  });

  // --------------------------------------------------------------------------
  // 2. Idempotency Key Handling & Replay
  // --------------------------------------------------------------------------
  test('2. generateIdempotencyKey produces a valid UUID v4', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(key1, uuidPattern);
    assert.match(key2, uuidPattern);
    assert.notEqual(key1, key2);
  });

  test('3. Reuses the exact same idempotency key on network retry', async () => {
    let callCount = 0;
    const capturedKeys = [];

    const idempotencyKey = generateIdempotencyKey();

    globalThis.fetch = async (_url, options) => {
      callCount++;
      const body = JSON.parse(options.body);
      capturedKeys.push(body.idempotencyKey);

      if (callCount === 1) {
        // First call fails with network interruption
        throw new Error('Connection reset');
      }

      // Second retry succeeds
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'Idempotent-Replay': 'true',
        }),
        json: async () => ({ success: true, data: sampleBackendOrder }),
      };
    };

    const reqPayload = {
      qrToken: validQrToken,
      tableId: validTableId,
      idempotencyKey,
      expectedTotal: 903,
      items: [{ productId: validProductId, quantity: 1 }],
    };

    // First attempt fails
    await assert.rejects(
      async () => {
        await submitOrder(reqPayload);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );

    // Retry with SAME idempotency key
    const order = await submitOrder(reqPayload);

    assert.equal(callCount, 2);
    assert.equal(capturedKeys.length, 2);
    assert.equal(capturedKeys[0], idempotencyKey);
    assert.equal(capturedKeys[1], idempotencyKey);
    assert.equal(order.id, validOrderId);
  });

  // --------------------------------------------------------------------------
  // 3. Price Changed / Drift Detection (409 PRICE_CHANGED)
  // --------------------------------------------------------------------------
  test('4. Propagates 409 PRICE_CHANGED when prices have changed since preview', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'PRICE_CHANGED',
          message: 'Menu prices or taxes have changed since preview. Please review your updated cart.',
          details: {
            expectedTotal: 900,
            currentTotal: 903,
          },
        },
      }),
    });

    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          expectedTotal: 900,
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 409);
        assert.equal(err.code, 'PRICE_CHANGED');
        assert.match(err.message, /prices or taxes have changed/i);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 4. Client Validation: Fast-fails without HTTP call
  // --------------------------------------------------------------------------
  test('5. Fast-fails without fetch call when cart is empty', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not be called');
    };

    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'EMPTY_CART');
        assert.equal(err.status, 400);
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  test('6. Fast-fails without fetch call on missing or invalid QR token format', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not be called');
    };

    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: 'too-short',
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_QR_TOKEN');
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  test('7. Fast-fails without fetch call on non-UUID product ID or variant ID', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not be called');
    };

    // Invalid product ID
    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [{ productId: 'mock-iced-latte', quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_PRODUCT_ID');
        return true;
      }
    );

    // Invalid variant ID
    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [{ productId: validProductId, variantId: 'mock-variant-large', quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_VARIANT_ID');
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  test('8. Fast-fails without fetch call on invalid quantity or invalid tableId', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not be called');
    };

    // Non-integer quantity
    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 2.5 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_QUANTITY');
        return true;
      }
    );

    // Invalid table ID
    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          tableId: 'not-a-uuid-table',
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_TABLE_ID');
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  // --------------------------------------------------------------------------
  // 5. Backend Error Propagation (401, 404, 500)
  // --------------------------------------------------------------------------
  test('9. Propagates 401 UNAUTHORIZED when session is missing', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required: Missing credentials',
        },
      }),
    });

    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  test('10. Propagates 404 NOT_FOUND when table or product is not found', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Table not found or is currently inactive',
        },
      }),
    });

    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 6. Ambiguous Network Failure
  // --------------------------------------------------------------------------
  test('11. Throws NETWORK_ERROR cleanly on connection drop without returning mock success', async () => {
    globalThis.fetch = async () => {
      throw new Error('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await submitOrder({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 7. GET /api/v1/customer/orders/[orderId] (Fetch Order by ID)
  // --------------------------------------------------------------------------
  test('12. fetchOrderById calls GET /api/v1/customer/orders/[orderId] and normalizes order', async () => {
    let requestedUrl = '';
    let requestedMethod = '';

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedMethod = options.method;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: sampleBackendOrder }),
      };
    };

    const order = await fetchOrderById(validOrderId);

    assert.equal(requestedUrl, `/api/v1/customer/orders/${validOrderId}`);
    assert.equal(requestedMethod, 'GET');
    assert.equal(order.id, validOrderId);
    assert.equal(order.orderNumber, 'ORD-20261018-0001');
    assert.equal(order.status, 'pending');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].productName, 'Woodfired Truffle Pizza');
  });

  test('13. fetchOrderById fast-fails on malformed orderId without HTTP call', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Should not be called');
    };

    await assert.rejects(
      async () => {
        await fetchOrderById('not-a-valid-uuid');
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_ORDER_ID');
        assert.equal(err.status, 400);
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  // --------------------------------------------------------------------------
  // 8. GET /api/v1/customer/orders (Fetch Customer Orders History)
  // --------------------------------------------------------------------------
  test('14. fetchCustomerOrders calls GET /api/v1/customer/orders with query parameters', async () => {
    let requestedUrl = '';
    let requestedMethod = '';

    const sampleHistoryResponse = {
      orders: [
        {
          id: validOrderId,
          orderNumber: 'ORD-20261018-0001',
          status: 'pending',
          orderType: 'dine_in',
          restaurant: { id: 'rest-1', name: 'NBC Lounge' },
          branch: { id: 'branch-1', name: 'Downtown' },
          table: { id: validTableId, tableNumber: '12B' },
          pricing: {
            subtotal: 960,
            subtotalFormatted: '960.00',
            discountAmount: 100,
            discountAmountFormatted: '100.00',
            taxAmount: 43,
            taxAmountFormatted: '43.00',
            totalAmount: 903,
            totalAmountFormatted: '903.00',
            currency: 'INR',
          },
          paymentStatus: 'unpaid',
          itemCount: 2,
          itemsSummary: [
            {
              id: 'it-1',
              productName: 'Truffle Pizza',
              quantity: 2,
              totalPrice: 960,
              totalPriceFormatted: '960.00',
            },
          ],
          orderedAt: '2026-10-18T10:30:00.000Z',
          completedAt: null,
          hasFeedback: false,
        },
      ],
      pagination: {
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      },
      summary: {
        totalOrders: 1,
        pending: 1,
        preparing: 0,
        served: 0,
        completed: 0,
        cancelled: 0,
      },
    };

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedMethod = options.method;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: sampleHistoryResponse }),
      };
    };

    const res = await fetchCustomerOrders({ limit: 10, status: 'pending' });

    assert.ok(requestedUrl.startsWith('/api/v1/customer/orders'));
    assert.ok(requestedUrl.includes('limit=10'));
    assert.ok(requestedUrl.includes('status=pending'));
    assert.equal(requestedMethod, 'GET');
    assert.equal(res.orders.length, 1);
    assert.equal(res.orders[0].id, validOrderId);
    assert.equal(res.summary.totalOrders, 1);
    assert.equal(res.summary.pending, 1);
  });

  // --------------------------------------------------------------------------
  // 9. Confirmation Page Refresh Safety
  // --------------------------------------------------------------------------
  test('15. Confirmation screen refresh performs GET only and never calls POST order creation', async () => {
    const executedMethods = [];
    const executedUrls = [];

    globalThis.fetch = async (url, options) => {
      executedUrls.push(url);
      executedMethods.push(options?.method || 'GET');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: sampleBackendOrder }),
      };
    };

    // Simulate page refresh loading active order
    await fetchOrderById(validOrderId);

    assert.equal(executedMethods.length, 1);
    assert.equal(executedMethods[0], 'GET');
    assert.equal(executedUrls[0], `/api/v1/customer/orders/${validOrderId}`);
    assert.ok(!executedMethods.includes('POST'));
  });

  // --------------------------------------------------------------------------
  // 10. Step 9A Regression Tests: Auto Idempotency, Refresh Recovery, Safe Status
  // --------------------------------------------------------------------------
  test('16. Automatically attaches generated idempotency key if omitted by caller', async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: sampleBackendOrder }),
      };
    };

    const requestWithoutKey = {
      qrToken: validQrToken,
      items: [{ productId: validProductId, quantity: 1 }],
    };

    await submitOrder(requestWithoutKey);

    assert.ok(capturedBody.idempotencyKey, 'Should generate an idempotency key');
    assert.match(
      capturedBody.idempotencyKey,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Should be valid UUID v4'
    );
  });

  test('17. Recovers active order ID from URL query parameters across refresh', () => {
    globalThis.window = {
      location: {
        search: `?screen=order-confirmation&orderId=${validOrderId}`,
      },
    };
    globalThis.sessionStorage = {
      getItem: () => null,
    };

    const recovered = extractStoredOrderId();
    assert.equal(recovered, validOrderId);
  });

  test('18. Recovers active order ID from sessionStorage across refresh', () => {
    globalThis.window = {
      location: {
        search: '',
      },
    };
    globalThis.sessionStorage = {
      getItem: (key) => (key === 'restrauque_active_order_id' ? validOrderId : null),
    };

    const recovered = extractStoredOrderId();
    assert.equal(recovered, validOrderId);
  });

  test('19. Rejects non-UUID order ID in query or sessionStorage', () => {
    globalThis.window = {
      location: {
        search: '?orderId=invalid-uuid-123',
      },
    };
    globalThis.sessionStorage = {
      getItem: () => 'malicious-script-tag',
    };

    const recovered = extractStoredOrderId();
    assert.equal(recovered, null);
  });

  test('20. Safely normalizes cancelled orders and handles unknown statuses without crashing', () => {
    const cancelledOrder = {
      ...sampleBackendOrder,
      status: 'cancelled',
      completedAt: '2026-10-18T10:45:00.000Z',
    };

    const normalizedCancelled = normalizeCustomerOrder(cancelledOrder);
    assert.equal(normalizedCancelled.status, 'cancelled');
    assert.equal(normalizedCancelled.completedAt, '2026-10-18T10:45:00.000Z');

    const unknownStatusOrder = {
      ...sampleBackendOrder,
      status: 'disputed',
    };

    const normalizedUnknown = normalizeCustomerOrder(unknownStatusOrder);
    assert.equal(normalizedUnknown.status, 'disputed');
  });

  test('21. storePendingOrderAttempt persists and getPendingOrderAttempt restores matching attempt', () => {
    const memoryStorage = new Map();
    globalThis.window = {
      sessionStorage: {
        getItem: (k) => memoryStorage.get(k) || null,
        setItem: (k, v) => memoryStorage.set(k, String(v)),
        removeItem: (k) => memoryStorage.delete(k),
      },
    };
    globalThis.sessionStorage = globalThis.window.sessionStorage;

    const attempt = {
      idempotencyKey: validIdempotencyKey,
      payload: {
        qrToken: validQrToken,
        tableId: validTableId,
        items: [{ productId: validProductId, quantity: 1 }],
      },
      userId: 'user-alice-123',
      restaurantId: 'rest-cafe-456',
      qrToken: validQrToken,
    };

    storePendingOrderAttempt(attempt);

    // Exact matching context recovers payload and idempotency key
    const recovered = getPendingOrderAttempt({
      userId: 'user-alice-123',
      restaurantId: 'rest-cafe-456',
      qrToken: validQrToken,
    });

    assert.ok(recovered);
    assert.equal(recovered.idempotencyKey, validIdempotencyKey);
    assert.equal(recovered.payload.items[0].productId, validProductId);
  });

  test('22. getPendingOrderAttempt strictly rejects and purges attempt when customer session differs', () => {
    const memoryStorage = new Map();
    globalThis.window = {
      sessionStorage: {
        getItem: (k) => memoryStorage.get(k) || null,
        setItem: (k, v) => memoryStorage.set(k, String(v)),
        removeItem: (k) => memoryStorage.delete(k),
      },
    };
    globalThis.sessionStorage = globalThis.window.sessionStorage;

    const attempt = {
      idempotencyKey: validIdempotencyKey,
      payload: {
        qrToken: validQrToken,
        tableId: validTableId,
        items: [{ productId: validProductId, quantity: 1 }],
      },
      userId: 'user-alice-123',
      restaurantId: 'rest-cafe-456',
      qrToken: validQrToken,
    };

    storePendingOrderAttempt(attempt);

    // Customer Bob tries to access Alice's pending order attempt
    const recoveredByBob = getPendingOrderAttempt({
      userId: 'user-bob-999',
      restaurantId: 'rest-cafe-456',
      qrToken: validQrToken,
    });

    assert.equal(recoveredByBob, null);
    // Verified that cross-customer contamination was purged from storage
    assert.equal(memoryStorage.has('restrauque_pending_order_attempt'), false);
  });

  test('23. getPendingOrderAttempt strictly rejects and purges attempt when venue QR token differs', () => {
    const memoryStorage = new Map();
    globalThis.window = {
      sessionStorage: {
        getItem: (k) => memoryStorage.get(k) || null,
        setItem: (k, v) => memoryStorage.set(k, String(v)),
        removeItem: (k) => memoryStorage.delete(k),
      },
    };
    globalThis.sessionStorage = globalThis.window.sessionStorage;

    const attempt = {
      idempotencyKey: validIdempotencyKey,
      payload: {
        qrToken: validQrToken,
        tableId: validTableId,
        items: [{ productId: validProductId, quantity: 1 }],
      },
      userId: 'user-alice-123',
      restaurantId: 'rest-cafe-456',
      qrToken: validQrToken,
    };

    storePendingOrderAttempt(attempt);

    // Customer visits a different table or restaurant
    const recoveredDifferentVenue = getPendingOrderAttempt({
      userId: 'user-alice-123',
      restaurantId: 'rest-different-venue-777',
      qrToken: 'different-table-qr-token-1234567890',
    });

    assert.equal(recoveredDifferentVenue, null);
    assert.equal(memoryStorage.has('restrauque_pending_order_attempt'), false);
  });
});
