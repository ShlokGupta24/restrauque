import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveQrContext,
  normalizeQrContext,
  isValidQrTokenFormat,
  QR_TOKEN_REGEX,
} from '../qrService.ts';
import { ApiClientError } from '../apiClient.ts';

describe('Restrauque QR Context & Venue Resolution (qrService)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Valid token matching backend regex: /^[A-Za-z0-9_-]{20,128}$/
  const validToken = 'q7W9xK2mP4vL8nB1jR5tY0uI3';

  test('1. Successful response normalization using the actual backend contract', async () => {
    let requestedUrl = '';
    let requestedSignal = null;

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedSignal = options?.signal;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            resolved: true,
            table: {
              id: 'tbl_98765',
              tableNumber: '12B',
              capacity: 4,
              status: 'available',
            },
            branch: {
              id: 'br_54321',
              name: 'Indiranagar Flagship',
              timezone: 'Asia/Kolkata',
            },
            restaurant: {
              id: 'rest_10101',
              name: 'Restrauque Café & Roastery',
            },
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    const result = await resolveQrContext(validToken);

    // Verify endpoint called with exact path and token
    assert.equal(requestedUrl, `/api/v1/public/qr/${validToken}`);

    // Verify domain model normalization
    assert.equal(result.id, 'rest_10101');
    assert.equal(result.name, 'Restrauque Café & Roastery');
    assert.equal(result.branchName, 'Indiranagar Flagship');
    assert.equal(result.tableLabel, 'Table 12B');
    assert.equal(result.tableId, 'tbl_98765');
    assert.equal(result.tableNumber, '12B');
    assert.equal(result.tableStatus, 'available');
    assert.equal(result.tableCapacity, 4);
    assert.equal(result.branchId, 'br_54321');
    assert.equal(result.timezone, 'Asia/Kolkata');
  });

  test('2. Missing token handling: fast-fails without making an HTTP request', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called for missing token');
    };

    for (const missingToken of [null, undefined, '', '   ']) {
      await assert.rejects(
        async () => {
          await resolveQrContext(missingToken);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 400);
          assert.equal(err.code, 'MISSING_QR_TOKEN');
          assert.match(err.message, /No table QR code detected/i);
          return true;
        }
      );
    }

    assert.equal(fetchCalled, false, 'Fetch was invoked despite missing token');
  });

  test('3. Invalid token format: fast-fails without making an HTTP request', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called for invalid format token');
    };

    // Tokens too short (<20 chars), containing spaces, or invalid characters
    const invalidTokens = [
      'demo-qr-token',      // 13 chars (< 20)
      'too_short',          // 9 chars
      'invalid token with space',
      'token-with-special-!@#$',
      'short12345678901234', // 19 chars (< 20)
    ];

    for (const invalidToken of invalidTokens) {
      await assert.rejects(
        async () => {
          await resolveQrContext(invalidToken);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 404);
          assert.equal(err.code, 'INVALID_QR_FORMAT');
          assert.match(err.message, /invalid, expired, or inactive/i);
          return true;
        }
      );
    }

    assert.equal(fetchCalled, false, 'Fetch was invoked despite invalid token format');
  });

  test('4. Backend rejection: handles 404 NOT_FOUND for unknown/inactive token', async () => {
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
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    await assert.rejects(
      async () => {
        await resolveQrContext(validToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.message, 'QR code is invalid, expired, or inactive');
        return true;
      }
    );
  });

  test('5. URL encoding: encodes URL components properly', async () => {
    let requestedUrl = '';
    const tokenWithUrlChars = 'aB3_dE9-gH1_jK5-mN7_pQ2'; // 23 valid chars
    globalThis.fetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            resolved: true,
            table: { id: 't1', tableNumber: '1', capacity: 2, status: 'available' },
            branch: { id: 'b1', name: 'Branch', timezone: 'UTC' },
            restaurant: { id: 'r1', name: 'Restaurant' },
          },
        }),
      };
    };

    await resolveQrContext(tokenWithUrlChars);
    assert.equal(requestedUrl, `/api/v1/public/qr/${encodeURIComponent(tokenWithUrlChars)}`);
  });

  test('6. Network/server connection failure: wrapped in user-friendly ApiClientError', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await resolveQrContext(validToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 0);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert.match(err.message, /Unable to connect to the (?:restaurant service|server)/i);
        return true;
      }
    );
  });

  test('7. Cancellation via AbortSignal: propagates ABORTED error cleanly', async () => {
    const controller = new AbortController();

    globalThis.fetch = async (_url, options) => {
      if (options?.signal?.aborted) {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    const promise = resolveQrContext(validToken, controller.signal);
    controller.abort();

    await assert.rejects(
      promise,
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'ABORTED');
        assert.equal(err.status, 0);
        return true;
      }
    );
  });

  test('8. Malformed server response: rejects with MALFORMED_RESPONSE without crash', () => {
    assert.throws(
      () => {
        normalizeQrContext(null);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'MALFORMED_RESPONSE');
        return true;
      }
    );

    assert.throws(
      () => {
        normalizeQrContext({ resolved: true, table: null, branch: null, restaurant: null });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'MALFORMED_RESPONSE');
        return true;
      }
    );
  });

  test('9. isValidQrTokenFormat: correctly matches backend token rules (20-128 chars base64url)', () => {
    // Valid tokens
    assert.equal(isValidQrTokenFormat('12345678901234567890'), true); // 20 chars
    assert.equal(isValidQrTokenFormat('a'.repeat(128)), true); // 128 chars
    assert.equal(isValidQrTokenFormat('Token-With_Underscore123456'), true);

    // Invalid tokens
    assert.equal(isValidQrTokenFormat(''), false);
    assert.equal(isValidQrTokenFormat(null), false);
    assert.equal(isValidQrTokenFormat(undefined), false);
    assert.equal(isValidQrTokenFormat('1234567890123456789'), false); // 19 chars
    assert.equal(isValidQrTokenFormat('a'.repeat(129)), false); // 129 chars
    assert.equal(isValidQrTokenFormat('token with spaces in it!'), false);
    assert.equal(isValidQrTokenFormat('special@characters#here$12345'), false);
  });
});
