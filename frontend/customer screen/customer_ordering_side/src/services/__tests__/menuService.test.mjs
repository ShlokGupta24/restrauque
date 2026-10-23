import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCustomerMenu,
  normalizeCustomerMenu,
} from '../menuService.ts';
import { ApiClientError } from '../apiClient.ts';

describe('Restrauque Customer Live Menu Service (menuService)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Valid QR token matching backend constraints (20-128 chars alphanumeric/dash/underscore)
  const validQrToken = 'q7W9xK2mP4vL8nB1jR5tY0uI3';
  const testTableId = '123e4567-e89b-12d3-a456-426614174000';

  // --------------------------------------------------------------------------
  // 1. Query parameter construction and URL encoding
  // --------------------------------------------------------------------------
  test('1. Supplies correctly formatted and URL-encoded qrToken and tableId', async () => {
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
            restaurant: { id: 'rest-1', name: 'Roastery', currency: 'INR' },
            branch: { id: 'br-1', name: 'Downtown' },
            table: { id: testTableId, number: 'T-10' },
            categories: [],
          },
        }),
      };
    };

    await fetchCustomerMenu(validQrToken, testTableId);

    const parsed = new URL(requestedUrl, 'http://localhost');
    assert.equal(parsed.pathname, '/api/v1/customer/menu');
    assert.equal(parsed.searchParams.get('qrToken'), validQrToken);
    assert.equal(parsed.searchParams.get('tableId'), testTableId);
  });

  test('2. Omits tableId parameter when null, undefined, or empty', async () => {
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
            restaurant: { id: 'rest-1', name: 'Roastery', currency: 'INR' },
            branch: { id: 'br-1', name: 'Downtown' },
            table: null,
            categories: [],
          },
        }),
      };
    };

    await fetchCustomerMenu(validQrToken);

    const parsed = new URL(requestedUrl, 'http://localhost');
    assert.equal(parsed.searchParams.get('qrToken'), validQrToken);
    assert.equal(parsed.searchParams.has('tableId'), false);
  });

  test('3. Fast-fails without HTTP call when QR token is missing or invalid format', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Fetch should not be called');
    };

    // Missing token
    for (const invalidToken of [null, undefined, '', '   ']) {
      await assert.rejects(
        async () => {
          await fetchCustomerMenu(invalidToken);
        },
        (err) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.status, 400);
          assert.equal(err.code, 'MISSING_QR_TOKEN');
          return true;
        }
      );
    }

    // Invalid format (too short: < 20 chars)
    await assert.rejects(
      async () => {
        await fetchCustomerMenu('short_token_123');
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_QR_TOKEN');
        return true;
      }
    );

    assert.equal(fetchCalled, false);
  });

  // --------------------------------------------------------------------------
  // 2. Response normalization and data mapping
  // --------------------------------------------------------------------------
  test('4. Maps full backend menu into frontend categories and products with variants and addons', async () => {
    const backendData = {
      restaurant: { id: 'rest-99', name: 'Artisan Café', currency: 'INR' },
      branch: { id: 'br-55', name: 'South End' },
      table: { id: 'tbl-1', number: '5A' },
      categories: [
        {
          id: 'cat-coffee',
          name: 'Coffee & Brews',
          description: 'Single-origin brews',
          displayOrder: 1,
          products: [
            {
              id: 'prod-latte',
              name: 'Hazelnut Latte',
              description: 'Freshly pulled espresso with hazelnut notes',
              price: 220,
              priceFormatted: '₹220',
              imageUrl: 'https://cdn.example.com/latte.jpg',
              displayOrder: 1,
              variants: [
                { id: 'var-reg', name: 'Regular', price: 220, isDefault: true },
                { id: 'var-lrg', name: 'Large', price: 260, isDefault: false },
              ],
              addons: [
                { id: 'add-oat', name: 'Oat Milk', price: 40 },
                { id: 'add-shot', name: 'Extra Shot', price: 50 },
              ],
            },
            {
              id: 'prod-espresso',
              name: 'Doppio Espresso',
              description: 'Double shot',
              price: 150,
              priceFormatted: '₹150',
              imageUrl: 'https://cdn.example.com/espresso.jpg',
              displayOrder: 2,
            },
          ],
        },
        {
          id: 'cat-bakery',
          name: 'Bakery & Pastries',
          description: null,
          displayOrder: 2,
          products: [
            {
              id: 'prod-croissant',
              name: 'Butter Croissant',
              description: 'Flaky French pastry',
              price: 180,
              priceFormatted: '₹180',
              imageUrl: null,
              displayOrder: 1,
            },
          ],
        },
      ],
    };

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: backendData,
      }),
    });

    const result = await fetchCustomerMenu(validQrToken, testTableId);

    // Meta verification
    assert.deepEqual(result.restaurant, backendData.restaurant);
    assert.deepEqual(result.branch, backendData.branch);
    assert.deepEqual(result.table, backendData.table);

    // Categories verification: prepended with synthetic 'cat-all'
    assert.equal(result.categories.length, 3);
    assert.equal(result.categories[0].id, 'cat-all');
    assert.equal(result.categories[0].name, 'All Items');
    assert.equal(result.categories[0].displayOrder, -1);

    assert.equal(result.categories[1].id, 'cat-coffee');
    assert.equal(result.categories[1].name, 'Coffee & Brews');
    assert.equal(result.categories[1].description, 'Single-origin brews');
    assert.equal(result.categories[1].displayOrder, 1);

    assert.equal(result.categories[2].id, 'cat-bakery');
    assert.equal(result.categories[2].name, 'Bakery & Pastries');
    assert.equal(result.categories[2].description, undefined);

    // Products verification: flattened across categories
    assert.equal(result.products.length, 3);

    const latte = result.products.find((p) => p.id === 'prod-latte');
    assert.ok(latte);
    assert.equal(latte.categoryId, 'cat-coffee');
    assert.equal(latte.name, 'Hazelnut Latte');
    assert.equal(latte.description, 'Freshly pulled espresso with hazelnut notes');
    assert.equal(latte.price, 220);
    assert.equal(latte.imageUrl, 'https://cdn.example.com/latte.jpg');
    assert.equal(latte.isAvailable, true);

    // Variant delta calculation: priceDelta = variant.price - product.price
    assert.equal(latte.variants.length, 2);
    assert.equal(latte.variants[0].id, 'var-reg');
    assert.equal(latte.variants[0].name, 'Regular');
    assert.equal(latte.variants[0].priceDelta, 0); // 220 - 220 = 0
    assert.equal(latte.variants[0].price, 220);
    assert.equal(latte.variants[0].isDefault, true);

    assert.equal(latte.variants[1].id, 'var-lrg');
    assert.equal(latte.variants[1].name, 'Large');
    assert.equal(latte.variants[1].priceDelta, 40); // 260 - 220 = 40
    assert.equal(latte.variants[1].price, 260);
    assert.equal(latte.variants[1].isDefault, false);

    // Addons
    assert.equal(latte.addons.length, 2);
    assert.equal(latte.addons[0].id, 'add-oat');
    assert.equal(latte.addons[0].name, 'Oat Milk');
    assert.equal(latte.addons[0].price, 40);

    // Product with null image
    const croissant = result.products.find((p) => p.id === 'prod-croissant');
    assert.ok(croissant);
    assert.equal(croissant.imageUrl, '');
    assert.deepEqual(croissant.variants, []);
    assert.deepEqual(croissant.addons, []);
  });

  // --------------------------------------------------------------------------
  // 3. Empty menu responses
  // --------------------------------------------------------------------------
  test('5. Handles empty categories list correctly without error', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: {
          restaurant: { id: 'rest-1', name: 'Empty Diner', currency: 'INR' },
          branch: null,
          table: null,
          categories: [],
        },
      }),
    });

    const result = await fetchCustomerMenu(validQrToken);

    // Synthetic 'cat-all' is still available for tab render
    assert.equal(result.categories.length, 1);
    assert.equal(result.categories[0].id, 'cat-all');
    assert.equal(result.products.length, 0);
  });

  // --------------------------------------------------------------------------
  // 4. Products with missing or nullable optional fields
  // --------------------------------------------------------------------------
  test('6. Normalizes products with missing, null, or undefined fields safely', () => {
    const rawData = {
      restaurant: { id: 'r1', name: 'Test' },
      categories: [
        {
          id: 'cat-1',
          name: 'Specials',
          products: [
            {
              id: 'p1',
              name: 'Daily Soup',
              price: 120,
              description: null,
              imageUrl: null,
              displayOrder: undefined,
              variants: null,
              addons: undefined,
            },
          ],
        },
      ],
    };

    const normalized = normalizeCustomerMenu(rawData);
    assert.equal(normalized.products.length, 1);
    const p = normalized.products[0];
    assert.equal(p.id, 'p1');
    assert.equal(p.description, '');
    assert.equal(p.imageUrl, '');
    assert.deepEqual(p.variants, []);
    assert.deepEqual(p.addons, []);
    assert.equal(p.isAvailable, true);
  });

  // --------------------------------------------------------------------------
  // 5. Backend errors and malformed responses
  // --------------------------------------------------------------------------
  test('7. Propagates 404 venue not found as ApiClientError', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'TABLE_NOT_FOUND',
          message: 'The table associated with this QR token could not be found.',
        },
      }),
    });

    await assert.rejects(
      async () => {
        await fetchCustomerMenu(validQrToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'TABLE_NOT_FOUND');
        assert.match(err.message, /The table associated with this QR token/);
        return true;
      }
    );
  });

  test('8. Handles 500 server error without crashing', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred.',
        },
      }),
    });

    await assert.rejects(
      async () => {
        await fetchCustomerMenu(validQrToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 500);
        assert.equal(err.code, 'INTERNAL_ERROR');
        return true;
      }
    );
  });

  test('9. Handles non-JSON / HTML error responses safely', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body>502 Bad Gateway</body></html>',
    });

    await assert.rejects(
      async () => {
        await fetchCustomerMenu(validQrToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.status, 502);
        return true;
      }
    );
  });

  test('10. Throws when response envelope has missing or malformed categories', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: null, // Malformed: missing data object
      }),
    });

    await assert.rejects(
      async () => {
        await fetchCustomerMenu(validQrToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'INVALID_MENU_PAYLOAD');
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // 6. Request cancellation via AbortSignal
  // --------------------------------------------------------------------------
  test('11. Supports cancellation via AbortSignal', async () => {
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

    const promise = fetchCustomerMenu(validQrToken, null, controller.signal);
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
  // 7. Isolation: failed live request does NOT fall back to mock data
  // --------------------------------------------------------------------------
  test('12. Fails cleanly on error and never silently falls back to mock fixtures', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network offline');
    };

    await assert.rejects(
      async () => {
        await fetchCustomerMenu(validQrToken);
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  });

  test('13. Live catalog product lookup strictly returns live items and never fabricates mock fixtures for missing products', async () => {
    globalThis.fetch = async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            restaurant: { id: 'rest-1', name: 'Roastery', currency: 'INR' },
            branch: { id: 'br-1', name: 'Downtown' },
            table: { id: testTableId, number: 'T-10' },
            categories: [
              {
                id: 'cat-1',
                name: 'Beverages',
                products: [
                  {
                    id: 'live-prod-101',
                    name: 'Single Origin Espresso',
                    price: 180,
                    isAvailable: true,
                    variants: [],
                    addons: [],
                  },
                ],
              },
            ],
          },
        }),
      };
    };

    const menu = await fetchCustomerMenu(validQrToken, testTableId);
    assert.equal(menu.products.length, 1);
    assert.equal(menu.products[0].id, 'live-prod-101');

    // Missing product query should strictly return null/undefined and never fabricate 'prod-iced-latte'
    const missingProduct = menu.products.find((p) => p.id === 'prod-iced-latte');
    assert.equal(missingProduct, undefined);
  });

  // --------------------------------------------------------------------------
  // 7. Menu Pricing & Variant Normalization (Regression Tests)
  // --------------------------------------------------------------------------
  test('14. Product without variants retains its base price and decimal precision in customer menu', () => {
    const rawData = {
      restaurant: { id: 'r1', name: 'Test' },
      categories: [
        {
          id: 'cat-desserts',
          name: 'Desserts',
          displayOrder: 1,
          products: [
            {
              id: 'prod-simple-tart',
              name: 'Fruit Tart',
              price: 185.75,
              variants: [],
              addons: [],
            },
          ],
        },
      ],
    };

    const normalized = normalizeCustomerMenu(rawData);
    assert.equal(normalized.products.length, 1);
    const prod = normalized.products[0];
    assert.equal(prod.id, 'prod-simple-tart');
    assert.equal(prod.price, 185.75);
    assert.deepEqual(prod.variants, []);
  });

  test('15. Product with variants uses the selected variant authoritative price', () => {
    const rawData = {
      restaurant: { id: 'r1', name: 'Test' },
      categories: [
        {
          id: 'cat-desserts',
          name: 'Desserts',
          displayOrder: 1,
          products: [
            {
              id: 'prod-brownie',
              name: 'Brownie',
              price: 250,
              variants: [
                { id: 'var-lg', name: 'Large', price: 280, displayOrder: 0 },
                { id: 'var-sm', name: 'small', price: 200, displayOrder: 1 },
              ],
              addons: [],
            },
          ],
        },
      ],
    };

    const normalized = normalizeCustomerMenu(rawData);
    const brownie = normalized.products[0];
    assert.equal(brownie.price, 250);
    assert.equal(brownie.variants.length, 2);
    assert.equal(brownie.variants[0].name, 'Large');
    assert.equal(brownie.variants[0].price, 280);
    assert.equal(brownie.variants[0].priceDelta, 30);
    assert.equal(brownie.variants[1].name, 'small');
    assert.equal(brownie.variants[1].price, 200);
    assert.equal(brownie.variants[1].priceDelta, -50);
  });

  test('16. REGRESSION: Product with base price 149.30 and a variant stored with price 0 resolves variant price to 149.30 with priceDelta 0 (does not become ₹0)', () => {
    // This replicates the defect where "cake" (base price 149.3) had a variant "large" with price 0 in DB
    const rawData = {
      restaurant: { id: 'r1', name: 'Test' },
      categories: [
        {
          id: 'cat-desserts',
          name: 'Desserts',
          displayOrder: 1,
          products: [
            {
              id: 'prod-cake-149',
              name: 'cake',
              price: 149.3,
              variants: [
                { id: 'var-cake-large', name: 'large', price: 0, displayOrder: 0 },
              ],
              addons: [],
            },
          ],
        },
      ],
    };

    const normalized = normalizeCustomerMenu(rawData);
    const cake = normalized.products[0];
    assert.equal(cake.price, 149.3);
    assert.equal(cake.variants.length, 1);
    const variant = cake.variants[0];
    // Variant must inherit base price 149.3 and have priceDelta 0 (not -149.3)
    assert.equal(variant.price, 149.3);
    assert.equal(variant.priceDelta, 0);
  });

  test('17. Legitimate free product (base price 0) with a 0-price variant retains ₹0 price and is not treated as an error', () => {
    const rawData = {
      restaurant: { id: 'r1', name: 'Test' },
      categories: [
        {
          id: 'cat-free',
          name: 'Complimentary',
          displayOrder: 1,
          products: [
            {
              id: 'prod-mint',
              name: 'After-Dinner Mint',
              price: 0,
              variants: [
                { id: 'var-single', name: 'Single Piece', price: 0, displayOrder: 0 },
              ],
              addons: [],
            },
          ],
        },
      ],
    };

    const normalized = normalizeCustomerMenu(rawData);
    const mint = normalized.products[0];
    assert.equal(mint.price, 0);
    assert.equal(mint.variants[0].price, 0);
    assert.equal(mint.variants[0].priceDelta, 0);
  });

  test('18. Decimal prices survive normalization accurately from numbers and decimal strings', () => {
    const rawData = {
      restaurant: { id: 'r1', name: 'Test' },
      categories: [
        {
          id: 'cat-mains',
          name: 'Mains',
          displayOrder: 1,
          products: [
            {
              id: 'prod-dec-1',
              name: 'Pasta Carbonara',
              price: '299.60',
              variants: [
                { id: 'var-regular', name: 'Regular', price: '299.60' },
              ],
              addons: [
                { id: 'add-cheese', name: 'Parmesan', price: '29.69' },
              ],
            },
          ],
        },
      ],
    };

    const normalized = normalizeCustomerMenu(rawData);
    const pasta = normalized.products[0];
    assert.equal(pasta.price, 299.6);
    assert.equal(pasta.variants[0].price, 299.6);
    assert.equal(pasta.variants[0].priceDelta, 0);
    assert.equal(pasta.addons[0].price, 29.69);
  });
});
