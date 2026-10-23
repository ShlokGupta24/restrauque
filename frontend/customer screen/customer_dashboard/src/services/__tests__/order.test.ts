/**
 * Customer Dashboard Order History & Order Details Service Tests
 * Uses Node.js native test runner via tsx with strict assertions.
 *
 * Verifies Step 7B Requirements:
 * 1. fetchCustomerOrders calls GET /api/v1/customer/orders with credentials: 'include'.
 * 2. Proper query parameter serialization (limit, cursor, status, feedbackStatus, restaurantId).
 * 3. Correct response mapping against the backend contract (orders, pagination, summary).
 * 4. Empty order list handling.
 * 5. HTTP 401 UNAUTHORIZED handling.
 * 6. HTTP 403 FORBIDDEN handling.
 * 7. HTTP 500 INTERNAL_SERVER_ERROR handling without falling back to mock fixtures.
 * 8. Cursor pagination support (nextCursor and hasNextPage).
 * 9. AbortSignal request cancellation support.
 * 10. fetchCustomerOrderDetail calls GET /api/v1/customer/orders/:orderId.
 * 11. fetchCustomerOrderDetail unrolls itemized receipt and status history.
 * 12. fetchCustomerOrderDetail handles 404 NOT_FOUND safely without data leakage.
 * 13. Customer identity cannot be client-manipulated via query parameters.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchCustomerOrders,
  fetchCustomerOrderDetail,
  CustomerOrdersResponse,
  CustomerOrderDetail,
} from '../orderService';
import { ApiClientError } from '../apiClient';

describe('Customer Order History & Details Integration (Step 7B)', () => {
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

  // 1. URL and Credentials for Order List
  test('1. fetchCustomerOrders calls GET /api/v1/customer/orders with credentials: include', async () => {
    let calledUrl = '';
    let calledOptions: any = null;

    globalThis.fetch = ((url: RequestInfo | URL, options?: RequestInit) => {
      calledUrl = String(url);
      calledOptions = options;
      return createMockResponse({
        success: true,
        data: {
          orders: [],
          pagination: { limit: 10, hasNextPage: false, nextCursor: null },
          summary: {
            totalOrders: 0,
            pending: 0,
            preparing: 0,
            served: 0,
            completed: 0,
            cancelled: 0,
          },
        },
      });
    }) as typeof fetch;

    const data = await fetchCustomerOrders();

    assert.equal(calledUrl.endsWith('/api/v1/customer/orders'), true);
    assert.equal(calledOptions?.method, 'GET');
    assert.equal(calledOptions?.credentials, 'include');
    assert.equal(data.orders.length, 0);
  });

  // 2. Query Parameter Serialization
  test('2. fetchCustomerOrders serializes query parameters (limit, cursor, status, feedbackStatus, restaurantId)', async () => {
    let calledUrl = '';

    globalThis.fetch = ((url: RequestInfo | URL) => {
      calledUrl = String(url);
      return createMockResponse({
        success: true,
        data: {
          orders: [],
          pagination: { limit: 5, hasNextPage: false, nextCursor: null },
          summary: {
            totalOrders: 0,
            pending: 0,
            preparing: 0,
            served: 0,
            completed: 0,
            cancelled: 0,
          },
        },
      });
    }) as typeof fetch;

    await fetchCustomerOrders({
      limit: 5,
      cursor: 'cursor-token-abc',
      status: 'completed',
      feedbackStatus: 'awaiting_review',
      restaurantId: '22222222-2222-4222-8222-222222222222',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-22',
    });

    const parsedUrl = new URL(calledUrl, 'http://localhost');
    assert.equal(parsedUrl.pathname, '/api/v1/customer/orders');
    assert.equal(parsedUrl.searchParams.get('limit'), '5');
    assert.equal(parsedUrl.searchParams.get('cursor'), 'cursor-token-abc');
    assert.equal(parsedUrl.searchParams.get('status'), 'completed');
    assert.equal(parsedUrl.searchParams.get('feedbackStatus'), 'awaiting_review');
    assert.equal(
      parsedUrl.searchParams.get('restaurantId'),
      '22222222-2222-4222-8222-222222222222'
    );
    assert.equal(parsedUrl.searchParams.get('dateFrom'), '2026-10-01');
    assert.equal(parsedUrl.searchParams.get('dateTo'), '2026-10-22');
  });

  // 3. Response Mapping
  test('3. Correctly unwraps backend envelope and maps itemized summary, pricing, and pagination', async () => {
    const mockResponse: CustomerOrdersResponse = {
      orders: [
        {
          id: 'ord_123',
          orderNumber: 'ORD-9988',
          status: 'completed',
          orderType: 'DINE_IN',
          restaurant: { id: 'res_nbc', name: 'NBC Cafe' },
          branch: { id: 'br_1', name: 'Main Campus' },
          table: { id: 'tbl_4', tableNumber: '4' },
          pricing: {
            subtotal: 450,
            subtotalFormatted: '450.00',
            discountAmount: 50,
            discountAmountFormatted: '50.00',
            loyaltyDiscountAmount: 0,
            loyaltyDiscountAmountFormatted: '0.00',
            taxAmount: 20,
            taxAmountFormatted: '20.00',
            totalAmount: 420,
            totalAmountFormatted: '420.00',
          },
          paymentStatus: 'paid',
          itemCount: 2,
          itemsSummary: [
            {
              id: 'it_1',
              productName: 'Paneer Burger',
              quantity: 1,
              totalPrice: 250,
              totalPriceFormatted: '250.00',
            },
            {
              id: 'it_2',
              productName: 'Cold Coffee',
              quantity: 1,
              totalPrice: 200,
              totalPriceFormatted: '200.00',
            },
          ],
          orderedAt: '2026-10-20T14:30:00.000Z',
          completedAt: '2026-10-20T15:15:00.000Z',
          hasFeedback: false,
        },
      ],
      pagination: {
        limit: 10,
        hasNextPage: true,
        nextCursor: 'cursor_page_2',
      },
      summary: {
        totalOrders: 15,
        pending: 1,
        preparing: 2,
        served: 0,
        completed: 11,
        cancelled: 1,
      },
    };

    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: mockResponse,
      });
    }) as typeof fetch;

    const data = await fetchCustomerOrders();

    assert.equal(data.orders.length, 1);
    const order = data.orders[0];
    assert.equal(order.orderNumber, 'ORD-9988');
    assert.equal(order.restaurant?.name, 'NBC Cafe');
    assert.equal(order.table?.tableNumber, '4');
    assert.equal(order.pricing.totalAmount, 420);
    assert.equal(order.pricing.totalAmountFormatted, '420.00');
    assert.equal(order.paymentStatus, 'paid');
    assert.equal(order.itemsSummary.length, 2);
    assert.equal(order.hasFeedback, false);

    assert.equal(data.pagination.hasNextPage, true);
    assert.equal(data.pagination.nextCursor, 'cursor_page_2');
    assert.equal(data.summary.totalOrders, 15);
    assert.equal(data.summary.completed, 11);
  });

  // 4. Empty Orders Response
  test('4. Handles empty customer order history gracefully', async () => {
    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: {
          orders: [],
          pagination: { limit: 10, hasNextPage: false, nextCursor: null },
          summary: {
            totalOrders: 0,
            pending: 0,
            preparing: 0,
            served: 0,
            completed: 0,
            cancelled: 0,
          },
        },
      });
    }) as typeof fetch;

    const data = await fetchCustomerOrders();
    assert.equal(data.orders.length, 0);
    assert.equal(data.pagination.hasNextPage, false);
    assert.equal(data.pagination.nextCursor, null);
    assert.equal(data.summary.totalOrders, 0);
  });

  // 5. Authentication Failure (HTTP 401)
  test('5. Throws ApiClientError with status 401 on unauthenticated request', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerOrders();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  // 6. Authorization Failure (HTTP 403)
  test('6. Throws ApiClientError with status 403 on role mismatch', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access forbidden: Requires CUSTOMER role' },
        },
        403
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerOrders();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'FORBIDDEN');
        return true;
      }
    );
  });

  // 7. No Demo Fallback on Server Error (HTTP 500)
  test('7. Throws ApiClientError on server failure without substituting mock orders', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Database connection failed' },
        },
        500
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerOrders();
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 500);
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
        await fetchCustomerOrders(undefined, controller.signal);
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'ABORTED');
        return true;
      }
    );
  });

  // 9. Order Detail Retrieval
  test('9. fetchCustomerOrderDetail calls GET /api/v1/customer/orders/:orderId with proper encoding', async () => {
    let calledUrl = '';
    let calledOptions: any = null;

    const mockDetail: CustomerOrderDetail = {
      id: '11111111-1111-4111-8111-111111111111',
      orderNumber: 'ORD-1001',
      status: 'completed',
      orderType: 'DINE_IN',
      restaurantName: 'The Bhoj Family Restaurant',
      branchName: 'Main Branch',
      table: { id: 't1', tableNumber: '12' },
      pricing: {
        subtotal: 600,
        subtotalFormatted: '600.00',
        discountAmount: 100,
        discountAmountFormatted: '100.00',
        loyaltyDiscountAmount: 0,
        loyaltyDiscountAmountFormatted: '0.00',
        taxAmount: 25,
        taxAmountFormatted: '25.00',
        totalAmount: 525,
        totalAmountFormatted: '525.00',
      },
      notes: 'Less spicy please',
      orderedAt: '2026-10-18T19:00:00.000Z',
      completedAt: '2026-10-18T20:00:00.000Z',
      items: [
        {
          id: 'item_1',
          productId: 'prod_1',
          productName: 'Butter Chicken',
          variantId: 'var_full',
          variantName: 'Full Portion',
          quantity: 1,
          unitPrice: 500,
          unitPriceFormatted: '500.00',
          totalPrice: 500,
          totalPriceFormatted: '500.00',
          specialInstructions: 'Extra butter',
          addons: [
            {
              id: 'add_1',
              productAddonId: 'padd_1',
              addonName: 'Garlic Naan',
              quantity: 2,
              unitPrice: 50,
              unitPriceFormatted: '50.00',
              totalPrice: 100,
              totalPriceFormatted: '100.00',
            },
          ],
        },
      ],
      statusHistory: [
        { status: 'pending', notes: 'Order placed', changedAt: '2026-10-18T19:00:00.000Z' },
        { status: 'preparing', notes: 'Sent to kitchen', changedAt: '2026-10-18T19:05:00.000Z' },
        { status: 'completed', notes: 'Served and paid', changedAt: '2026-10-18T20:00:00.000Z' },
      ],
    };

    globalThis.fetch = ((url: RequestInfo | URL, options?: RequestInit) => {
      calledUrl = String(url);
      calledOptions = options;
      return createMockResponse({
        success: true,
        data: mockDetail,
      });
    }) as typeof fetch;

    const data = await fetchCustomerOrderDetail('11111111-1111-4111-8111-111111111111');

    assert.equal(
      calledUrl.endsWith('/api/v1/customer/orders/11111111-1111-4111-8111-111111111111'),
      true
    );
    assert.equal(calledOptions?.credentials, 'include');
    assert.equal(data.orderNumber, 'ORD-1001');
    assert.equal(data.items[0].addons.length, 1);
    assert.equal(data.items[0].addons[0].addonName, 'Garlic Naan');
    assert.equal(data.statusHistory.length, 3);
  });

  // 10. Order Detail 404 Not Found Safety
  test('10. fetchCustomerOrderDetail handles 404 Not Found safely without exposing data', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Order not found' },
        },
        404
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await fetchCustomerOrderDetail('foreign-customer-order-id');
      },
      (err: unknown) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.message, 'Order not found');
        return true;
      }
    );
  });

  // 11. Security: Client cannot inject customerId into query parameters
  test('11. Query serialization does not accept or inject client-controlled customerId', async () => {
    let calledUrl = '';

    globalThis.fetch = ((url: RequestInfo | URL) => {
      calledUrl = String(url);
      return createMockResponse({
        success: true,
        data: {
          orders: [],
          pagination: { limit: 10, hasNextPage: false, nextCursor: null },
          summary: { totalOrders: 0, pending: 0, preparing: 0, served: 0, completed: 0, cancelled: 0 },
        },
      });
    }) as typeof fetch;

    await fetchCustomerOrders({
      status: 'completed',
    });

    const parsedUrl = new URL(calledUrl, 'http://localhost');
    assert.equal(parsedUrl.searchParams.has('customerId'), false);
    assert.equal(parsedUrl.searchParams.has('userId'), false);
  });
});
