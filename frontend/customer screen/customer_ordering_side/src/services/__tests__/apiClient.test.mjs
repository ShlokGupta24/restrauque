import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, ApiClientError, buildUrl, request } from '../apiClient.ts';

describe('Restrauque Typed HTTP Client (apiClient)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('1. Unwraps standard backend success response envelope { success: true, data: T }', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/health');
      assert.equal(options.method, 'GET');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: { status: 'healthy', database: 'connected' },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    const data = await apiClient.get('/api/v1/health');
    assert.deepEqual(data, { status: 'healthy', database: 'connected' });
  });

  test('2. Preserves structured backend non-2xx error envelopes', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'QR code is invalid, expired, or inactive',
            details: { token: 'invalid-token' },
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    await assert.rejects(
      async () => {
        await apiClient.get('/api/v1/public/qr/invalid-token');
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.message, 'QR code is invalid, expired, or inactive');
        assert.deepEqual(err.details, { token: 'invalid-token' });
        return true;
      }
    );
  });

  test('3. Handles HTTP 204 No Content gracefully without attempting JSON parse', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.method, 'DELETE');
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
      };
    };

    const result = await apiClient.delete('/api/v1/items/item-123');
    assert.equal(result, undefined);
  });

  test('4. Handles non-JSON error pages (e.g. 502 HTML Gateway timeout) safely without leaking HTML', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 502,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body>502 Bad Gateway</body></html>',
      };
    };

    await assert.rejects(
      async () => {
        await apiClient.get('/api/v1/customer/menu');
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 502);
        assert.equal(err.code, 'SERVICE_UNAVAILABLE');
        assert.equal(err.message, 'Server is temporarily unavailable. Please try again shortly.');
        assert.equal(err.message.includes('<html'), false);
        return true;
      }
    );
  });

  test('5. Handles request cancellation via AbortSignal cleanly with ABORTED error code', async () => {
    const controller = new AbortController();

    globalThis.fetch = async (url, options) => {
      if (options.signal?.aborted) {
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        throw error;
      }
      return { ok: true, status: 200, headers: new Headers() };
    };

    controller.abort();

    await assert.rejects(
      async () => {
        await apiClient.get('/api/v1/customer/orders', { signal: controller.signal });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 0);
        assert.equal(err.code, 'ABORTED');
        assert.equal(err.message, 'Request was cancelled.');
        return true;
      }
    );
  });

  test('6. Automatically sets credentials: "include", Content-Type for JSON, and Authorization header', async () => {
    let capturedOptions;

    globalThis.fetch = async (url, options) => {
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { orderId: 'ord-123' } }),
      };
    };

    await apiClient.post(
      '/api/v1/customer/orders',
      { items: [{ productId: 'p1', quantity: 2 }] },
      {
        token: 'eyJhbGciOi...',
        headers: { 'X-Table-Id': 'table-1' },
      }
    );

    assert.ok(capturedOptions);
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.credentials, 'include');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.equal(capturedOptions.headers['Accept'], 'application/json');
    assert.equal(capturedOptions.headers['Authorization'], 'Bearer eyJhbGciOi...');
    assert.equal(capturedOptions.headers['X-Table-Id'], 'table-1');
    assert.equal(capturedOptions.body, JSON.stringify({ items: [{ productId: 'p1', quantity: 2 }] }));
  });

  test('7. Constructs URLs with relative /api paths and serializes query parameters cleanly', () => {
    const url1 = buildUrl('/api/v1/customer/menu', {
      qrToken: 'tok_abcdef1234567890',
      tableId: 'd3b07384-d113-4475-b6d9-5d392e276b5d',
      nullValue: null,
      undefinedValue: undefined,
    });
    assert.equal(
      url1,
      '/api/v1/customer/menu?qrToken=tok_abcdef1234567890&tableId=d3b07384-d113-4475-b6d9-5d392e276b5d'
    );

    const url2 = buildUrl('api/v1/health');
    assert.equal(url2, '/api/v1/health');
  });
});
