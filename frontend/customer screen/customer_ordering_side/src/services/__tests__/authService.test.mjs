import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  requestCustomerOtp,
  verifyCustomerOtp,
  restoreCustomerSession,
  logoutCustomer,
  formatCustomerPhone,
  isValidCustomerPhone,
} from '../authService.ts';
import { ApiClientError } from '../apiClient.ts';

describe('Restrauque Customer Authentication & Session Restoration (authService)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const testPhone = '9876543210';
  const formattedPhone = '+919876543210';
  const testOtp = '849201';

  // --------------------------------------------------------------------------
  // 1. requestCustomerOtp tests
  // --------------------------------------------------------------------------
  test('1. requestCustomerOtp sends correct phone payload to POST /api/v1/auth/customer/otp/request', async () => {
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
        json: async () => ({
          success: true,
          data: {
            message: 'OTP verification code requested successfully',
            phone: formattedPhone,
            expiresInSeconds: 300,
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    const res = await requestCustomerOtp(testPhone);

    assert.equal(requestedUrl, '/api/v1/auth/customer/otp/request');
    assert.equal(requestedMethod, 'POST');
    assert.deepEqual(requestedBody, { phone: formattedPhone });
    assert.equal(res.phone, formattedPhone);
    assert.equal(res.expiresInSeconds, 300);
  });

  test('2. requestCustomerOtp fast-fails on invalid/empty phone without making an HTTP request', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called');
    };

    for (const invalidPhone of ['', '   ', '123', null, undefined]) {
      await assert.rejects(
        async () => {
          await requestCustomerOtp(invalidPhone);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 400);
          assert.equal(err.code, 'INVALID_PHONE');
          return true;
        }
      );
    }

    assert.equal(fetchCalled, false, 'Fetch was invoked despite invalid phone');
  });

  test('3. requestCustomerOtp handles 429 TOO_MANY_REQUESTS rate limit with retryAfter details', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 429,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Please wait 45 seconds before requesting another OTP.',
            details: { retryAfter: 45 },
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    await assert.rejects(
      async () => {
        await requestCustomerOtp(testPhone);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 429);
        assert.equal(err.code, 'TOO_MANY_REQUESTS');
        assert.equal(err.message, 'Please wait 45 seconds before requesting another OTP.');
        assert.deepEqual(err.details, { retryAfter: 45 });
        return true;
      }
    );
  });

  test('4. requestCustomerOtp fails visibly on network failure without mock fallback', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await requestCustomerOtp(testPhone);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 2. verifyCustomerOtp tests
  // --------------------------------------------------------------------------
  test('5. verifyCustomerOtp sends exact backend field names (otp, phone, name) to /api/v1/auth/customer/otp/verify', async () => {
    let requestedUrl = '';
    let requestedBody = null;

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'set-cookie': 'restrauque_auth_token=jwt-token-val; HttpOnly; Path=/',
        }),
        json: async () => ({
          success: true,
          data: {
            user: {
              id: 'cust_abc123',
              email: null,
              name: 'Aarav Sharma',
              phone: formattedPhone,
              role: 'CUSTOMER',
              status: 'active',
              createdAt: '2026-10-18T00:00:00.000Z',
              updatedAt: '2026-10-18T00:00:00.000Z',
            },
            token: 'jwt-auth-token',
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    const res = await verifyCustomerOtp(testPhone, testOtp, 'Aarav Sharma');

    assert.equal(requestedUrl, '/api/v1/auth/customer/otp/verify');
    assert.deepEqual(requestedBody, {
      phone: formattedPhone,
      otp: testOtp, // Backend expects 'otp', not 'otpCode'
      name: 'Aarav Sharma',
    });
    assert.equal(res.user.id, 'cust_abc123');
    assert.equal(res.user.name, 'Aarav Sharma');
    assert.equal(res.user.role, 'CUSTOMER');
  });

  test('6. verifyCustomerOtp omits name when not provided and fast-fails if OTP is not 6 digits', async () => {
    let fetchCalled = false;
    globalThis.fetch = async (url, options) => {
      fetchCalled = true;
      const body = JSON.parse(options.body);
      assert.equal('name' in body, false, 'name should not be present in payload');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            user: { id: 'cust_1', name: 'Customer', phone: formattedPhone, role: 'CUSTOMER', status: 'active', createdAt: '', updatedAt: '' },
            token: 'jwt-token',
          },
        }),
      };
    };

    // Valid 6 digits without name
    const validRes = await verifyCustomerOtp(testPhone, '654321');
    assert.equal(validRes.user.name, 'Customer');
    assert.equal(fetchCalled, true);

    // Reset fetch
    fetchCalled = false;

    // Invalid OTP lengths: fast-fail before fetch
    for (const badOtp of ['12345', '1234567', 'abc', '12 45', '']) {
      await assert.rejects(
        async () => {
          await verifyCustomerOtp(testPhone, badOtp);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.code, 'INVALID_OTP_FORMAT');
          return true;
        }
      );
    }
    assert.equal(fetchCalled, false, 'Fetch was called for invalid OTP lengths');
  });

  test('7. verifyCustomerOtp handles rejected backend responses (400 Invalid OTP)', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid or expired OTP. Please request a new code.',
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    await assert.rejects(
      async () => {
        await verifyCustomerOtp(testPhone, testOtp);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.equal(err.message, 'Invalid or expired OTP. Please request a new code.');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 3. restoreCustomerSession tests (GET /api/v1/auth/me)
  // --------------------------------------------------------------------------
  test('8. restoreCustomerSession restores authenticated customer from /api/v1/auth/me', async () => {
    let requestedUrl = '';
    globalThis.fetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            user: {
              id: 'cust_session_user',
              email: null,
              name: 'Priya Patel',
              phone: formattedPhone,
              role: 'CUSTOMER',
              status: 'active',
              createdAt: '2026-10-18T00:00:00.000Z',
              updatedAt: '2026-10-18T00:00:00.000Z',
            },
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    const user = await restoreCustomerSession();

    assert.equal(requestedUrl, '/api/v1/auth/me');
    assert.ok(user !== null);
    assert.equal(user.id, 'cust_session_user');
    assert.equal(user.name, 'Priya Patel');
    assert.equal(user.phone, formattedPhone);
  });

  test('9. restoreCustomerSession handles 401 UNAUTHORIZED as normal signed-out state without error', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required: Missing credentials',
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    // Should return null cleanly, not throw
    const user = await restoreCustomerSession();
    assert.equal(user, null, 'Unauthenticated response must return null');
  });

  test('10. restoreCustomerSession propagates network errors without mock-login fallback', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await restoreCustomerSession();
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 4. logoutCustomer tests (POST /api/v1/auth/customer/logout)
  // --------------------------------------------------------------------------
  test('11. logoutCustomer calls POST /api/v1/auth/customer/logout to invalidate backend session', async () => {
    let requestedUrl = '';
    let requestedMethod = '';

    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      requestedMethod = options.method;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            message: 'Customer logged out successfully',
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    const res = await logoutCustomer();
    assert.equal(requestedUrl, '/api/v1/auth/customer/logout');
    assert.equal(requestedMethod, 'POST');
    assert.equal(res.message, 'Customer logged out successfully');
  });

  test('12. logoutCustomer handles 401 response cleanly if session was already expired on server', async () => {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required: Missing credentials',
          },
          timestamp: '2026-10-18T00:00:00.000Z',
        }),
      };
    };

    // 401 during logout means session is already invalidated on server -> resolve cleanly
    const res = await logoutCustomer();
    assert.match(res.message, /already logged out/i);
  });

  // --------------------------------------------------------------------------
  // 5. Phone helpers
  // --------------------------------------------------------------------------
  test('13. formatCustomerPhone & isValidCustomerPhone handle Indian numbers accurately', () => {
    assert.equal(formatCustomerPhone('9876543210'), '+919876543210');
    assert.equal(formatCustomerPhone('+919876543210'), '+919876543210');
    assert.equal(formatCustomerPhone('919876543210'), '+919876543210');
    assert.equal(formatCustomerPhone('98765-43210'), '+919876543210');

    assert.equal(isValidCustomerPhone('9876543210'), true);
    assert.equal(isValidCustomerPhone('8876543210'), true);
    assert.equal(isValidCustomerPhone('7876543210'), true);
    assert.equal(isValidCustomerPhone('6876543210'), true);
    assert.equal(isValidCustomerPhone('5876543210'), false); // Indian mobile cannot start with 5
    assert.equal(isValidCustomerPhone('12345'), false);
    assert.equal(isValidCustomerPhone(''), false);
  });
});
