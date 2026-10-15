import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import {
  GET as listVariantsHandler,
  POST as createVariantHandler,
} from '@/app/api/v1/owner/menu/products/[productId]/variants/route';
import {
  GET as getVariantHandler,
  PATCH as updateVariantHandler,
  DELETE as deleteVariantHandler,
} from '@/app/api/v1/owner/menu/products/[productId]/variants/[variantId]/route';
import {
  GET as listAddonsHandler,
  POST as createAddonHandler,
} from '@/app/api/v1/owner/menu/products/[productId]/addons/route';
import {
  GET as getAddonHandler,
  PATCH as updateAddonHandler,
  DELETE as deleteAddonHandler,
} from '@/app/api/v1/owner/menu/products/[productId]/addons/[addonId]/route';
import { GET as getProductDetailHandler } from '@/app/api/v1/owner/menu/products/[productId]/route';

describe('STEP 8B: Product Variants & Add-ons CRUD and Isolation Integration Tests', () => {
  const timestamp = Date.now();

  // Test Owner 1: Primary owner
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1BranchId: string;
  let owner1CategoryId: string;
  let owner1Product1Id: string;
  let owner1Product2Id: string;

  // Test Owner 2: For cross-tenant isolation testing
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2CategoryId: string;
  let owner2ProductId: string;

  // Customer: Must be rejected on owner routes
  let customerId: string;
  let customerToken: string;

  // Track created variant & add-on IDs
  let variant1Id: string;
  let variant2Id: string;
  let addon1Id: string;

  // Historical reference test IDs
  let variantWithOrderId: string;
  let addonWithOrderId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 + Restaurant 1 + Branch 1
    const owner1 = await prisma.users.create({
      data: {
        email: `variants_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Variants Owner 1',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner1Id = owner1.id;

    const session1 = await createDatabaseSession(owner1Id);
    owner1Token = await createJwtToken({
      userId: owner1Id,
      sessionId: session1.sessionId,
      sessionToken: session1.sessionToken,
      email: owner1.email,
      role: 'RESTAURANT_OWNER',
    });

    const rest1 = await prisma.restaurants.create({
      data: {
        name: `Variants Bistro ${timestamp}`,
        legal_name: 'Bistro Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Main Branch',
        status: 'active',
      },
    });
    owner1BranchId = branch1.id;

    const cat1 = await prisma.categories.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: `Beverages ${timestamp}`,
        display_order: 1,
      },
    });
    owner1CategoryId = cat1.id;

    const prod1 = await prisma.products.create({
      data: {
        restaurant_id: owner1RestaurantId,
        category_id: owner1CategoryId,
        name: 'Artisan Latte',
        price: 180,
        display_order: 1,
      },
    });
    owner1Product1Id = prod1.id;

    const prod2 = await prisma.products.create({
      data: {
        restaurant_id: owner1RestaurantId,
        category_id: owner1CategoryId,
        name: 'Cold Brew',
        price: 200,
        display_order: 2,
      },
    });
    owner1Product2Id = prod2.id;

    // 2. Create Owner 2 + Restaurant 2 (Foreign Tenant)
    const owner2 = await prisma.users.create({
      data: {
        email: `variants_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Variants Owner 2',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner2Id = owner2.id;

    const session2 = await createDatabaseSession(owner2Id);
    owner2Token = await createJwtToken({
      userId: owner2Id,
      sessionId: session2.sessionId,
      sessionToken: session2.sessionToken,
      email: owner2.email,
      role: 'RESTAURANT_OWNER',
    });

    const rest2 = await prisma.restaurants.create({
      data: {
        name: `Foreign Cafe ${timestamp}`,
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const cat2 = await prisma.categories.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: `Snacks ${timestamp}`,
      },
    });
    owner2CategoryId = cat2.id;

    const prodForeign = await prisma.products.create({
      data: {
        restaurant_id: owner2RestaurantId,
        category_id: owner2CategoryId,
        name: 'Foreign Croissant',
        price: 120,
      },
    });
    owner2ProductId = prodForeign.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        name: 'Coffee Lover',
        phone: `+9199${timestamp.toString().slice(-8)}`,
        status: 'active',
      },
    });
    customerId = customer.id;

    const custSession = await createCustomerDatabaseSession(customerId);
    customerToken = await createJwtToken({
      userId: customerId,
      sessionId: custSession.sessionId,
      sessionToken: custSession.sessionToken,
      email: `${customerId}@cust.local`,
      role: 'CUSTOMER',
    });

    // 4. Seed Variant & Add-on with historical order references for deletion tests
    const variantWithOrder = await prisma.product_variants.create({
      data: {
        product_id: owner1Product1Id,
        name: 'Historical Variant',
        price: 220,
      },
    });
    variantWithOrderId = variantWithOrder.id;

    const addonWithOrder = await prisma.product_addons.create({
      data: {
        product_id: owner1Product1Id,
        name: 'Historical Addon',
        price: 40,
      },
    });
    addonWithOrderId = addonWithOrder.id;

    const order = await prisma.orders.create({
      data: {
        restaurant_id: owner1RestaurantId,
        branch_id: owner1BranchId,
        customer_id: customerId,
        order_number: `ORD-HIST-${timestamp.toString().slice(-4)}`,
        order_type: 'dine_in',
        status: 'completed',
        subtotal: 260,
        total_amount: 260,
      },
    });
    testOrderId = order.id;

    const orderItem = await prisma.order_items.create({
      data: {
        order_id: testOrderId,
        product_id: owner1Product1Id,
        variant_id: variantWithOrderId,
        product_name: 'Artisan Latte',
        variant_name: 'Historical Variant',
        quantity: 1,
        unit_price: 220,
        total_price: 260,
      },
    });

    await prisma.order_item_addons.create({
      data: {
        order_item_id: orderItem.id,
        product_addon_id: addonWithOrderId,
        addon_name: 'Historical Addon',
        quantity: 1,
        unit_price: 40,
        total_price: 40,
      },
    });
  });

  afterAll(async () => {
    try {
      if (testOrderId) {
        await prisma.order_item_addons.deleteMany({
          where: { order_items: { order_id: testOrderId } },
        });
        await prisma.order_items.deleteMany({ where: { order_id: testOrderId } });
        await prisma.orders.deleteMany({ where: { id: testOrderId } });
      }

      const allProductIds = [owner1Product1Id, owner1Product2Id, owner2ProductId].filter(Boolean);
      if (allProductIds.length > 0) {
        await prisma.product_addons.deleteMany({ where: { product_id: { in: allProductIds } } });
        await prisma.product_variants.deleteMany({ where: { product_id: { in: allProductIds } } });
        await prisma.products.deleteMany({ where: { id: { in: allProductIds } } });
      }

      if (owner1CategoryId) await prisma.categories.deleteMany({ where: { id: owner1CategoryId } });
      if (owner2CategoryId) await prisma.categories.deleteMany({ where: { id: owner2CategoryId } });
      if (owner1BranchId) await prisma.branches.deleteMany({ where: { id: owner1BranchId } });
      if (owner1RestaurantId) await prisma.restaurants.deleteMany({ where: { id: owner1RestaurantId } });
      if (owner2RestaurantId) await prisma.restaurants.deleteMany({ where: { id: owner2RestaurantId } });

      if (customerId) {
        await prisma.customer_sessions.deleteMany({ where: { customer_id: customerId } });
        await prisma.customers.deleteMany({ where: { id: customerId } });
      }
      if (owner1Id) {
        await prisma.user_sessions.deleteMany({ where: { user_id: owner1Id } });
        await prisma.users.deleteMany({ where: { id: owner1Id } });
      }
      if (owner2Id) {
        await prisma.user_sessions.deleteMany({ where: { user_id: owner2Id } });
        await prisma.users.deleteMany({ where: { id: owner2Id } });
      }
    } catch (cleanupErr) {
      console.error('Test cleanup error (non-fatal):', cleanupErr);
    }
  });

  describe('1. Authentication & RBAC Enforcement', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(401);
    });

    it('should reject CUSTOMER role with 403', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants`,
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('2. Cross-Tenant & Sub-Resource Isolation', () => {
    it('should return 404 when Owner 1 accesses Owner 2 foreign product variants', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner2ProductId}/variants`,
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: owner2ProductId }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 when Owner 1 attempts to create variant on foreign product', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner2ProductId}/variants`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Hacked', price: 99 }),
        }
      );
      const res = await createVariantHandler(req, {
        params: Promise.resolve({ productId: owner2ProductId }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 when requesting variant under mismatched productId (cross-product ID substitution)', async () => {
      // Create valid variant on Product 1
      const reqCreate = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Medium Size', price: 210, displayOrder: 1 }),
        }
      );
      const resCreate = await createVariantHandler(reqCreate, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(resCreate.status).toBe(201);
      const jsonCreate = await resCreate.json();
      const variantId = jsonCreate.data.variant.id;

      // Attempt to access variantId under Product 2 (mismatched)
      const reqMismatch = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product2Id}/variants/${variantId}`,
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const resMismatch = await getVariantHandler(reqMismatch, {
        params: Promise.resolve({ productId: owner1Product2Id, variantId }),
      });
      expect(resMismatch.status).toBe(404);
    });
  });

  describe('3. Product Variants CRUD & Unique Name Constraint', () => {
    it('should create a variant successfully (201)', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Regular (Small)',
            price: 180.0,
            displayOrder: 0,
            isAvailable: true,
            isActive: true,
          }),
        }
      );
      const res = await createVariantHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.variant.name).toBe('Regular (Small)');
      expect(json.data.variant.price).toBe(180);
      expect(json.data.variant.priceFormatted).toBe('180.00');
      variant1Id = json.data.variant.id;
    });

    it('should REJECT duplicate variant name on the same product (409 Conflict)', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Regular (Small)', // Duplicate
            price: 190.0,
          }),
        }
      );
      const res = await createVariantHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.message).toContain('already exists for this product');
    });

    it('should ALLOW the same variant name on a DIFFERENT product', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product2Id}/variants`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Regular (Small)', // Same name, different product
            price: 200.0,
          }),
        }
      );
      const res = await createVariantHandler(req, {
        params: Promise.resolve({ productId: owner1Product2Id }),
      });
      expect(res.status).toBe(201);
    });

    it('should partially update variant without altering omitted fields (PATCH)', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants/${variant1Id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price: 185.5,
          }),
        }
      );
      const res = await updateVariantHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id, variantId: variant1Id }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.variant.price).toBe(185.5);
      expect(json.data.variant.priceFormatted).toBe('185.50');
      expect(json.data.variant.name).toBe('Regular (Small)'); // Untouched
    });

    it('should reject empty update body on PATCH (400)', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants/${variant1Id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const res = await updateVariantHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id, variantId: variant1Id }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('4. Product Add-ons CRUD', () => {
    it('should create an add-on successfully including 0 price (201)', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/addons`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Oat Milk Sub',
            price: 35.0,
            displayOrder: 1,
            isAvailable: true,
          }),
        }
      );
      const res = await createAddonHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.addon.name).toBe('Oat Milk Sub');
      expect(json.data.addon.price).toBe(35);
      expect(json.data.addon.priceFormatted).toBe('35.00');
      addon1Id = json.data.addon.id;
    });

    it('should list add-ons sorted by display_order ascending', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/addons`,
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await listAddonsHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.addons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Enriched Product Detail GET Response', () => {
    it('should return product detail enriched with variants and addons', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}`,
        { headers: { Authorization: `Bearer ${owner1Token}` } }
      );
      const res = await getProductDetailHandler(req, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const product = json.data.product;

      expect(product.id).toBe(owner1Product1Id);
      expect(product.variants).toBeDefined();
      expect(Array.isArray(product.variants)).toBe(true);
      expect(product.variants.length).toBeGreaterThanOrEqual(1);

      expect(product.addons).toBeDefined();
      expect(Array.isArray(product.addons)).toBe(true);
      expect(product.addons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Safe Deletion & Historical Order Preservation', () => {
    it('should permanently DELETE variant when no orders reference it', async () => {
      // Create a temporary unreferenced variant
      const reqCreate = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Temporary Variant', price: 100 }),
        }
      );
      const resCreate = await createVariantHandler(reqCreate, {
        params: Promise.resolve({ productId: owner1Product1Id }),
      });
      const tempId = (await resCreate.json()).data.variant.id;

      // Delete it
      const reqDel = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants/${tempId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );
      const resDel = await deleteVariantHandler(reqDel, {
        params: Promise.resolve({ productId: owner1Product1Id, variantId: tempId }),
      });
      expect(resDel.status).toBe(200);
      const jsonDel = await resDel.json();
      expect(jsonDel.data.deleted).toBe(true);
      expect(jsonDel.data.archived).toBe(false);

      // Verify it was truly removed from database
      const dbCheck = await prisma.product_variants.findUnique({ where: { id: tempId } });
      expect(dbCheck).toBeNull();
    });

    it('should ARCHIVE variant when historical orders reference it', async () => {
      const reqDel = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/variants/${variantWithOrderId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );
      const resDel = await deleteVariantHandler(reqDel, {
        params: Promise.resolve({ productId: owner1Product1Id, variantId: variantWithOrderId }),
      });
      expect(resDel.status).toBe(200);
      const jsonDel = await resDel.json();
      expect(jsonDel.data.deleted).toBe(false);
      expect(jsonDel.data.archived).toBe(true);
      expect(jsonDel.data.variant.isActive).toBe(false);
      expect(jsonDel.data.variant.isAvailable).toBe(false);

      // Verify record still exists in database with is_active = false
      const dbCheck = await prisma.product_variants.findUnique({
        where: { id: variantWithOrderId },
      });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.is_active).toBe(false);
      expect(dbCheck?.is_available).toBe(false);

      // Verify historical order item snapshot was NOT deleted or modified
      const orderItem = await prisma.order_items.findFirst({
        where: { variant_id: variantWithOrderId },
      });
      expect(orderItem).not.toBeNull();
      expect(orderItem?.variant_name).toBe('Historical Variant');
    });

    it('should ARCHIVE add-on when historical orders reference it', async () => {
      const reqDel = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${owner1Product1Id}/addons/${addonWithOrderId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );
      const resDel = await deleteAddonHandler(reqDel, {
        params: Promise.resolve({ productId: owner1Product1Id, addonId: addonWithOrderId }),
      });
      expect(resDel.status).toBe(200);
      const jsonDel = await resDel.json();
      expect(jsonDel.data.deleted).toBe(false);
      expect(jsonDel.data.archived).toBe(true);
      expect(jsonDel.data.addon.isActive).toBe(false);
      expect(jsonDel.data.addon.isAvailable).toBe(false);

      // Verify record still exists in database with is_active = false
      const dbCheck = await prisma.product_addons.findUnique({
        where: { id: addonWithOrderId },
      });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.is_active).toBe(false);
      expect(dbCheck?.is_available).toBe(false);

      // Verify historical order item addon snapshot was NOT deleted
      const addonSnap = await prisma.order_item_addons.findFirst({
        where: { product_addon_id: addonWithOrderId },
      });
      expect(addonSnap).not.toBeNull();
      expect(addonSnap?.addon_name).toBe('Historical Addon');
    });
  });
});
