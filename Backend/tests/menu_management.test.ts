import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession, createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import {
  GET as listCategoriesHandler,
  POST as createCategoryHandler,
} from '@/app/api/v1/owner/menu/categories/route';
import {
  GET as getCategoryHandler,
  PATCH as updateCategoryHandler,
  DELETE as deleteCategoryHandler,
} from '@/app/api/v1/owner/menu/categories/[categoryId]/route';
import {
  GET as listProductsHandler,
  POST as createProductHandler,
} from '@/app/api/v1/owner/menu/products/route';
import {
  GET as getProductHandler,
  PATCH as updateProductHandler,
  DELETE as deleteProductHandler,
} from '@/app/api/v1/owner/menu/products/[productId]/route';
import { GET as getMenuSummaryHandler } from '@/app/api/v1/owner/menu/summary/route';

describe('STEP 4 — Persistent Menu Categories and Product Management', () => {
  const timestamp = Date.now();

  // Test Owner 1: Primary test owner
  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1BranchId: string;

  // Test Owner 2: For cross-tenant isolation testing
  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2BranchId: string;

  // Test Customer: Must be rejected on owner menu management
  let customerId: string;
  let customerToken: string;

  // IDs created during tests
  let owner1Category1Id: string;
  let owner1Category2Id: string;
  let owner2CategoryId: string;
  let owner1Product1Id: string;
  let owner1Product2Id: string;
  let owner2ProductId: string;

  // For testing historical order preservation on deletion
  let productWithOrderId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureOwnerPass123!');

    // 1. Create Owner 1 + Restaurant 1 + Branch 1
    const owner1 = await prisma.users.create({
      data: {
        email: `menu_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Menu Owner 1',
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
        name: `Trattoria Milano ${timestamp}`,
        legal_name: 'Milano Foods Private Limited',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const branch1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Milano Central',
        status: 'active',
      },
    });
    owner1BranchId = branch1.id;

    // 2. Create Owner 2 + Restaurant 2 + Branch 2
    const owner2 = await prisma.users.create({
      data: {
        email: `menu_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'Menu Owner 2',
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
        name: `Bistro Parisien ${timestamp}`,
        legal_name: 'Parisien Gourmet LLP',
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const branch2 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Parisien Montmartre',
        status: 'active',
      },
    });
    owner2BranchId = branch2.id;

    // Create Category and Product for Owner 2
    const cat2 = await prisma.categories.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Desserts Parisiens',
        display_order: 1,
        is_active: true,
      },
    });
    owner2CategoryId = cat2.id;

    const prod2 = await prisma.products.create({
      data: {
        restaurant_id: owner2RestaurantId,
        category_id: owner2CategoryId,
        name: 'Crème Brûlée',
        price: 250.0,
        is_active: true,
        is_available: true,
      },
    });
    owner2ProductId = prod2.id;

    // 3. Create Customer
    const customer = await prisma.customers.create({
      data: {
        phone: `+919877${timestamp.toString().slice(-6)}`,
        name: 'Customer Tester',
        status: 'active',
      },
    });
    customerId = customer.id;

    const custSession = await createCustomerDatabaseSession(customerId);
    customerToken = await createJwtToken({
      userId: customerId,
      sessionId: custSession.sessionId,
      sessionToken: custSession.sessionToken,
      email: customer.phone,
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    // Clean up created test data
    if (testOrderId) {
      await prisma.order_items.deleteMany({ where: { order_id: testOrderId } }).catch(() => {});
      await prisma.orders.deleteMany({ where: { id: testOrderId } }).catch(() => {});
    }

    if (owner1RestaurantId) {
      await prisma.products.deleteMany({ where: { restaurant_id: owner1RestaurantId } }).catch(() => {});
      await prisma.categories.deleteMany({ where: { restaurant_id: owner1RestaurantId } }).catch(() => {});
      await prisma.branches.deleteMany({ where: { restaurant_id: owner1RestaurantId } }).catch(() => {});
      await prisma.restaurants.deleteMany({ where: { id: owner1RestaurantId } }).catch(() => {});
    }

    if (owner2RestaurantId) {
      await prisma.products.deleteMany({ where: { restaurant_id: owner2RestaurantId } }).catch(() => {});
      await prisma.categories.deleteMany({ where: { restaurant_id: owner2RestaurantId } }).catch(() => {});
      await prisma.branches.deleteMany({ where: { restaurant_id: owner2RestaurantId } }).catch(() => {});
      await prisma.restaurants.deleteMany({ where: { id: owner2RestaurantId } }).catch(() => {});
    }

    if (owner1Id) {
      await prisma.user_sessions.deleteMany({ where: { user_id: owner1Id } }).catch(() => {});
      await prisma.users.deleteMany({ where: { id: owner1Id } }).catch(() => {});
    }

    if (owner2Id) {
      await prisma.user_sessions.deleteMany({ where: { user_id: owner2Id } }).catch(() => {});
      await prisma.users.deleteMany({ where: { id: owner2Id } }).catch(() => {});
    }

    if (customerId) {
      await prisma.customer_sessions.deleteMany({ where: { customer_id: customerId } }).catch(() => {});
      await prisma.customers.deleteMany({ where: { id: customerId } }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. AUTHENTICATION & ROLE GUARDS
  // =========================================================================
  describe('1. Authentication and Authorization Guards', () => {
    it('should reject unauthenticated requests with 401 on categories and products', async () => {
      const catReq = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories');
      const catRes = await listCategoriesHandler(catReq);
      expect(catRes.status).toBe(401);

      const prodReq = new NextRequest('http://localhost:3000/api/v1/owner/menu/products');
      const prodRes = await listProductsHandler(prodReq);
      expect(prodRes.status).toBe(401);
    });

    it('should reject customer tokens with 403 on categories and products', async () => {
      const catReq = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const catRes = await listCategoriesHandler(catReq);
      expect(catRes.status).toBe(403);

      const prodReq = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const prodRes = await listProductsHandler(prodReq);
      expect(prodRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. CATEGORY MANAGEMENT
  // =========================================================================
  describe('2. Category Management (GET & POST /api/v1/owner/menu/categories)', () => {
    it('should initially list 0 categories for Owner 1', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });
      const res = await listCategoriesHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.categories).toHaveLength(0);
      expect(json.data.summary.totalCategories).toBe(0);
    });

    it('should create a new category under Owner 1 restaurant via POST', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Artisan Pizzas',
          description: 'Wood-fired sourdough pizzas',
          displayOrder: 1,
          isActive: true,
        }),
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.category.name).toBe('Artisan Pizzas');
      expect(json.data.category.description).toBe('Wood-fired sourdough pizzas');
      expect(json.data.category.restaurantId).toBe(owner1RestaurantId);
      expect(json.data.category.isActive).toBe(true);

      owner1Category1Id = json.data.category.id;
    });

    it('should reject duplicate category name within the same restaurant with 409 CONFLICT', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Artisan Pizzas', // Duplicate
          description: 'Different desc',
        }),
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.code).toBe('CONFLICT');
    });

    it('should allow the same category name under a DIFFERENT restaurant', async () => {
      // Owner 2 also creates 'Artisan Pizzas'
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner2Token}`,
        },
        body: JSON.stringify({
          name: 'Artisan Pizzas',
        }),
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(201);
    });

    it('should create a second category for Owner 1', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Handcrafted Pastas',
          description: 'Fresh egg pasta',
          displayOrder: 2,
        }),
      });

      const res = await createCategoryHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      owner1Category2Id = json.data.category.id;
    });

    it('should retrieve individual category via GET /api/v1/owner/menu/categories/[categoryId]', async () => {
      const params = Promise.resolve({ categoryId: owner1Category1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/categories/${owner1Category1Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getCategoryHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.category.id).toBe(owner1Category1Id);
      expect(json.data.category.name).toBe('Artisan Pizzas');
    });

    it('should update category via PATCH /api/v1/owner/menu/categories/[categoryId]', async () => {
      const params = Promise.resolve({ categoryId: owner1Category1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/categories/${owner1Category1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Wood-fired Pizzas',
          displayOrder: 5,
        }),
      });

      const res = await updateCategoryHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.category.name).toBe('Wood-fired Pizzas');
      expect(json.data.category.displayOrder).toBe(5);
    });

    it('should reject renaming a category to an already existing name with 409 CONFLICT', async () => {
      const params = Promise.resolve({ categoryId: owner1Category1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/categories/${owner1Category1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          name: 'Handcrafted Pastas', // already used by Category 2
        }),
      });

      const res = await updateCategoryHandler(req, { params });
      expect(res.status).toBe(409);
    });

    it('should reject Owner 1 from accessing or updating Owner 2 category (Cross-tenant rejection)', async () => {
      const params = Promise.resolve({ categoryId: owner2CategoryId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/categories/${owner2CategoryId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getCategoryHandler(req, { params });
      expect(res.status).toBe(404); // Scoped to restaurant, returns 404 to avoid leaking existence
    });
  });

  // =========================================================================
  // 3. PRODUCT MANAGEMENT
  // =========================================================================
  describe('3. Product Management (GET & POST /api/v1/owner/menu/products)', () => {
    it('should reject product creation referencing a category of ANOTHER restaurant', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner2CategoryId, // Belongs to Owner 2!
          name: 'Tiramisu',
          price: 220.0,
        }),
      });

      const res = await createProductHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative price and invalid decimal scale', async () => {
      // Negative price
      const reqNeg = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner1Category1Id,
          name: 'Invalid Price Pizza',
          price: -50.0,
        }),
      });
      const resNeg = await createProductHandler(reqNeg);
      expect(resNeg.status).toBe(400);

      // > 2 decimals
      const reqDec = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner1Category1Id,
          name: 'Invalid Scale Pizza',
          price: 199.999,
        }),
      });
      const resDec = await createProductHandler(reqDec);
      expect(resDec.status).toBe(400);
    });

    it('should reject local filesystem paths in imageUrl and accept valid HTTPS URLs', async () => {
      const reqLocal = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner1Category1Id,
          name: 'File Path Pizza',
          price: 350.0,
          imageUrl: 'file:///etc/passwd',
        }),
      });
      const resLocal = await createProductHandler(reqLocal);
      expect(resLocal.status).toBe(400);
    });

    it('should successfully create a product under Owner 1 restaurant via POST', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner1Category1Id,
          name: 'Margherita D.O.P.',
          description: 'San Marzano tomatoes, fresh fior di latte, basil, extra virgin olive oil',
          price: 450.0,
          imageUrl: 'https://cdn.example.com/images/margherita.jpg',
          displayOrder: 1,
          isActive: true,
          isAvailable: true,
        }),
      });

      const res = await createProductHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.product.name).toBe('Margherita D.O.P.');
      expect(json.data.product.price).toBe(450.0);
      expect(json.data.product.priceFormatted).toBe('450.00');
      expect(json.data.product.restaurantId).toBe(owner1RestaurantId);
      expect(json.data.product.categoryId).toBe(owner1Category1Id);
      expect(json.data.product.isActive).toBe(true);
      expect(json.data.product.isAvailable).toBe(true);

      owner1Product1Id = json.data.product.id;
    });

    it('should reject duplicate product name within the same restaurant with 409 CONFLICT', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner1Category1Id,
          name: 'Margherita D.O.P.', // Duplicate
          price: 480.0,
        }),
      });

      const res = await createProductHandler(req);
      expect(res.status).toBe(409);
    });

    it('should allow the same product name under a DIFFERENT restaurant', async () => {
      // Owner 2 also creates 'Margherita D.O.P.'
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner2Token}`,
        },
        body: JSON.stringify({
          categoryId: owner2CategoryId,
          name: 'Margherita D.O.P.',
          price: 520.0,
        }),
      });

      const res = await createProductHandler(req);
      expect(res.status).toBe(201);
    });

    it('should create a second product for Owner 1 under Category 2', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          categoryId: owner1Category2Id,
          name: 'Tagliatelle al Tartufo',
          description: 'Fresh egg pasta with black truffle cream and parmigiano',
          price: 620.5,
          displayOrder: 2,
          isActive: true,
          isAvailable: true,
        }),
      });

      const res = await createProductHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      owner1Product2Id = json.data.product.id;
    });

    it('should list products for Owner 1 with pagination and summary counts', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await listProductsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.products).toHaveLength(2);
      expect(json.data.pagination.total).toBe(2);
      expect(json.data.summary.totalProducts).toBe(2);
      expect(json.data.summary.activeProducts).toBe(2);
      expect(json.data.summary.availableProducts).toBe(2);
    });

    it('should support searching products by name or description', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products?search=tartufo', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await listProductsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.products).toHaveLength(1);
      expect(json.data.products[0].name).toBe('Tagliatelle al Tartufo');
    });

    it('should support filtering products by categoryId', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/menu/products?categoryId=${owner1Category1Id}`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await listProductsHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.products).toHaveLength(1);
      expect(json.data.products[0].name).toBe('Margherita D.O.P.');
    });

    it('should retrieve individual product details via GET /api/v1/owner/menu/products/[productId]', async () => {
      const params = Promise.resolve({ productId: owner1Product1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${owner1Product1Id}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getProductHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.product.id).toBe(owner1Product1Id);
      expect(json.data.product.name).toBe('Margherita D.O.P.');
      expect(json.data.product.categoryName).toBe('Wood-fired Pizzas');
    });
  });

  // =========================================================================
  // 4. ACTIVE VS AVAILABLE INDEPENDENCE & PRODUCT UPDATES
  // =========================================================================
  describe('4. Active and Available States Independence (PATCH /api/v1/owner/menu/products/[productId])', () => {
    it('should toggle isAvailable to false without altering isActive', async () => {
      const params = Promise.resolve({ productId: owner1Product1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${owner1Product1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          isAvailable: false, // Out of stock today
        }),
      });

      const res = await updateProductHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.product.isAvailable).toBe(false);
      expect(json.data.product.isActive).toBe(true); // Must remain active in menu!
    });

    it('should toggle isActive to false without automatically overwriting isAvailable', async () => {
      const params = Promise.resolve({ productId: owner1Product2Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${owner1Product2Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          isActive: false, // Disabled from menu
        }),
      });

      const res = await updateProductHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.product.isActive).toBe(false);
      expect(json.data.product.isAvailable).toBe(true); // Prior availability state preserved
    });

    it('should update price with exact decimal formatting', async () => {
      const params = Promise.resolve({ productId: owner1Product1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${owner1Product1Id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
        },
        body: JSON.stringify({
          price: 475.0,
          isAvailable: true, // Back in stock
        }),
      });

      const res = await updateProductHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.product.price).toBe(475.0);
      expect(json.data.product.priceFormatted).toBe('475.00');
      expect(json.data.product.isAvailable).toBe(true);
    });

    it('should reject Owner 1 from accessing or updating Owner 2 product (Cross-tenant rejection)', async () => {
      const params = Promise.resolve({ productId: owner2ProductId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${owner2ProductId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getProductHandler(req, { params });
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. DELETION AND ARCHIVAL POLICIES (DATA INTEGRITY & HISTORICAL ORDERS)
  // =========================================================================
  describe('5. Data Integrity and Safe Deletion Policies', () => {
    it('should permanently delete an unreferenced product when 0 orders exist', async () => {
      // Create a temporary product with 0 orders
      const tempProd = await prisma.products.create({
        data: {
          restaurant_id: owner1RestaurantId,
          category_id: owner1Category1Id,
          name: 'Temporary Test Product',
          price: 99.0,
          is_active: true,
        },
      });

      const params = Promise.resolve({ productId: tempProd.id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${tempProd.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await deleteProductHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(true);
      expect(json.data.archived).toBe(false);

      // Verify row is physically deleted from DB
      const dbCheck = await prisma.products.findUnique({ where: { id: tempProd.id } });
      expect(dbCheck).toBeNull();
    });

    it('should archive and deactivate a product with historical orders instead of deleting it', async () => {
      // Create product with an order item
      const orderedProduct = await prisma.products.create({
        data: {
          restaurant_id: owner1RestaurantId,
          category_id: owner1Category1Id,
          name: 'Historic Lasagna',
          price: 550.0,
          is_active: true,
          is_available: true,
        },
      });
      productWithOrderId = orderedProduct.id;

      // Create an order referencing this product
      const order = await prisma.orders.create({
        data: {
          restaurant_id: owner1RestaurantId,
          branch_id: owner1BranchId,
          customer_id: customerId,
          order_number: `ORD-${timestamp}-01`,
          subtotal: 550.0,
          total_amount: 550.0,
          status: 'completed',
        },
      });
      testOrderId = order.id;

      await prisma.order_items.create({
        data: {
          order_id: testOrderId,
          product_id: productWithOrderId,
          product_name: 'Historic Lasagna',
          quantity: 1,
          unit_price: 550.0,
          total_price: 550.0,
        },
      });

      // Call DELETE on the product with order history
      const params = Promise.resolve({ productId: productWithOrderId });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/products/${productWithOrderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await deleteProductHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(false);
      expect(json.data.archived).toBe(true);
      expect(json.data.product.isActive).toBe(false);
      expect(json.data.product.isAvailable).toBe(false);

      // Verify DB row STILL EXISTS with is_active = false and order_items intact
      const dbCheck = await prisma.products.findUnique({ where: { id: productWithOrderId } });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.is_active).toBe(false);
      expect(dbCheck?.is_available).toBe(false);

      const orderItems = await prisma.order_items.findMany({ where: { product_id: productWithOrderId } });
      expect(orderItems).toHaveLength(1);
    });

    it('should archive a category containing existing products instead of permanently deleting it', async () => {
      // owner1Category1Id contains products (Margherita D.O.P. and Historic Lasagna)
      const params = Promise.resolve({ categoryId: owner1Category1Id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/categories/${owner1Category1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await deleteCategoryHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(false);
      expect(json.data.archived).toBe(true);
      expect(json.data.category.isActive).toBe(false);

      // Verify category still exists in DB
      const dbCheck = await prisma.categories.findUnique({ where: { id: owner1Category1Id } });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.is_active).toBe(false);
    });

    it('should permanently delete an empty category with 0 products', async () => {
      // Create empty category
      const emptyCat = await prisma.categories.create({
        data: {
          restaurant_id: owner1RestaurantId,
          name: 'Empty Category',
          is_active: true,
        },
      });

      const params = Promise.resolve({ categoryId: emptyCat.id });
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/menu/categories/${emptyCat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await deleteCategoryHandler(req, { params });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.deleted).toBe(true);
      expect(json.data.archived).toBe(false);

      // Verify DB row is permanently deleted
      const dbCheck = await prisma.categories.findUnique({ where: { id: emptyCat.id } });
      expect(dbCheck).toBeNull();
    });
  });

  // =========================================================================
  // 6. DASHBOARD SUMMARY ENDPOINT
  // =========================================================================
  describe('6. Dashboard Menu Summary (GET /api/v1/owner/menu/summary)', () => {
    it('should return accurate category and product statistics for Owner 1', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/summary', {
        headers: { Authorization: `Bearer ${owner1Token}` },
      });

      const res = await getMenuSummaryHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.totalCategories).toBeGreaterThanOrEqual(2);
      expect(json.data.totalProducts).toBeGreaterThanOrEqual(3);
      expect(typeof json.data.activeProducts).toBe('number');
      expect(typeof json.data.availableProducts).toBe('number');
    });
  });

  // =========================================================================
  // 7. PRESERVATION OF UNASSIGNED SEED RESTAURANTS
  // =========================================================================
  describe('7. Preservation of Unassigned Seed Restaurants', () => {
    it('should verify unassigned seed restaurant (THE ENCASA BISTRO) categories and products remain unaffected', async () => {
      const bistro = await prisma.restaurants.findFirst({
        where: { name: 'THE ENCASA BISTRO', owner_id: null },
      });

      expect(bistro).not.toBeNull();
      if (bistro) {
        const bistroCategories = await prisma.categories.count({
          where: { restaurant_id: bistro.id },
        });
        const bistroProducts = await prisma.products.count({
          where: { restaurant_id: bistro.id },
        });

        // 7 categories and 3 products originally seeded
        expect(bistroCategories).toBe(7);
        expect(bistroProducts).toBe(3);
      }
    });
  });
});
