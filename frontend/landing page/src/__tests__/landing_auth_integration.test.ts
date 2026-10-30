/**
 * Restrauque Landing Page to Customer Dashboard Integration Tests
 * Uses Node.js native test runner via tsx and strict assertions.
 *
 * Verifies:
 * 1. Landing-page Customer Login resolves to the authoritative customer dashboard login flow.
 * 2. Redirect parameter encoding and safe destination handling.
 * 3. Rejection of untrusted or external redirect destinations.
 * 4. Restaurant owner vs customer routing separation.
 * 5. Absence of credential/token leaks in URLs.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCustomerDashboardBaseUrl,
  getCustomerDashboardLoginUrl,
  getRestaurantDashboardUrl,
} from '../config/authConfig';

describe('Landing Page to Customer Dashboard Integration', () => {
  test('Req 1: Customer Login URL targets authoritative customer dashboard /login route', () => {
    const base = getCustomerDashboardBaseUrl();
    assert.equal(base, 'http://localhost:5176', 'Base URL must default to customer dashboard port 5176');
    const url = getCustomerDashboardLoginUrl();
    assert.ok(url.includes('/login'), 'Must direct to /login route');
    assert.equal(url, 'http://localhost:5176/login', 'Default dev URL must match customer dashboard port 5176');
  });

  test('Req 2: Customer Login URL preserves valid safe internal redirect parameter', () => {
    const targetWithRedirect = getCustomerDashboardLoginUrl('/account/loyalty');
    assert.equal(
      targetWithRedirect,
      'http://localhost:5176/login?redirect=%2Faccount%2Floyalty'
    );
  });

  test('Req 8: Customer Login URL ignores untrusted external or protocol-relative redirects', () => {
    // Malicious open redirect attempts
    assert.equal(getCustomerDashboardLoginUrl('https://evil.com'), 'http://localhost:5176/login');
    assert.equal(getCustomerDashboardLoginUrl('//evil.com/hack'), 'http://localhost:5176/login');
    assert.equal(getCustomerDashboardLoginUrl('javascript:alert(1)'), 'http://localhost:5176/login');
  });

  test('Req 5: Customer routing is completely separated from Restaurant Owner routing', () => {
    const customerLoginUrl = getCustomerDashboardLoginUrl();
    const restaurantDashboardUrl = getRestaurantDashboardUrl();

    assert.ok(customerLoginUrl.endsWith('/login'), 'Customer login goes to /login');
    assert.ok(
      restaurantDashboardUrl.includes('/dashboard'),
      'Restaurant owner URL goes to restaurant dashboard'
    );
    assert.notEqual(customerLoginUrl, restaurantDashboardUrl, 'Customer and restaurant paths must be distinct');
  });

  test('Req 7: No tokens, passwords, or credentials appear in generated URLs', () => {
    const customerUrl = getCustomerDashboardLoginUrl();
    const restaurantUrl = getRestaurantDashboardUrl();

    for (const url of [customerUrl, restaurantUrl]) {
      assert.ok(!url.includes('token='), 'Must not contain token query param');
      assert.ok(!url.includes('jwt='), 'Must not contain jwt query param');
      assert.ok(!url.includes('otp='), 'Must not contain otp query param');
      assert.ok(!url.includes('session='), 'Must not contain session query param');
      assert.ok(!url.includes('#'), 'Must not contain hash fragments');
    }
  });
});
