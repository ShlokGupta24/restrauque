import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession, revokeCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { generateSecureQrToken, hashQrToken } from '@/lib/qr/token';

import { GET as getCustomerMenuHandler } from '@/app/api/v1/customer/menu/route';
import { POST as previewOrderHandler } from '@/app/api/v1/customer/orders/preview/route';
import { POST as createOrderHandler } from '@/app/api/v1/customer/orders/route';
import { GET as getOrderStatusHandler } from '@/app/api/v1/customer/orders/[orderId]/route';

describe('STEP 6 — Phase 2B: Customer Dine-In Ordering, Pricing & Idempotency', () => {
  const timestamp = Date.now();

  // Test Owner & Venue 1
  let owner1Id: string;
  let owner1Token: string;
  let restaurant1Id: string;
  let branch1Id: string;

  // Venue 2 (For cross-restaurant isolation testing)
  let restaurant2Id: string;
  let branch2Id: string;

  // Tables & QR Tokens
  let table1Id: string;
  let table1RawToken: string;
  let table2ReservedId: string;
  let table2ReservedRawToken: string;
  let table3MaintenanceId: string;
  let table3MaintenanceRawToken: string;

  // Catalog items for Restaurant 1
  let category1Id: string;
  let product1Id: string; // Base product with variants & addons
  let product1Variant1Id: string; // Regular
  let product1Variant2Id: string; // Large
  let product1Addon1Id: string; // Extra Shot
  let product2Id: string; // Simple product without variants
  let productInactiveId: string;
  let productUnavailableId: string;

  // Catalog item for Restaurant 2 (Cross-restaurant test)
  let restaurant2ProductId: string;

  // Coupon for Restaurant 1
  let testCouponId: string;
  const couponCode = `TEST50_${timestamp}`;

  // Customer A (Primary tester)
  let customerAId: string;
  let customerAToken: string;
  let customerASessionId: string;

  // Customer B (For cross-customer order status isolation)
  let customerBId: string;
  let customerBToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecurePass123!');

    // 1. Create Owner 1
    const owner1 = await prisma.users.create({
      data: {
        email: `ordering_owner_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Ordering Test Owner',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner1Id = owner1.id;

    const ownerSession = await createDatabaseSession(owner1Id);
    owner1Token = await createJwtToken({
      userId: owner1Id,
      sessionId: ownerSession.sessionId,
      sessionToken: ownerSession.sessionToken,
      email: owner1.email,
      role: 'RESTAURANT_OWNER',
    });

    // 2. Create Restaurant 1 and Branch 1
    const rest1 = await prisma.restaurants.create({
      data: {
        name: `Restraque Dine Cafe ${timestamp}`,
        legal_name: 'Dine Cafe Pvt Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    restaurant1Id = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: restaurant1Id,
        name: 'Main Cafe Branch',
        status: 'active',
      },
    });
    branch1Id = branch1.id;

    // 3. Create Restaurant 2 and Branch 2 for Cross-Venue tests
    const rest2 = await prisma.restaurants.create({
      data: {
        name: `Other Restaurant ${timestamp}`,
        owner_id: owner1Id,
        status: 'active',
      },
    });
    restaurant2Id = rest2.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: restaurant2Id,
        name: 'Other Branch',
        status: 'active',
      },
    });
    branch2Id = branch2.id;

    // 4. Create Tables & QR codes for Branch 1
    const t1 = await prisma.restaurant_tables.create({
      data: {
        branch_id: branch1Id,
        table_number: 'T-01',
        capacity: 4,
        status: 'available',
        is_active: true,
      },
    });
    table1Id = t1.id;
    table1RawToken = generateSecureQrToken();
    await prisma.qr_codes.create({
      data: {
        table_id: table1Id,
        code: hashQrToken(table1RawToken),
        qr_type: 'table',
        is_active: true,
      },
    });

    const t2 = await prisma.restaurant_tables.create({
      data: {
        branch_id: branch1Id,
        table_number: 'T-02',
        capacity: 2,
        status: 'reserved',
        is_active: true,
      },
    });
    table2ReservedId = t2.id;
    table2ReservedRawToken = generateSecureQrToken();
    await prisma.qr_codes.create({
      data: {
        table_id: table2ReservedId,
        code: hashQrToken(table2ReservedRawToken),
        qr_type: 'table',
        is_active: true,
      },
    });

    const t3 = await prisma.restaurant_tables.create({
      data: {
        branch_id: branch1Id,
        table_number: 'T-03',
        capacity: 6,
        status: 'maintenance',
        is_active: true,
      },
    });
    table3MaintenanceId = t3.id;
    table3MaintenanceRawToken = generateSecureQrToken();
    await prisma.qr_codes.create({
      data: {
        table_id: table3MaintenanceId,
        code: hashQrToken(table3MaintenanceRawToken),
        qr_type: 'table',
        is_active: true,
      },
    });

    // 5. Create Menu Catalog for Restaurant 1
    const cat1 = await prisma.categories.create({
      data: {
        restaurant_id: restaurant1Id,
        name: `Beverages ${timestamp}`,
        display_order: 1,
        is_active: true,
      },
    });
    category1Id = cat1.id;

    // Product 1: Cappuccino with variants and addons
    const p1 = await prisma.products.create({
      data: {
        restaurant_id: restaurant1Id,
        category_id: category1Id,
        name: `Cappuccino ${timestamp}`,
        price: 200.0,
        display_order: 1,
        is_active: true,
        is_available: true,
      },
    });
    product1Id = p1.id;

    const v1 = await prisma.product_variants.create({
      data: {
        product_id: product1Id,
        name: 'Regular',
        price: 200.0,
        is_active: true,
        is_available: true,
      },
    });
    product1Variant1Id = v1.id;

    const v2 = await prisma.product_variants.create({
      data: {
        product_id: product1Id,
        name: 'Large',
        price: 250.0,
        is_active: true,
        is_available: true,
      },
    });
    product1Variant2Id = v2.id;

    const a1 = await prisma.product_addons.create({
      data: {
        product_id: product1Id,
        name: 'Extra Shot',
        price: 50.0,
        is_active: true,
        is_available: true,
      },
    });
    product1Addon1Id = a1.id;

    // Product 2: Plain Croissant
    const p2 = await prisma.products.create({
      data: {
        restaurant_id: restaurant1Id,
        category_id: category1Id,
        name: `Croissant ${timestamp}`,
        price: 150.0,
        display_order: 2,
        is_active: true,
        is_available: true,
      },
    });
    product2Id = p2.id;

    // Product 3: Inactive Product
    const pInactive = await prisma.products.create({
      data: {
        restaurant_id: restaurant1Id,
        category_id: category1Id,
        name: `Inactive Muffin ${timestamp}`,
        price: 100.0,
        is_active: false,
        is_available: true,
      },
    });
    productInactiveId = pInactive.id;

    // Product 4: Unavailable Product
    const pUnavail = await prisma.products.create({
      data: {
        restaurant_id: restaurant1Id,
        category_id: category1Id,
        name: `Sold Out Cake ${timestamp}`,
        price: 180.0,
        is_active: true,
        is_available: false,
      },
    });
    productUnavailableId = pUnavail.id;

    // Product for Restaurant 2
    const pRest2 = await prisma.products.create({
      data: {
        restaurant_id: restaurant2Id,
        category_id: (
          await prisma.categories.create({
            data: {
              restaurant_id: restaurant2Id,
              name: `Rest 2 Cat ${timestamp}`,
            },
          })
        ).id,
        name: `Foreign Burger ${timestamp}`,
        price: 300.0,
        is_active: true,
        is_available: true,
      },
    });
    restaurant2ProductId = pRest2.id;

    // 6. Create Coupon for Restaurant 1 (50% off, max 100)
    const coup = await prisma.coupons.create({
      data: {
        restaurant_id: restaurant1Id,
        code: couponCode,
        name: '50% Promo',
        discount_type: 'percentage',
        discount_value: 50.0,
        maximum_discount_amount: 100.0,
        minimum_order_amount: 200.0,
        is_active: true,
      },
    });
    testCouponId = coup.id;

    // 7. Create Customers A and B
    const custA = await prisma.customers.create({
      data: {
        phone: `+919900000001`,
        name: 'Customer A',
        status: 'active',
      },
    });
    customerAId = custA.id;

    const sessionA = await createCustomerDatabaseSession(customerAId);
    customerASessionId = sessionA.sessionId;
    customerAToken = await createJwtToken({
      userId: customerAId,
      sessionId: sessionA.sessionId,
      sessionToken: sessionA.sessionToken,
      phone: custA.phone,
      role: 'CUSTOMER',
    });

    const custB = await prisma.customers.create({
      data: {
        phone: `+919900000002`,
        name: 'Customer B',
        status: 'active',
      },
    });
    customerBId = custB.id;

    const sessionB = await createCustomerDatabaseSession(customerBId);
    customerBToken = await createJwtToken({
      userId: customerBId,
      sessionId: sessionB.sessionId,
      sessionToken: sessionB.sessionToken,
      phone: custB.phone,
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    try {
      if (restaurant1Id) {
        // Clean up orders and relations
        await prisma.order_coupons.deleteMany({
          where: { coupons: { restaurant_id: restaurant1Id } },
        }).catch(() => {});
        await prisma.order_item_addons.deleteMany({
          where: { order_items: { orders: { restaurant_id: restaurant1Id } } },
        }).catch(() => {});
        await prisma.order_items.deleteMany({
          where: { orders: { restaurant_id: restaurant1Id } },
        }).catch(() => {});
        await prisma.order_status_history.deleteMany({
          where: { orders: { restaurant_id: restaurant1Id } },
        }).catch(() => {});
        const restIds = [restaurant1Id, restaurant2Id].filter(Boolean);
        if (restIds.length > 0) {
          await prisma.orders.deleteMany({
            where: { restaurant_id: { in: restIds } },
          }).catch(() => {});
        }

        // Clean up catalog
        await prisma.product_addons.deleteMany({
          where: { products: { restaurant_id: restaurant1Id } },
        }).catch(() => {});
        await prisma.product_variants.deleteMany({
          where: { products: { restaurant_id: restaurant1Id } },
        }).catch(() => {});
        if (restIds.length > 0) {
          await prisma.products.deleteMany({
            where: { restaurant_id: { in: restIds } },
          }).catch(() => {});
          await prisma.categories.deleteMany({
            where: { restaurant_id: { in: restIds } },
          }).catch(() => {});
        }

        // Clean up tables & QR
        await prisma.qr_codes.deleteMany({
          where: { restaurant_tables: { branches: { restaurant_id: restaurant1Id } } },
        }).catch(() => {});
        await prisma.restaurant_tables.deleteMany({
          where: { branches: { restaurant_id: restaurant1Id } },
        }).catch(() => {});

        // Clean up branches & venues
        if (restIds.length > 0) {
          await prisma.branches.deleteMany({
            where: { restaurant_id: { in: restIds } },
          }).catch(() => {});
          await prisma.restaurants.deleteMany({
            where: { id: { in: restIds } },
          }).catch(() => {});
        }
      }

      if (testCouponId) {
        await prisma.coupons.deleteMany({
          where: { id: testCouponId },
        }).catch(() => {});
      }

      // Clean up users & customers
      const custIds = [customerAId, customerBId].filter(Boolean);
      if (custIds.length > 0) {
        await prisma.customer_sessions.deleteMany({
          where: { customer_id: { in: custIds } },
        }).catch(() => {});
        await prisma.customers.deleteMany({
          where: { id: { in: custIds } },
        }).catch(() => {});
      }
      if (owner1Id) {
        await prisma.user_sessions.deleteMany({
          where: { user_id: owner1Id },
        }).catch(() => {});
        await prisma.users.deleteMany({
          where: { id: owner1Id },
        }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // =========================================================================
  // 1. Customer Menu Browsing (GET /api/v1/customer/menu)
  // =========================================================================
  describe('1. Customer Menu Browsing (GET /api/v1/customer/menu)', () => {
    it('should reject requests with missing qrToken', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/menu');
      const res = await getCustomerMenuHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid or non-existent QR token', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/customer/menu?qrToken=invalid_token_12345678901234567890'
      );
      const res = await getCustomerMenuHandler(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should reject table ID mismatch against QR token', async () => {
      const mismatchedTableId = '00000000-0000-0000-0000-000000000000';
      const req = new NextRequest(
        `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${mismatchedTableId}`
      );
      const res = await getCustomerMenuHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('does not belong to the specified table');
    });

    it('should reject QR code when table is under maintenance', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/customer/menu?qrToken=${table3MaintenanceRawToken}`
      );
      const res = await getCustomerMenuHandler(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('unavailable or under maintenance');
    });

    it('should successfully return menu categories, active/available products, variants, and addons', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
      );
      const res = await getCustomerMenuHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurant.id).toBe(restaurant1Id);
      expect(json.data.branch.id).toBe(branch1Id);
      expect(json.data.table.id).toBe(table1Id);
      expect(json.data.table.tableNumber).toBe('T-01');

      // Check categories and products
      expect(json.data.categories.length).toBeGreaterThanOrEqual(1);
      const category = json.data.categories.find((c: any) => c.id === category1Id);
      expect(category).toBeDefined();

      const productIds = category.products.map((p: any) => p.id);
      expect(productIds).toContain(product1Id);
      expect(productIds).toContain(product2Id);
      // Inactive and unavailable products must be excluded
      expect(productIds).not.toContain(productInactiveId);
      expect(productIds).not.toContain(productUnavailableId);

      // Verify Cappuccino details
      const cappuccino = category.products.find((p: any) => p.id === product1Id);
      expect(cappuccino.variants.length).toBe(2);
      expect(cappuccino.addons.length).toBe(1);
      expect(cappuccino.addons[0].name).toBe('Extra Shot');
      expect(cappuccino.addons[0].price).toBe(50.0);
    });

    it('should strictly exclude inactive categories from customer menu response', async () => {
      // Create a temporary inactive category
      const inactiveCategory = await prisma.categories.create({
        data: {
          restaurant_id: restaurant1Id,
          name: `Inactive Desserts ${timestamp}`,
          display_order: 99,
          is_active: false,
        },
      });

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
        );
        const res = await getCustomerMenuHandler(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);

        // Assert inactive category is completely absent from customer menu
        const found = json.data.categories.find((c: any) => c.id === inactiveCategory.id);
        expect(found).toBeUndefined();
      } finally {
        await prisma.categories.deleteMany({
          where: { id: inactiveCategory.id },
        });
      }
    });

    it('should return 422 CATALOG_SIZE_LIMIT_EXCEEDED when category count exceeds maximum supported categories', async () => {
      // Temporarily add a second active category to restaurant 1
      const extraCategory = await prisma.categories.create({
        data: {
          restaurant_id: restaurant1Id,
          name: `Extra Active Category ${Date.now()}`,
          is_active: true,
        },
      });

      process.env.TEST_OVERRIDE_MAX_CATEGORIES = '1';

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
        );
        const res = await getCustomerMenuHandler(req);
        expect(res.status).toBe(422);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('CATALOG_SIZE_LIMIT_EXCEEDED');
        expect(json.error.message).toContain('category limit');
      } finally {
        delete process.env.TEST_OVERRIDE_MAX_CATEGORIES;
        await prisma.categories.deleteMany({
          where: { id: extraCategory.id },
        });
      }
    });

    it('should return 422 CATALOG_SIZE_LIMIT_EXCEEDED when products in a category exceed supported products limit', async () => {
      // Category 1 has 2 active+available products (Cappuccino and Croissant)
      process.env.TEST_OVERRIDE_MAX_PRODUCTS_PER_CATEGORY = '1';

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
        );
        const res = await getCustomerMenuHandler(req);
        expect(res.status).toBe(422);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('CATALOG_SIZE_LIMIT_EXCEEDED');
        expect(json.error.message).toContain('products per category limit');
      } finally {
        delete process.env.TEST_OVERRIDE_MAX_PRODUCTS_PER_CATEGORY;
      }
    });

    it('should return 422 CATALOG_SIZE_LIMIT_EXCEEDED when product variants exceed supported variants limit', async () => {
      // Product 1 (Cappuccino) has 2 active+available variants (Small and Large)
      process.env.TEST_OVERRIDE_MAX_VARIANTS_PER_PRODUCT = '1';

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
        );
        const res = await getCustomerMenuHandler(req);
        expect(res.status).toBe(422);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('CATALOG_SIZE_LIMIT_EXCEEDED');
        expect(json.error.message).toContain('variants per product limit');
      } finally {
        delete process.env.TEST_OVERRIDE_MAX_VARIANTS_PER_PRODUCT;
      }
    });

    it('should return 422 CATALOG_SIZE_LIMIT_EXCEEDED when product add-ons exceed supported add-ons limit', async () => {
      // Product 1 (Cappuccino) has 1 active+available add-on (Extra Shot)
      process.env.TEST_OVERRIDE_MAX_ADDONS_PER_PRODUCT = '0';

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
        );
        const res = await getCustomerMenuHandler(req);
        expect(res.status).toBe(422);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('CATALOG_SIZE_LIMIT_EXCEEDED');
        expect(json.error.message).toContain('add-ons per product limit');
      } finally {
        delete process.env.TEST_OVERRIDE_MAX_ADDONS_PER_PRODUCT;
      }
    });

    it('should successfully return menu when catalog counts match the supported limit exactly', async () => {
      // Exactly 2 active+available products in category 1; set limit to 2
      process.env.TEST_OVERRIDE_MAX_PRODUCTS_PER_CATEGORY = '2';

      try {
        const req = new NextRequest(
          `http://localhost:3000/api/v1/customer/menu?qrToken=${table1RawToken}&tableId=${table1Id}`
        );
        const res = await getCustomerMenuHandler(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);
        const category = json.data.categories.find((c: any) => c.id === category1Id);
        expect(category).toBeDefined();
        expect(category.products.length).toBe(2);
      } finally {
        delete process.env.TEST_OVERRIDE_MAX_PRODUCTS_PER_CATEGORY;
      }
    });
  });

  // =========================================================================
  // 2. Order Preview & Authoritative Pricing (POST /api/v1/customer/orders/preview)
  // =========================================================================
  describe('2. Order Preview & Authoritative Pricing (POST /api/v1/customer/orders/preview)', () => {
    it('should reject unauthenticated preview requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: table1RawToken,
          items: [{ productId: product2Id, quantity: 1 }],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(401);
    });

    it('should reject preview with empty cart', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          items: [],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject preview with invalid quantity <= 0', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          items: [{ productId: product2Id, quantity: 0 }],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(400);
    });

    it('should reject preview referencing cross-restaurant product', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          items: [{ productId: restaurant2ProductId, quantity: 1 }],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.message).toContain('does not belong to this restaurant');
    });

    it('should reject preview with inactive or unavailable product', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          items: [{ productId: productUnavailableId, quantity: 1 }],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain('currently unavailable or inactive');
    });

    it('should compute authoritative prices, line totals, addons, and subtotal ignoring client prices', async () => {
      // 2x Large Cappuccino (250) + Extra Shot (50) = 300 per coffee * 2 = 600
      // 1x Croissant (150) = 150
      // Subtotal = 750
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          tableId: table1Id,
          items: [
            {
              productId: product1Id,
              variantId: product1Variant2Id, // Large (250)
              addonIds: [product1Addon1Id], // Extra Shot (50)
              quantity: 2,
              specialInstructions: 'Extra hot please',
              // Client attempt to inject arbitrary price (should be completely ignored)
              unitPrice: 1.0,
              totalPrice: 2.0,
            },
            {
              productId: product2Id,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.isValid).toBe(true);
      expect(json.data.pricing.subtotal).toBe(750.0);
      expect(json.data.pricing.discountAmount).toBe(0.0);
      expect(json.data.pricing.taxAmount).toBe(0.0);
      expect(json.data.pricing.totalAmount).toBe(750.0);

      // Verify line items breakdown
      const item1 = json.data.items[0];
      expect(item1.unitPrice).toBe(250.0);
      expect(item1.quantity).toBe(2);
      expect(item1.totalPrice).toBe(600.0);
      expect(item1.addons.length).toBe(1);
      expect(item1.addons[0].totalPrice).toBe(100.0);

      const item2 = json.data.items[1];
      expect(item2.unitPrice).toBe(150.0);
      expect(item2.totalPrice).toBe(150.0);
    });

    it('should apply valid coupon discount and respect maximum discount cap', async () => {
      // Subtotal = 750.0. 50% discount = 375.0, capped at max 100.0 => discount = 100.0, total = 650.0
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          couponCode: couponCode,
          items: [
            {
              productId: product1Id,
              variantId: product1Variant2Id,
              addonIds: [product1Addon1Id],
              quantity: 2,
            },
            {
              productId: product2Id,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await previewOrderHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.pricing.subtotal).toBe(750.0);
      expect(json.data.pricing.discountAmount).toBe(100.0);
      expect(json.data.pricing.totalAmount).toBe(650.0);
      expect(json.data.coupon.code).toBe(couponCode);
    });
  });

  // =========================================================================
  // 3. Transactional Order Submission (POST /api/v1/customer/orders)
  // =========================================================================
  describe('3. Transactional Order Submission (POST /api/v1/customer/orders)', () => {
    let createdOrderId: string;
    let initialOrderNumber: string;
    const testIdempotencyKey = `idemp_${timestamp}_1`;

    it('should reject unauthenticated order submission with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken: table1RawToken,
          items: [{ productId: product2Id, quantity: 1 }],
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(401);
    });

    it('should reject ordering when table is reserved', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table2ReservedRawToken,
          items: [{ productId: product2Id, quantity: 1 }],
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('reserved');
    });

    it('should reject submission with 409 PRICE_CHANGED if expectedTotal differs from catalog price', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          tableId: table1Id,
          expectedTotal: 100.0, // Stale expected total (actual is 150)
          items: [{ productId: product2Id, quantity: 1 }],
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('PRICE_CHANGED');
      expect(json.error.details.currentTotal).toBe(150.0);
    });

    it('should atomically create order, items, snapshots, status history, and transition table to occupied', async () => {
      // Verify table is initially available
      const tableBefore = await prisma.restaurant_tables.findUnique({
        where: { id: table1Id },
      });
      expect(tableBefore?.status).toBe('available');

      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          tableId: table1Id,
          idempotencyKey: testIdempotencyKey,
          expectedTotal: 600.0,
          items: [
            {
              productId: product1Id,
              variantId: product1Variant2Id, // Large 250
              addonIds: [product1Addon1Id], // Extra Shot 50
              quantity: 2,
              specialInstructions: 'Oat milk if available',
            },
          ],
          notes: 'Please bring tissues',
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.orderNumber).toMatch(/^ORD-\d{8}-[2-9A-Z]{4}$/);
      expect(json.data.status).toBe('pending');
      expect(json.data.orderType).toBe('dine_in');
      expect(json.data.pricing.totalAmount).toBe(600.0);

      createdOrderId = json.data.id;
      initialOrderNumber = json.data.orderNumber;

      // Verify Table transitioned to 'occupied'
      const tableAfter = await prisma.restaurant_tables.findUnique({
        where: { id: table1Id },
      });
      expect(tableAfter?.status).toBe('occupied');

      // Verify DB records
      const dbOrder = await prisma.orders.findUnique({
        where: { id: createdOrderId },
        include: {
          order_items: {
            include: { order_item_addons: true },
          },
          order_status_history: true,
        },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.customer_id).toBe(customerAId);
      expect(dbOrder?.table_id).toBe(table1Id);
      expect(dbOrder?.idempotency_key).toBe(testIdempotencyKey);
      expect(dbOrder?.order_items.length).toBe(1);

      // Verify historical item snapshots
      const dbItem = dbOrder!.order_items[0];
      expect(dbItem.product_name).toContain('Cappuccino');
      expect(dbItem.variant_name).toBe('Large');
      expect(Number(dbItem.unit_price)).toBe(250.0);
      expect(Number(dbItem.total_price)).toBe(600.0);
      expect(dbItem.special_instructions).toBe('Oat milk if available');

      // Verify addon snapshot
      expect(dbItem.order_item_addons.length).toBe(1);
      const dbAddon = dbItem.order_item_addons[0];
      expect(dbAddon.addon_name).toBe('Extra Shot');
      expect(Number(dbAddon.unit_price)).toBe(50.0);
      expect(Number(dbAddon.total_price)).toBe(100.0);

      // Verify initial status history
      expect(dbOrder!.order_status_history.length).toBe(1);
      expect(dbOrder!.order_status_history[0].status).toBe('pending');
    });

    it('should return original committed order upon duplicate submission with same idempotencyKey (Idempotency Replay)', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          tableId: table1Id,
          idempotencyKey: testIdempotencyKey,
          expectedTotal: 600.0,
          items: [
            {
              productId: product1Id,
              variantId: product1Variant2Id,
              addonIds: [product1Addon1Id],
              quantity: 2,
              specialInstructions: 'Oat milk if available',
            },
          ],
          notes: 'Please bring tissues',
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Idempotent-Replay')).toBe('true');

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(createdOrderId);
      expect(json.data.orderNumber).toBe(initialOrderNumber);
    });

    it('should reject with 409 Conflict if same idempotencyKey is reused with different items/payload', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          tableId: table1Id,
          idempotencyKey: testIdempotencyKey,
          items: [
            {
              productId: product2Id, // Different product
              quantity: 3,
            },
          ],
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('different order request payload');
    });

    it('should permit subsequent re-orders at already occupied table', async () => {
      // Table is now occupied. Re-ordering should succeed and table remains occupied
      const reorderIdempotencyKey = `idemp_${timestamp}_reorder`;
      const req = new NextRequest('http://localhost:3000/api/v1/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerAToken}`,
        },
        body: JSON.stringify({
          qrToken: table1RawToken,
          tableId: table1Id,
          idempotencyKey: reorderIdempotencyKey,
          items: [
            {
              productId: product2Id,
              quantity: 1,
            },
          ],
        }),
      });

      const res = await createOrderHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).not.toBe(createdOrderId);

      // Verify table remains occupied
      const tableAfterReorder = await prisma.restaurant_tables.findUnique({
        where: { id: table1Id },
      });
      expect(tableAfterReorder?.status).toBe('occupied');
    });
  });

  // =========================================================================
  // 4. Customer Order Status Tracking (GET /api/v1/customer/orders/[orderId])
  // =========================================================================
  describe('4. Customer Order Status Tracking (GET /api/v1/customer/orders/[orderId])', () => {
    let customerAOrderId: string;

    beforeAll(async () => {
      const existing = await prisma.orders.findFirst({
        where: { customer_id: customerAId },
      });
      customerAOrderId = existing!.id;
    });

    it('should allow Customer A to view Customer A order details and status history', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/customer/orders/${customerAOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${customerAToken}`,
          },
        }
      );

      const res = await getOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: customerAOrderId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(customerAOrderId);
      expect(json.data.status).toBe('pending');
      expect(json.data.items.length).toBeGreaterThanOrEqual(1);
      expect(json.data.statusHistory.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 when Customer B attempts to access Customer A order (Strict Tenant Isolation)', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/customer/orders/${customerAOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${customerBToken}`, // Customer B token
          },
        }
      );

      const res = await getOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: customerAOrderId }),
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for invalid UUID or non-existent order', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/v1/customer/orders/00000000-0000-0000-0000-000000000000',
        {
          headers: {
            Authorization: `Bearer ${customerAToken}`,
          },
        }
      );

      const res = await getOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(res.status).toBe(404);
    });

    it('should reject revoked customer session with 401', async () => {
      // Revoke customer A session
      await revokeCustomerDatabaseSession(customerASessionId);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/customer/orders/${customerAOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${customerAToken}`,
          },
        }
      );

      const res = await getOrderStatusHandler(req, {
        params: Promise.resolve({ orderId: customerAOrderId }),
      });
      expect(res.status).toBe(401);
    });
  });
});
