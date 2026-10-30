import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOrderPreview,
  normalizeOrderPreview,
  mapCartToPreviewItems,
  isValidUuid,
} from '../orderPreviewService.ts';
import { ApiClientError } from '../apiClient.ts';

describe('Restrauque Customer Order Preview Service (orderPreviewService)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const validQrToken = 'q7W9xK2mP4vL8nB1jR5tY0uI3';
  const validTableId = '11111111-1111-4111-8111-111111111111';
  const validProductId = '22222222-2222-4222-8222-222222222222';
  const validVariantId = '33333333-3333-4333-8333-333333333333';
  const validAddonId = '44444444-4444-4444-8444-444444444444';
  const validAddonId2 = '55555555-5555-4555-8555-555555555555';

  const sampleBackendResponse = {
    success: true,
    data: {
      isValid: true,
      table: {
        id: validTableId,
        tableNumber: '12B',
      },
      items: [
        {
          productId: validProductId,
          productName: 'Woodfired Truffle Pizza',
          variantId: validVariantId,
          variantName: 'Large 14"',
          unitPrice: 420,
          unitPriceFormatted: '420.00',
          quantity: 2,
          totalPrice: 960,
          totalPriceFormatted: '960.00',
          specialInstructions: 'Extra crispy crust',
          addons: [
            {
              productAddonId: validAddonId,
              addonName: 'Extra Mozzarella',
              unitPrice: 60,
              unitPriceFormatted: '60.00',
              totalPrice: 120,
              totalPriceFormatted: '120.00',
              quantity: 2,
            },
          ],
        },
      ],
      pricing: {
        subtotal: 960,
        subtotalFormatted: '960.00',
        discountAmount: 100,
        discountAmountFormatted: '100.00',
        taxAmount: 0,
        taxAmountFormatted: '0.00',
        totalAmount: 860,
        totalAmountFormatted: '860.00',
        currency: 'INR',
      },
      coupon: {
        code: 'WELCOME100',
        discountType: 'fixed',
      },
    },
    timestamp: '2026-10-18T00:00:00.000Z',
  };

  // --------------------------------------------------------------------------
  // 1. Correct preview request payload and backend response parsing
  // --------------------------------------------------------------------------
  test('1. Sends correct request payload with mapped items, QR token, tableId, and coupon', async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    let requestedBody = null;

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedMethod = options.method;
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => sampleBackendResponse,
      };
    };

    const request = {
      qrToken: validQrToken,
      tableId: validTableId,
      items: [
        {
          productId: validProductId,
          variantId: validVariantId,
          addonIds: [validAddonId],
          quantity: 2,
          specialInstructions: 'Extra crispy crust',
        },
      ],
      couponCode: 'WELCOME100',
      notes: 'Near the terrace window',
    };

    const quote = await fetchOrderPreview(request);

    assert.equal(requestedUrl, '/api/v1/customer/orders/preview');
    assert.equal(requestedMethod, 'POST');
    assert.equal(requestedBody.qrToken, validQrToken);
    assert.equal(requestedBody.tableId, validTableId);
    assert.equal(requestedBody.couponCode, 'WELCOME100');
    assert.equal(requestedBody.notes, 'Near the terrace window');
    assert.equal(requestedBody.items.length, 1);
    assert.equal(requestedBody.items[0].productId, validProductId);
    assert.equal(requestedBody.items[0].variantId, validVariantId);
    assert.deepEqual(requestedBody.items[0].addonIds, [validAddonId]);
    assert.equal(requestedBody.items[0].quantity, 2);

    // Verify quote normalization directly from backend response envelope
    assert.equal(quote.isValid, true);
    assert.equal(quote.subtotal, 960);
    assert.equal(quote.subtotalFormatted, '960.00');
    assert.equal(quote.discountAmount, 100);
    assert.equal(quote.discountAmountFormatted, '100.00');
    assert.equal(quote.taxAmount, 0);
    assert.equal(quote.totalAmount, 860);
    assert.equal(quote.totalAmountFormatted, '860.00');
    assert.equal(quote.currency, 'INR');
    assert.equal(quote.coupon?.code, 'WELCOME100');
    assert.equal(quote.items.length, 1);
    assert.equal(quote.items[0].unitPrice, 420);
    assert.equal(quote.items[0].totalPrice, 960);
  });

  // --------------------------------------------------------------------------
  // 2. Table ID validation: omit when undefined, reject when invalid UUID
  // --------------------------------------------------------------------------
  test('2. Omits tableId when undefined or null', async () => {
    let requestedBody = null;

    globalThis.fetch = async (_url, options) => {
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => sampleBackendResponse,
      };
    };

    await fetchOrderPreview({
      qrToken: validQrToken,
      items: [{ productId: validProductId, quantity: 1 }],
    });

    assert.equal(requestedBody.tableId, undefined);
  });

  test('3. Rejects invalid non-UUID tableId with INVALID_TABLE_ID', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called');
    };

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: validQrToken,
          tableId: 'invalid-non-uuid-table-id',
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_TABLE_ID');
        assert.equal(err.status, 400);
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  // --------------------------------------------------------------------------
  // 3. Cart item mapping and strict identifier validation
  // --------------------------------------------------------------------------
  test('4. mapCartToPreviewItems correctly converts CartItem array without sending client pricing', () => {
    const cart = [
      {
        id: 'cart-1',
        productId: validProductId,
        productName: 'Truffle Pizza',
        imageUrl: '',
        basePrice: 420,
        variant: {
          id: validVariantId,
          name: 'Large',
          priceDelta: 60,
        },
        addons: [
          { id: validAddonId, name: 'Extra Cheese', price: 60 },
          { id: validAddonId2, name: 'Oregano Dip', price: 20 },
        ],
        quantity: 3,
        specialInstructions: 'No garlic please',
        unitPrice: 500, // Client calculation
        totalPrice: 1500, // Client calculation
      },
    ];

    const previewItems = mapCartToPreviewItems(cart);
    assert.equal(previewItems.length, 1);
    assert.equal(previewItems[0].productId, validProductId);
    assert.equal(previewItems[0].variantId, validVariantId);
    assert.deepEqual(previewItems[0].addonIds, [validAddonId, validAddonId2]);
    assert.equal(previewItems[0].quantity, 3);
    assert.equal(previewItems[0].specialInstructions, 'No garlic please');
    // Ensure no client pricing or names are attached to preview items
    assert.equal('unitPrice' in previewItems[0], false);
    assert.equal('totalPrice' in previewItems[0], false);
    assert.equal('productName' in previewItems[0], false);
  });

  test('5. Rejects malformed variant ID with INVALID_VARIANT_ID instead of converting to null', () => {
    const cart = [
      {
        id: 'cart-1',
        productId: validProductId,
        productName: 'Truffle Pizza',
        imageUrl: '',
        basePrice: 420,
        variant: {
          id: 'var-latte-reg', // Malformed / mock fixture ID
          name: 'Regular',
          priceDelta: 0,
        },
        addons: [],
        quantity: 1,
        unitPrice: 420,
        totalPrice: 420,
      },
    ];

    assert.throws(
      () => mapCartToPreviewItems(cart),
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_VARIANT_ID');
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  test('6. Rejects malformed add-on ID with INVALID_ADDON_ID instead of silently dropping', () => {
    const cart = [
      {
        id: 'cart-1',
        productId: validProductId,
        productName: 'Truffle Pizza',
        imageUrl: '',
        basePrice: 420,
        addons: [
          { id: validAddonId, name: 'Extra Cheese', price: 60 },
          { id: 'not-a-uuid-addon', name: 'Invalid Addon', price: 10 },
        ],
        quantity: 1,
        unitPrice: 490,
        totalPrice: 490,
      },
    ];

    assert.throws(
      () => mapCartToPreviewItems(cart),
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_ADDON_ID');
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  test('7. Rejects exceeding 10 add-ons with EXCEEDS_MAX_ADDONS', () => {
    const addons = Array.from({ length: 11 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Addon ${i}`,
      price: 10,
    }));

    const cart = [
      {
        id: 'cart-1',
        productId: validProductId,
        productName: 'Custom Pizza',
        imageUrl: '',
        basePrice: 400,
        addons,
        quantity: 1,
        unitPrice: 510,
        totalPrice: 510,
      },
    ];

    assert.throws(
      () => mapCartToPreviewItems(cart),
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'EXCEEDS_MAX_ADDONS');
        return true;
      }
    );
  });

  test('8. Rejects invalid quantities (0, negative, non-integer, >99) with INVALID_QUANTITY', () => {
    const createCartWithQty = (qty) => [
      {
        id: 'cart-1',
        productId: validProductId,
        productName: 'Pizza',
        imageUrl: '',
        basePrice: 400,
        addons: [],
        quantity: qty,
        unitPrice: 400,
        totalPrice: 400,
      },
    ];

    for (const invalidQty of [0, -1, 1.5, 100, NaN]) {
      assert.throws(
        () => mapCartToPreviewItems(createCartWithQty(invalidQty)),
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'INVALID_QUANTITY');
          return true;
        }
      );
    }
  });

  test('9. Rejects special instructions exceeding 255 characters with SPECIAL_INSTRUCTIONS_TOO_LONG', () => {
    const cart = [
      {
        id: 'cart-1',
        productId: validProductId,
        productName: 'Pizza',
        imageUrl: '',
        basePrice: 400,
        addons: [],
        quantity: 1,
        specialInstructions: 'A'.repeat(256),
        unitPrice: 400,
        totalPrice: 400,
      },
    ];

    assert.throws(
      () => mapCartToPreviewItems(cart),
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'SPECIAL_INSTRUCTIONS_TOO_LONG');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 4. Fast-fails without HTTP call on empty cart, missing token, or non-UUID item
  // --------------------------------------------------------------------------
  test('10. Fast-fails on empty items array without calling fetch', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called');
    };

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
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

  test('11. Fast-fails on missing or invalid QR token format without calling fetch', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called');
    };

    // Missing token
    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: '',
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'MISSING_QR_TOKEN');
        assert.equal(err.status, 400);
        return true;
      }
    );

    // Too short token (< 20 chars)
    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: 'short-token-123',
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_QR_TOKEN');
        assert.equal(err.status, 400);
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  test('12. Fast-fails on non-UUID product ID without calling fetch', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called');
    };

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: validQrToken,
          items: [{ productId: 'prod-iced-latte', quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_PRODUCT_ID');
        assert.match(err.message, /not a valid catalog identifier/i);
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  // --------------------------------------------------------------------------
  // 5. Backend validation and error handling
  // --------------------------------------------------------------------------
  test('13. Propagates backend 400 validation error (e.g. invalid coupon or unavailable item)', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Coupon code "INVALID50" is invalid or does not exist',
        },
      }),
    });

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 1 }],
          couponCode: 'INVALID50',
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.equal(err.message, 'Coupon code "INVALID50" is invalid or does not exist');
        return true;
      }
    );
  });

  test('14. Propagates backend 401 UNAUTHORIZED when customer session is missing', async () => {
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
        await fetchOrderPreview({
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

  test('15. Propagates backend 404 NOT_FOUND when product or table does not exist', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product with ID ${validProductId} does not exist or does not belong to this restaurant`,
        },
      }),
    });

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'NOT_FOUND');
        assert.match(err.message, /does not exist or does not belong/);
        return true;
      }
    );
  });

  test('16. Throws on malformed response payload without pricing or items', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: null, // Malformed
      }),
    });

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
          qrToken: validQrToken,
          items: [{ productId: validProductId, quantity: 1 }],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_PREVIEW_PAYLOAD');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 6. Cancellation via AbortSignal
  // --------------------------------------------------------------------------
  test('17. Supports request cancellation via AbortSignal', async () => {
    const controller = new AbortController();

    globalThis.fetch = async (_url, options) => {
      return new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    };

    const promise = fetchOrderPreview(
      {
        qrToken: validQrToken,
        items: [{ productId: validProductId, quantity: 1 }],
      },
      controller.signal
    );

    controller.abort();

    await assert.rejects(
      async () => {
        await promise;
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'ABORTED');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 7. Network failure: never silently falls back to mock calculations
  // --------------------------------------------------------------------------
  test('18. Fails cleanly on network drop and does not return mock totals', async () => {
    globalThis.fetch = async () => {
      throw new Error('Connection refused / offline');
    };

    await assert.rejects(
      async () => {
        await fetchOrderPreview({
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
  // 8. Race condition simulation: older request resolving after newer request
  // --------------------------------------------------------------------------
  test('19. Request generation counter ignores older response that resolves after newer request', async () => {
    let requestIdCounter = 0;
    let activeQuote = null;

    const simulatePreviewRequest = async (items, delayMs) => {
      const thisRequestId = ++requestIdCounter;
      // Invalidate prior quote immediately
      activeQuote = null;

      // Simulate network request with variable latency
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = {
            id: thisRequestId,
            itemsCount: items.length,
          };
          // Only update if no newer request began
          if (thisRequestId === requestIdCounter) {
            activeQuote = result;
          }
          resolve(result);
        }, delayMs);
      });
    };

    // Request 1 starts first with large latency (100ms)
    const req1 = simulatePreviewRequest([{ productId: validProductId, quantity: 1 }], 100);
    // Request 2 starts later with small latency (20ms)
    const req2 = simulatePreviewRequest([
      { productId: validProductId, quantity: 1 },
      { productId: validProductId, quantity: 2 },
    ], 20);

    // Wait for fast Request 2 to finish
    await req2;
    assert.deepEqual(activeQuote, { id: 2, itemsCount: 2 });

    // Wait for slow Request 1 to finish
    await req1;
    // Active quote must NOT be overwritten by Request 1
    assert.deepEqual(activeQuote, { id: 2, itemsCount: 2 });
  });

  // --------------------------------------------------------------------------
  // 9. Confirms no call is made to the order-creation endpoint
  // --------------------------------------------------------------------------
  test('20. Confirms preview flow never calls POST /api/v1/customer/orders (order creation)', async () => {
    const calledUrls = [];

    globalThis.fetch = async (url) => {
      calledUrls.push(url);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => sampleBackendResponse,
      };
    };

    await fetchOrderPreview({
      qrToken: validQrToken,
      items: [{ productId: validProductId, quantity: 1 }],
    });

    assert.ok(calledUrls.includes('/api/v1/customer/orders/preview'));
    assert.ok(!calledUrls.includes('/api/v1/customer/orders'));
    assert.ok(!calledUrls.some((u) => u.endsWith('/orders') && !u.includes('/preview')));
  });
});
