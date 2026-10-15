import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  isCloudinaryConfigured,
  getCloudinaryClient,
} from '@/lib/media/cloudinary';
import {
  imageUrlSchema,
  createProductSchema,
  updateProductSchema,
} from '@/lib/validation/menu';
import { formatProduct } from '@/lib/menu/format';
import { AuthenticationError } from '@/lib/http/errors';
import type { AuthorizedRestaurantContext } from '@/types/tenancy';
import { POST as uploadHandler } from '@/app/api/v1/owner/menu/products/upload/route';
import * as tenancyModule from '@/lib/auth/tenancy';
import * as cloudinaryModule from '@/lib/media/cloudinary';

describe('Product Image Upload & Cloudinary Integration Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Cloudinary Environment Configuration & Client', () => {
    it('should detect when Cloudinary is not configured', () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      expect(isCloudinaryConfigured()).toBe(false);
      expect(() => getCloudinaryClient()).toThrow(/not configured/i);
    });

    it('should detect when Cloudinary is partially configured', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      expect(isCloudinaryConfigured()).toBe(false);
    });

    it('should detect when Cloudinary is fully configured', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
      process.env.CLOUDINARY_API_KEY = '1234567890';
      process.env.CLOUDINARY_API_SECRET = 'secret_key_abcdef';

      expect(isCloudinaryConfigured()).toBe(true);
      const client = getCloudinaryClient();
      expect(client).toBeDefined();
    });
  });

  describe('2. Image URL Validation Schema', () => {
    it('should accept valid Cloudinary HTTPS URLs', () => {
      const url =
        'https://res.cloudinary.com/demo/image/upload/v1234567890/restrauque/products/sample.jpg';
      const parsed = imageUrlSchema.parse(url);
      expect(parsed).toBe(url);
    });

    it('should accept valid standard HTTP and HTTPS image URLs', () => {
      expect(imageUrlSchema.parse('https://example.com/images/item.png')).toBe(
        'https://example.com/images/item.png'
      );
      expect(imageUrlSchema.parse('http://example.com/images/item.webp')).toBe(
        'http://example.com/images/item.webp'
      );
    });

    it('should accept null and undefined for products without an image', () => {
      expect(imageUrlSchema.parse(null)).toBeNull();
      expect(imageUrlSchema.parse(undefined)).toBeUndefined();
    });

    it('should reject non-HTTP protocols (e.g. javascript, ftp, file)', () => {
      expect(() => imageUrlSchema.parse('javascript:alert(1)')).toThrow();
      expect(() => imageUrlSchema.parse('ftp://example.com/image.jpg')).toThrow();
      expect(() => imageUrlSchema.parse('file:///C:/image.png')).toThrow();
    });

    it('should reject malformed or non-URL strings', () => {
      expect(() => imageUrlSchema.parse('not a valid url')).toThrow();
      expect(() => imageUrlSchema.parse('htp:/broken')).toThrow();
    });
  });

  describe('3. Product Create & Update Schemas with Cloudinary URLs', () => {
    const validCategoryId = '12345678-1234-4234-a234-123456789abc';

    it('should parse product creation with a Cloudinary image URL', () => {
      const parsed = createProductSchema.parse({
        categoryId: validCategoryId,
        name: 'Artisan Espresso',
        price: 150,
        imageUrl: 'https://res.cloudinary.com/test/image/upload/v1/product.jpg',
      });

      expect(parsed.name).toBe('Artisan Espresso');
      expect(parsed.imageUrl).toBe('https://res.cloudinary.com/test/image/upload/v1/product.jpg');
    });

    it('should parse product creation without an image URL', () => {
      const parsed = createProductSchema.parse({
        categoryId: validCategoryId,
        name: 'Black Tea',
        price: 80,
      });

      expect(parsed.name).toBe('Black Tea');
      expect(parsed.imageUrl).toBeUndefined();
    });

    it('should parse product update with a new replacement image URL', () => {
      const parsed = updateProductSchema.parse({
        imageUrl: 'https://res.cloudinary.com/test/image/upload/v2/new_latte.png',
      });

      expect(parsed.imageUrl).toBe('https://res.cloudinary.com/test/image/upload/v2/new_latte.png');
    });

    it('should parse product update clearing the image URL with null', () => {
      const parsed = updateProductSchema.parse({
        imageUrl: null,
      });

      expect(parsed.imageUrl).toBeNull();
    });
  });

  describe('4. formatProduct Serialization', () => {
    it('should format product with Cloudinary imageUrl and category', () => {
      const rawProduct = {
        id: '12345678-1234-1234-1234-123456789abc',
        restaurant_id: '87654321-4321-4321-4321-cba987654321',
        category_id: '11111111-2222-3333-4444-555555555555',
        name: 'Cappuccino',
        description: 'Rich espresso with foamed milk',
        price: '180.00',
        image_url: 'https://res.cloudinary.com/test/image/upload/cappuccino.webp',
        display_order: 1,
        is_active: true,
        is_available: true,
        created_at: new Date('2026-10-15T00:00:00Z'),
        updated_at: new Date('2026-10-15T00:00:00Z'),
        categories: { name: 'Beverages' },
      };

      const formatted = formatProduct(rawProduct);
      expect(formatted.imageUrl).toBe('https://res.cloudinary.com/test/image/upload/cappuccino.webp');
      expect(formatted.price).toBe(180);
      expect(formatted.categoryName).toBe('Beverages');
    });

    it('should format product with null image_url safely', () => {
      const rawProduct = {
        id: '12345678-1234-1234-1234-123456789abc',
        restaurant_id: '87654321-4321-4321-4321-cba987654321',
        category_id: '11111111-2222-3333-4444-555555555555',
        name: 'Plain Water',
        description: null,
        price: '20.00',
        image_url: null,
        display_order: 0,
        is_active: true,
        is_available: true,
        created_at: new Date('2026-10-15T00:00:00Z'),
        updated_at: new Date('2026-10-15T00:00:00Z'),
      };

      const formatted = formatProduct(rawProduct);
      expect(formatted.imageUrl).toBeNull();
    });
  });

  describe('5. Upload API Endpoint (POST /api/v1/owner/menu/products/upload)', () => {
    const mockAuthContext: AuthorizedRestaurantContext = {
      owner: {
        id: 'owner_uuid_123',
        email: 'owner@test.com',
        phone: '+919999999999',
        name: 'Test Owner',
        role: 'RESTAURANT_OWNER',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      restaurant: {
        id: 'restaurant_uuid_456',
        name: 'Test Cafe',
        legalName: 'Test Cafe Ltd',
        status: 'active',
        timezone: 'Asia/Kolkata',
        country: 'IN',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      branches: [],
    };

    it('should reject unauthenticated upload requests with 401', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockRejectedValue(
        new AuthenticationError('Invalid or missing authentication credentials')
      );

      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['dummy image content'], { type: 'image/jpeg' }),
        'photo.jpg'
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request when no file is provided in FormData', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);

      const formData = new FormData();
      // Notice: 'file' is not appended

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toMatch(/image file is required/i);
    });

    it('should reject unsupported MIME types (e.g. application/pdf, text/plain)', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);

      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['%PDF-1.4 file content'], { type: 'application/pdf' }),
        'document.pdf'
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toMatch(/unsupported file type/i);
    });

    it('should reject files exceeding 5 MB limit', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);

      // Create a blob larger than 5 MB (5.2 MB)
      const oversizedBlob = new Blob([new Uint8Array(5.2 * 1024 * 1024)], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', oversizedBlob, 'huge.jpg');

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toMatch(/exceeds the maximum allowed limit of 5 MB/i);
    });

    it('should reject empty files (0 bytes)', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);

      const emptyBlob = new Blob([], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', emptyBlob, 'empty.png');

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toMatch(/empty/i);
    });

    it('should return 503 SERVICE_UNAVAILABLE when Cloudinary credentials are not configured', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);
      vi.spyOn(cloudinaryModule, 'isCloudinaryConfigured').mockReturnValue(false);

      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['fake image bytes'], { type: 'image/jpeg' }),
        'valid.jpg'
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(json.error.message).toMatch(/Cloudinary credentials are not configured/i);
    });

    it('should successfully upload valid image and return Cloudinary secure_url and public_id', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);
      vi.spyOn(cloudinaryModule, 'isCloudinaryConfigured').mockReturnValue(true);

      const expectedUploadResult: cloudinaryModule.CloudinaryUploadResult = {
        secureUrl:
          'https://res.cloudinary.com/restrauque-cloud/image/upload/v1729000000/restrauque/restaurants/restaurant_uuid_456/products/coffee.jpg',
        publicId: 'restrauque/restaurants/restaurant_uuid_456/products/coffee',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 102400,
      };

      vi.spyOn(cloudinaryModule, 'uploadBufferToCloudinary').mockResolvedValue(
        expectedUploadResult
      );

      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['real image content bytes'], { type: 'image/jpeg' }),
        'coffee.jpg'
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.secureUrl).toBe(expectedUploadResult.secureUrl);
      expect(json.data.publicId).toBe(expectedUploadResult.publicId);
      expect(json.data.format).toBe('jpg');
      expect(json.data.width).toBe(800);
      expect(json.data.height).toBe(600);
    });

    it('should handle Cloudinary provider errors gracefully without exposing secrets', async () => {
      vi.spyOn(tenancyModule, 'requireAuthorizedRestaurant').mockResolvedValue(mockAuthContext);
      vi.spyOn(cloudinaryModule, 'isCloudinaryConfigured').mockReturnValue(true);

      vi.spyOn(cloudinaryModule, 'uploadBufferToCloudinary').mockRejectedValue(
        new Error('Cloudinary upload failed: Network timeout')
      );

      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['image bytes'], { type: 'image/webp' }),
        'pastry.webp'
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/menu/products/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadHandler(req);
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('PROVIDER_ERROR');
      expect(json.error.message).toMatch(/Network timeout/);
      // Ensure no sensitive env secrets appear in response
      expect(JSON.stringify(json)).not.toMatch(/api_secret/i);
    });
  });
});
