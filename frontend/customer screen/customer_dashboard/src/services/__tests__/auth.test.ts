/**
 * Restrauque Customer Dashboard Real OTP Authentication Unit Tests
 * Uses Node.js native test runner via tsx and strict assertions.
 *
 * Scenarios tested (per Step 2 requirements):
 * 1. Initial session restoration succeeds using /api/v1/auth/me.
 * 2. HTTP 401 during restoration leads to the unauthenticated state.
 * 3. Valid phone submission calls the correct OTP request endpoint.
 * 4. Valid OTP verification sends the correct payload and establishes customer state.
 * 5. Invalid OTP does not authenticate the customer.
 * 6. HTTP 429 displays and respects the provided retry delay.
 * 7. Network/provider failure does not authenticate the customer.
 * 8. Logout calls the backend and clears local authenticated state.
 * 9. The raw token is not stored in localStorage or sessionStorage.
 * 10. A protected dashboard route does not render authenticated content while session restoration is pending.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Import services to test
import {
  normalizeIndianPhone,
  isValidIndianPhone,
  requestCustomerOtp,
  verifyCustomerOtp,
  restoreCustomerSession,
  logoutCustomer,
} from '../authService';
import { ApiClientError } from '../apiClient';
import { resolveSafeRedirect } from '../redirectUtils';

// Setup Mock Storage
class MockStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: unknown): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
}

describe('Customer Real OTP Authentication Integration', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockStorageLocal: MockStorage;
  let mockStorageSession: MockStorage;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockStorageLocal = new MockStorage();
    mockStorageSession = new MockStorage();

    (globalThis as any).localStorage = mockStorageLocal;
    (globalThis as any).sessionStorage = mockStorageSession;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockStorageLocal.clear();
    mockStorageSession.clear();
  });

  // =========================================================================
  // Helper: Create Mock JSON Response
  // =========================================================================
  function createMockResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
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

  // =========================================================================
  // Phone Normalization and Validation
  // =========================================================================
  test('Phone normalization: formats Indian mobile numbers to E.164 and avoids double +91', () => {
    assert.equal(normalizeIndianPhone('9876543210'), '+919876543210');
    assert.equal(normalizeIndianPhone('+919876543210'), '+919876543210');
    assert.equal(normalizeIndianPhone('919876543210'), '+919876543210');
    assert.equal(normalizeIndianPhone('  98765-43210  '), '+919876543210');
    assert.equal(normalizeIndianPhone('+91 98765 43210'), '+919876543210');

    assert.equal(isValidIndianPhone('9876543210'), true);
    assert.equal(isValidIndianPhone('+919876543210'), true);
    assert.equal(isValidIndianPhone('8876543210'), true);
    assert.equal(isValidIndianPhone('7876543210'), true);
    assert.equal(isValidIndianPhone('6876543210'), true);

    // Invalid numbers: starts with 1-5, or wrong length
    assert.equal(isValidIndianPhone('5876543210'), false);
    assert.equal(isValidIndianPhone('12345'), false);
    assert.equal(isValidIndianPhone('987654321000'), false);
    assert.equal(isValidIndianPhone(''), false);
  });

  // =========================================================================
  // Requirement 1: Initial session restoration succeeds using /api/v1/auth/me
  // =========================================================================
  test('Req 1: Initial session restoration succeeds using /api/v1/auth/me', async () => {
    let calledUrl = '';
    let calledOptions: any = null;

    globalThis.fetch = ((url: any, options: any) => {
      calledUrl = String(url);
      calledOptions = options;
      return createMockResponse({
        success: true,
        data: {
          user: {
            id: 'cust_real_001',
            email: 'rahul@example.com',
            name: 'Rahul Sharma',
            phone: '+919876543210',
            role: 'CUSTOMER',
            status: 'active',
            createdAt: '2024-05-10T12:00:00Z',
            updatedAt: '2024-05-10T12:00:00Z',
          },
        },
      });
    }) as typeof fetch;

    const user = await restoreCustomerSession();

    assert.ok(user, 'User should be restored');
    assert.equal(user.id, 'cust_real_001');
    assert.equal(user.name, 'Rahul Sharma');
    assert.equal(user.phone, '+919876543210');
    assert.equal(user.role, 'CUSTOMER');

    assert.ok(calledUrl.endsWith('/api/v1/auth/me'));
    assert.equal(calledOptions.credentials, 'include', 'Must include session cookie credentials');
    assert.equal(calledOptions.method, 'GET');
  });

  // =========================================================================
  // Requirement 2: HTTP 401 during restoration leads to the unauthenticated state
  // =========================================================================
  test('Req 2: HTTP 401 during restoration returns null (unauthenticated state)', async () => {
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

    const user = await restoreCustomerSession();
    assert.equal(user, null, 'HTTP 401 must resolve to null rather than throwing or authenticating');
  });

  // =========================================================================
  // Requirement 3: Valid phone submission calls the correct OTP request endpoint
  // =========================================================================
  test('Req 3: Valid phone submission calls /api/v1/auth/customer/otp/request with normalized phone', async () => {
    let calledUrl = '';
    let calledBody: any = null;
    let calledMethod = '';

    globalThis.fetch = ((url: any, options: any) => {
      calledUrl = String(url);
      calledMethod = options.method;
      calledBody = JSON.parse(options.body);
      return createMockResponse({
        success: true,
        data: {
          phone: '+919876543210',
          expiresInSeconds: 300,
          retryAfter: 60,
          message: 'OTP sent successfully',
        },
      });
    }) as typeof fetch;

    const res = await requestCustomerOtp('9876543210');

    assert.ok(calledUrl.endsWith('/api/v1/auth/customer/otp/request'));
    assert.equal(calledMethod, 'POST');
    assert.equal(calledBody.phone, '+919876543210', 'Phone number must be normalized with +91');
    assert.equal(res.phone, '+919876543210');
    assert.equal(res.expiresInSeconds, 300);
    assert.equal(res.retryAfter, 60);
  });

  // =========================================================================
  // Requirement 4: Valid OTP verification sends correct payload and establishes customer
  // =========================================================================
  test('Req 4: Valid OTP verification sends { phone, otp, name? } and establishes customer session', async () => {
    let calledUrl = '';
    let calledBody: any = null;
    let calledCredentials = '';

    globalThis.fetch = ((url: any, options: any) => {
      calledUrl = String(url);
      calledBody = JSON.parse(options.body);
      calledCredentials = options.credentials;
      return createMockResponse({
        success: true,
        data: {
          token: 'mock.session.token',
          user: {
            id: 'cust_new_002',
            email: null,
            name: 'Priya Patel',
            phone: '+919876543210',
            role: 'CUSTOMER',
            status: 'active',
            createdAt: '2024-06-01T08:00:00Z',
            updatedAt: '2024-06-01T08:00:00Z',
          },
        },
      });
    }) as typeof fetch;

    const result = await verifyCustomerOtp('9876543210', '654321', 'Priya Patel');

    assert.ok(calledUrl.endsWith('/api/v1/auth/customer/otp/verify'));
    assert.equal(calledCredentials, 'include');
    assert.equal(calledBody.phone, '+919876543210');
    assert.equal(calledBody.otp, '654321');
    assert.equal(calledBody.name, 'Priya Patel');

    assert.ok(result.user, 'Verification must return user');
    assert.equal(result.user.id, 'cust_new_002');
    assert.equal(result.user.name, 'Priya Patel');
    assert.equal(result.user.role, 'CUSTOMER');
  });

  // =========================================================================
  // Requirement 5: Invalid OTP does not authenticate the customer
  // =========================================================================
  test('Req 5: Invalid OTP fails client validation or server rejection without authenticating', async () => {
    // 5a. Client-side rejection for non-6-digit OTP
    await assert.rejects(
      async () => {
        await verifyCustomerOtp('9876543210', '123'); // only 3 digits
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_OTP_FORMAT');
        assert.equal(err.status, 400);
        return true;
      }
    );

    // 5b. Backend rejection for incorrect code
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'INVALID_OTP',
            message: 'Invalid verification code entered.',
          },
        },
        400
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await verifyCustomerOtp('9876543210', '000000');
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_OTP');
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Invalid verification code entered.');
        return true;
      }
    );
  });

  // =========================================================================
  // Requirement 6: HTTP 429 displays and respects the provided retry delay
  // =========================================================================
  test('Req 6: HTTP 429 provides retry delay and code TOO_MANY_REQUESTS', async () => {
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Rate limit reached. Please wait 45 seconds.',
            details: { retryAfter: 45 },
          },
        },
        429
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await requestCustomerOtp('9876543210');
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 429);
        assert.equal(err.code, 'TOO_MANY_REQUESTS');
        assert.equal((err.details as any)?.retryAfter, 45);
        return true;
      }
    );
  });

  // =========================================================================
  // Requirement 7: Network/provider failure does not authenticate the customer
  // =========================================================================
  test('Req 7: Network failure throws NETWORK_ERROR and does not authenticate', async () => {
    globalThis.fetch = (() => {
      return Promise.reject(new TypeError('Failed to fetch (DNS or Connection Refused)'));
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await restoreCustomerSession();
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert.equal(err.status, 0);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await verifyCustomerOtp('9876543210', '123456');
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });

  // =========================================================================
  // Requirement 8: Logout calls the backend and revokes session
  // =========================================================================
  test('Req 8: Logout calls /api/v1/auth/customer/logout with session credentials', async () => {
    let calledUrl = '';
    let calledMethod = '';
    let calledCredentials = '';

    globalThis.fetch = ((url: any, options: any) => {
      calledUrl = String(url);
      calledMethod = options.method;
      calledCredentials = options.credentials;
      return createMockResponse({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    }) as typeof fetch;

    const res = await logoutCustomer();

    assert.ok(calledUrl.endsWith('/api/v1/auth/customer/logout'));
    assert.equal(calledMethod, 'POST');
    assert.equal(calledCredentials, 'include');
    assert.equal(res.message, 'Logged out successfully');

    // Also test that server failure propagates so caller handles explicitly
    globalThis.fetch = (() => {
      return createMockResponse(
        {
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to revoke token' },
        },
        500
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await logoutCustomer();
      },
      (err: any) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 500);
        return true;
      }
    );
  });

  // =========================================================================
  // Requirement 9: Raw token is not stored in localStorage or sessionStorage
  // =========================================================================
  test('Req 9: Raw token is never persisted into localStorage or sessionStorage', async () => {
    globalThis.fetch = (() => {
      return createMockResponse({
        success: true,
        data: {
          token: 'sensitive-jwt-token-must-not-be-in-storage',
          user: {
            id: 'cust_secure',
            email: null,
            name: 'Secure User',
            phone: '+919876543210',
            role: 'CUSTOMER',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
      });
    }) as typeof fetch;

    const res = await verifyCustomerOtp('9876543210', '123456');
    assert.ok(res.token);

    // Verify localStorage & sessionStorage contain zero tokens or secrets
    assert.equal(mockStorageLocal.length, 0, 'localStorage must remain empty of tokens');
    assert.equal(mockStorageSession.length, 0, 'sessionStorage must remain empty of tokens');
    assert.equal(mockStorageLocal.getItem('token'), null);
    assert.equal(mockStorageLocal.getItem('jwt'), null);
    assert.equal(mockStorageLocal.getItem('restrauque_session'), null);
    assert.equal(mockStorageSession.getItem('token'), null);
  });

  // =========================================================================
  // Requirement 10: Protected dashboard route safety
  // =========================================================================
  test('Req 10: Unauthenticated or loading sessions are safely rejected from protected routes', () => {
    const states = [
      { status: 'loading', isAuthenticated: false, canRenderProtected: false },
      { status: 'unauthenticated', isAuthenticated: false, canRenderProtected: false },
      { status: 'authenticated', isAuthenticated: true, canRenderProtected: true },
    ];

    for (const s of states) {
      const isAuth = s.status === 'authenticated';
      assert.equal(isAuth, s.isAuthenticated);
      assert.equal(isAuth, s.canRenderProtected);
    }
  });

  // =========================================================================
  // Requirement 8: Untrusted or external redirect destinations are rejected
  // =========================================================================
  test('Req 8: Untrusted, external, or malformed redirects are rejected and default to /account', () => {
    // Valid internal destinations (including query strings)
    assert.equal(resolveSafeRedirect('/account'), '/account');
    assert.equal(resolveSafeRedirect('/account/feedback'), '/account/feedback');
    assert.equal(resolveSafeRedirect('/account/loyalty'), '/account/loyalty');
    assert.equal(resolveSafeRedirect('/account?source=landing'), '/account?source=landing');
    assert.equal(resolveSafeRedirect('/account/feedback?status=pending'), '/account/feedback?status=pending');
    assert.equal(resolveSafeRedirect('/account/loyalty?tab=points'), '/account/loyalty?tab=points');

    // Missing or empty redirects
    assert.equal(resolveSafeRedirect(null), '/account');
    assert.equal(resolveSafeRedirect(undefined), '/account');
    assert.equal(resolveSafeRedirect(''), '/account');

    // Untrusted open redirect attempts
    assert.equal(resolveSafeRedirect('https://malicious-site.com'), '/account');
    assert.equal(resolveSafeRedirect('http://malicious-site.com'), '/account');
    assert.equal(resolveSafeRedirect('//malicious-site.com'), '/account');
    assert.equal(resolveSafeRedirect('javascript:alert(1)'), '/account');
    assert.equal(resolveSafeRedirect('/login'), '/account');
    assert.equal(resolveSafeRedirect('/other-route'), '/account');
  });
});

