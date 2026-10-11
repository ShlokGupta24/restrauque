import { describe, it, expect } from 'vitest';
import {
  createVariantSchema,
  updateVariantSchema,
  createAddonSchema,
  updateAddonSchema,
} from '@/lib/validation/menu';
import {
  formatVariant,
  formatAddon,
  formatProduct,
} from '@/lib/menu/format';
import { Prisma } from '@prisma/client';

describe('STEP 8B: Product Variants & Add-ons Validation & Formatting Tests', () => {
  describe('createVariantSchema', () => {
    it('should accept valid variant input', () => {
      const valid = createVariantSchema.parse({
        name: 'Large',
        price: 250.5,
        displayOrder: 1,
        isActive: true,
        isAvailable: true,
      });

      expect(valid.name).toBe('Large');
      expect(valid.price).toBe(250.5);
      expect(valid.displayOrder).toBe(1);
      expect(valid.isActive).toBe(true);
      expect(valid.isAvailable).toBe(true);
    });

    it('should apply defaults for displayOrder, isActive, and isAvailable', () => {
      const parsed = createVariantSchema.parse({
        name: 'Regular',
        price: 180,
      });

      expect(parsed.displayOrder).toBe(0);
      expect(parsed.isActive).toBe(true);
      expect(parsed.isAvailable).toBe(true);
    });

    it('should reject blank or whitespace-only name', () => {
      expect(() => createVariantSchema.parse({ name: '', price: 100 })).toThrow();
      expect(() => createVariantSchema.parse({ name: '   ', price: 100 })).toThrow();
    });

    it('should reject name exceeding 100 characters', () => {
      const longName = 'V'.repeat(101);
      expect(() => createVariantSchema.parse({ name: longName, price: 100 })).toThrow();
    });

    it('should reject negative price', () => {
      expect(() => createVariantSchema.parse({ name: 'Small', price: -10 })).toThrow();
    });

    it('should reject price with more than 2 decimal places', () => {
      expect(() => createVariantSchema.parse({ name: 'Small', price: 99.999 })).toThrow();
    });

    it('should reject negative or non-integer displayOrder', () => {
      expect(() => createVariantSchema.parse({ name: 'Small', price: 100, displayOrder: -1 })).toThrow();
      expect(() => createVariantSchema.parse({ name: 'Small', price: 100, displayOrder: 1.5 })).toThrow();
    });

    it('should reject unexpected extra fields in strict mode', () => {
      expect(() =>
        createVariantSchema.parse({
          name: 'Small',
          price: 100,
          hackedField: 'injection',
        })
      ).toThrow();
    });
  });

  describe('updateVariantSchema', () => {
    it('should accept partial update fields', () => {
      const parsed = updateVariantSchema.parse({
        price: 260.0,
        isAvailable: false,
      });

      expect(parsed.price).toBe(260.0);
      expect(parsed.isAvailable).toBe(false);
      expect(parsed.name).toBeUndefined();
    });

    it('should REJECT empty update object', () => {
      expect(() => updateVariantSchema.parse({})).toThrow(
        /At least one field must be provided for update/
      );
    });

    it('should reject invalid partial fields', () => {
      expect(() => updateVariantSchema.parse({ price: -5 })).toThrow();
      expect(() => updateVariantSchema.parse({ name: '' })).toThrow();
      expect(() => updateVariantSchema.parse({ displayOrder: -1 })).toThrow();
    });
  });

  describe('createAddonSchema', () => {
    it('should accept valid add-on input including 0 price', () => {
      const validFree = createAddonSchema.parse({
        name: 'Extra Napkins',
        price: 0,
      });
      expect(validFree.name).toBe('Extra Napkins');
      expect(validFree.price).toBe(0);

      const validPaid = createAddonSchema.parse({
        name: 'Extra Cheese',
        price: 30.5,
        displayOrder: 2,
      });
      expect(validPaid.name).toBe('Extra Cheese');
      expect(validPaid.price).toBe(30.5);
    });

    it('should default price to 0 if omitted', () => {
      const parsed = createAddonSchema.parse({
        name: 'Complimentary Dip',
      });
      expect(parsed.price).toBe(0);
      expect(parsed.displayOrder).toBe(0);
      expect(parsed.isActive).toBe(true);
      expect(parsed.isAvailable).toBe(true);
    });

    it('should reject blank name and oversized name', () => {
      expect(() => createAddonSchema.parse({ name: '' })).toThrow();
      expect(() => createAddonSchema.parse({ name: 'A'.repeat(101) })).toThrow();
    });

    it('should reject negative price and invalid decimal precision', () => {
      expect(() => createAddonSchema.parse({ name: 'Chutney', price: -5 })).toThrow();
      expect(() => createAddonSchema.parse({ name: 'Chutney', price: 10.123 })).toThrow();
    });
  });

  describe('updateAddonSchema', () => {
    it('should accept partial add-on updates', () => {
      const parsed = updateAddonSchema.parse({
        name: 'Updated Name',
      });
      expect(parsed.name).toBe('Updated Name');
    });

    it('should REJECT empty update object', () => {
      expect(() => updateAddonSchema.parse({})).toThrow(
        /At least one field must be provided for update/
      );
    });
  });

  describe('Formatting Utilities', () => {
    it('should format variant correctly with 2 decimal places and numbers', () => {
      const mockVariant = {
        id: '11111111-1111-1111-1111-111111111111',
        product_id: '22222222-2222-2222-2222-222222222222',
        name: 'Extra Large',
        price: new Prisma.Decimal('250.50'),
        display_order: 1,
        is_active: true,
        is_available: true,
        created_at: new Date('2026-10-12T00:00:00Z'),
        updated_at: new Date('2026-10-12T00:00:00Z'),
      };

      const formatted = formatVariant(mockVariant);
      expect(formatted.id).toBe(mockVariant.id);
      expect(formatted.productId).toBe(mockVariant.product_id);
      expect(formatted.name).toBe('Extra Large');
      expect(formatted.price).toBe(250.5);
      expect(formatted.priceFormatted).toBe('250.50');
      expect(formatted.displayOrder).toBe(1);
      expect(formatted.isActive).toBe(true);
      expect(formatted.isAvailable).toBe(true);
    });

    it('should format add-on correctly including zero price', () => {
      const mockAddon = {
        id: '33333333-3333-3333-3333-333333333333',
        product_id: '22222222-2222-2222-2222-222222222222',
        name: 'Green Chutney',
        price: new Prisma.Decimal('0.00'),
        display_order: 0,
        is_active: true,
        is_available: true,
        created_at: new Date('2026-10-12T00:00:00Z'),
        updated_at: new Date('2026-10-12T00:00:00Z'),
      };

      const formatted = formatAddon(mockAddon);
      expect(formatted.name).toBe('Green Chutney');
      expect(formatted.price).toBe(0);
      expect(formatted.priceFormatted).toBe('0.00');
    });

    it('should enrich formatProduct with variants and addons when present', () => {
      const mockProductWithChildren = {
        id: 'p1',
        restaurant_id: 'r1',
        category_id: 'c1',
        name: 'Gourmet Pizza',
        price: new Prisma.Decimal('350.00'),
        display_order: 0,
        is_active: true,
        is_available: true,
        created_at: new Date(),
        updated_at: new Date(),
        product_variants: [
          {
            id: 'v1',
            product_id: 'p1',
            name: 'Medium',
            price: new Prisma.Decimal('350.00'),
            display_order: 0,
            is_active: true,
            is_available: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        product_addons: [
          {
            id: 'a1',
            product_id: 'p1',
            name: 'Extra Jalapeños',
            price: new Prisma.Decimal('25.00'),
            display_order: 0,
            is_active: true,
            is_available: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      const formatted = formatProduct(mockProductWithChildren);
      expect(formatted.variants).toBeDefined();
      expect(formatted.variants?.length).toBe(1);
      expect(formatted.variants?.[0].name).toBe('Medium');
      expect(formatted.variants?.[0].priceFormatted).toBe('350.00');

      expect(formatted.addons).toBeDefined();
      expect(formatted.addons?.length).toBe(1);
      expect(formatted.addons?.[0].name).toBe('Extra Jalapeños');
      expect(formatted.addons?.[0].priceFormatted).toBe('25.00');
    });

    it('should maintain backward compatibility for formatProduct when variants and addons are not loaded', () => {
      const simpleProduct = {
        id: 'p2',
        restaurant_id: 'r1',
        category_id: 'c1',
        name: 'Espresso',
        price: new Prisma.Decimal('120.00'),
        display_order: 0,
        is_active: true,
        is_available: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const formatted = formatProduct(simpleProduct);
      expect(formatted.name).toBe('Espresso');
      expect(formatted.priceFormatted).toBe('120.00');
      expect(formatted.variants).toBeUndefined();
      expect(formatted.addons).toBeUndefined();
    });
  });

  describe('Delete-versus-Archive Decision Logic', () => {
    function decideDeletionAction(orderCount: number): 'ARCHIVE' | 'DELETE' {
      return orderCount > 0 ? 'ARCHIVE' : 'DELETE';
    }

    it('should archive when historical orders reference the option', () => {
      expect(decideDeletionAction(5)).toBe('ARCHIVE');
      expect(decideDeletionAction(1)).toBe('ARCHIVE');
    });

    it('should hard delete when no historical orders reference the option', () => {
      expect(decideDeletionAction(0)).toBe('DELETE');
    });
  });
});
