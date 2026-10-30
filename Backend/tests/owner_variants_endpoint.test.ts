import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { GET as listVariantsHandler } from '@/app/api/v1/owner/menu/products/[productId]/variants/route';
import { GET as getVariantHandler } from '@/app/api/v1/owner/menu/products/[productId]/variants/[variantId]/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { prisma } from '@/lib/db/prisma';
import { AuthenticationError } from '@/lib/http/errors';

vi.mock('@/lib/auth/tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tenancy')>();
  return {
    ...actual,
    requireAuthorizedRestaurant: vi.fn(),
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    products: {
      findFirst: vi.fn(),
    },
    product_variants: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('STEP 19: Standalone Owner Variants API Pricing Consistency Tests', () => {
  const restaurantId = '5e7c2a92-7b8c-405e-9a09-e6d9564e9d8a';
  const paidProductId = '1fd6a09d-3061-4410-831c-72e5b3c7d9bc';
  const freeProductId = 'a1a1a1a1-2222-3333-4444-555555555555';
  const foreignProductId = '99999999-9999-9999-9999-999999999999';
  const variantId1 = 'dee3d9de-e0cc-483d-af3c-c3e5066c66ce';
  const variantId2 = 'b98bb37f-4dda-4344-b84a-f123b0e61efb';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Authenticated restaurant owner of restaurantId
    vi.mocked(requireAuthorizedRestaurant).mockResolvedValue({
      owner: { id: 'owner-uuid', role: 'RESTAURANT_OWNER' } as any,
      restaurant: { id: restaurantId, name: 'Basil & Brick' } as any,
      branches: [],
    });
  });

  describe('1. Paid Product with Zero-Price Legacy Variant (Defect Parity)', () => {
    it('GET /variants should resolve stored 0 variant price to parent base price (₹149.30)', async () => {
      // Mock parent product: cake with base price 149.30
      vi.mocked(prisma.products.findFirst).mockResolvedValue({
        id: paidProductId,
        restaurant_id: restaurantId,
        name: 'cake',
        price: new Prisma.Decimal('149.30'),
        is_active: true,
        is_available: true,
      } as any);

      // Mock variant: large with price 0.00
      vi.mocked(prisma.product_variants.findMany).mockResolvedValue([
        {
          id: variantId1,
          product_id: paidProductId,
          name: 'large',
          price: new Prisma.Decimal('0.00'),
          display_order: 0,
          is_active: true,
          is_available: true,
          created_at: new Date('2026-10-18T10:00:00Z'),
          updated_at: new Date('2026-10-18T10:00:00Z'),
        } as any,
      ]);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${paidProductId}/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: paidProductId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.variants).toHaveLength(1);
      // Consistent with formatProduct and customer menu: variant inherits parent product's base price
      expect(body.data.variants[0].name).toBe('large');
      expect(body.data.variants[0].price).toBe(149.3);
      expect(body.data.variants[0].priceFormatted).toBe('149.30');
    });

    it('GET /variants/[variantId] should also resolve stored 0 variant price to parent base price', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValue({
        id: paidProductId,
        restaurant_id: restaurantId,
        name: 'cake',
        price: new Prisma.Decimal('149.30'),
        is_active: true,
        is_available: true,
      } as any);

      vi.mocked(prisma.product_variants.findFirst).mockResolvedValue({
        id: variantId1,
        product_id: paidProductId,
        name: 'large',
        price: new Prisma.Decimal('0.00'),
        display_order: 0,
        is_active: true,
        is_available: true,
        created_at: new Date('2026-10-18T10:00:00Z'),
        updated_at: new Date('2026-10-18T10:00:00Z'),
      } as any);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${paidProductId}/variants/${variantId1}`
      );
      const res = await getVariantHandler(req, {
        params: Promise.resolve({ productId: paidProductId, variantId: variantId1 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.variant.price).toBe(149.3);
      expect(body.data.variant.priceFormatted).toBe('149.30');
    });
  });

  describe('2. Paid Product with Positive Variant Price', () => {
    it('GET /variants should preserve absolute variant price (e.g. ₹280 and ₹200)', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValue({
        id: paidProductId,
        restaurant_id: restaurantId,
        name: 'Brownie',
        price: new Prisma.Decimal('250.00'),
        is_active: true,
        is_available: true,
      } as any);

      vi.mocked(prisma.product_variants.findMany).mockResolvedValue([
        {
          id: variantId1,
          product_id: paidProductId,
          name: 'Large',
          price: new Prisma.Decimal('280.00'),
          display_order: 0,
          is_active: true,
          is_available: true,
          created_at: new Date('2026-10-18T10:00:00Z'),
          updated_at: new Date('2026-10-18T10:00:00Z'),
        } as any,
        {
          id: variantId2,
          product_id: paidProductId,
          name: 'small',
          price: new Prisma.Decimal('200.00'),
          display_order: 1,
          is_active: true,
          is_available: true,
          created_at: new Date('2026-10-18T10:00:00Z'),
          updated_at: new Date('2026-10-18T10:00:00Z'),
        } as any,
      ]);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${paidProductId}/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: paidProductId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.variants).toHaveLength(2);
      expect(body.data.variants[0].price).toBe(280);
      expect(body.data.variants[0].priceFormatted).toBe('280.00');
      expect(body.data.variants[1].price).toBe(200);
      expect(body.data.variants[1].priceFormatted).toBe('200.00');
    });
  });

  describe('3. Legitimate Free Product with Zero-Price Variant', () => {
    it('GET /variants should preserve ₹0 price for legitimate free product', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValue({
        id: freeProductId,
        restaurant_id: restaurantId,
        name: 'Complimentary Water',
        price: new Prisma.Decimal('0.00'),
        is_active: true,
        is_available: true,
      } as any);

      vi.mocked(prisma.product_variants.findMany).mockResolvedValue([
        {
          id: variantId1,
          product_id: freeProductId,
          name: 'Glass',
          price: new Prisma.Decimal('0.00'),
          display_order: 0,
          is_active: true,
          is_available: true,
          created_at: new Date('2026-10-18T10:00:00Z'),
          updated_at: new Date('2026-10-18T10:00:00Z'),
        } as any,
      ]);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${freeProductId}/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: freeProductId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.variants[0].price).toBe(0);
      expect(body.data.variants[0].priceFormatted).toBe('0.00');
    });
  });

  describe('4. Authorization & Cross-Tenant / Branch Isolation', () => {
    it('should reject unauthenticated requests with 401', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new AuthenticationError('Authentication token missing or invalid')
      );

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${paidProductId}/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: paidProductId }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject cross-tenant access with 404 when product belongs to another restaurant', async () => {
      // prisma.products.findFirst with { id: foreignProductId, restaurant_id: restaurantId } returns null
      vi.mocked(prisma.products.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${foreignProductId}/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: foreignProductId }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Product not found');
    });

    it('should reject cross-tenant access on getVariantHandler when product does not belong to caller', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${foreignProductId}/variants/${variantId1}`
      );
      const res = await getVariantHandler(req, {
        params: Promise.resolve({ productId: foreignProductId, variantId: variantId1 }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Product not found');
    });

    it('should reject getVariantHandler with 404 when variant does not belong to specified product', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValueOnce({
        id: paidProductId,
        restaurant_id: restaurantId,
        name: 'cake',
        price: new Prisma.Decimal('149.30'),
      } as any);

      // Variant lookup returns null for foreign variant
      vi.mocked(prisma.product_variants.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/${paidProductId}/variants/${variantId2}`
      );
      const res = await getVariantHandler(req, {
        params: Promise.resolve({ productId: paidProductId, variantId: variantId2 }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Variant not found');
    });

    it('should reject invalid non-UUID product IDs with 400 ValidationError', async () => {
      const req = new NextRequest(
        `http://localhost/api/v1/owner/menu/products/invalid-uuid/variants`
      );
      const res = await listVariantsHandler(req, {
        params: Promise.resolve({ productId: 'invalid-uuid' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
