import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const priceSchema = z
  .number({ required_error: 'Price is required' })
  .min(0, 'Price cannot be negative')
  .max(99999999.99, 'Price exceeds maximum supported amount')
  .refine(
    (val) => {
      // Precision / scale check: max 2 decimal places
      const str = val.toString();
      const parts = str.split('.');
      return parts.length === 1 || parts[1].length <= 2;
    },
    { message: 'Price cannot have more than 2 decimal places' }
  );

export const imageUrlSchema = z
  .string()
  .trim()
  .max(1000, 'Image reference cannot exceed 1000 characters')
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const url = new URL(val);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Image reference must be a valid HTTP or HTTPS URL' }
  )
  .nullable()
  .optional();

export const createCategorySchema = z
  .object({
    name: z
      .string({ required_error: 'Category name is required' })
      .trim()
      .min(1, 'Category name cannot be empty')
      .max(100, 'Category name cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    displayOrder: z
      .number()
      .int('Display order must be an integer')
      .min(0, 'Display order cannot be negative')
      .optional()
      .default(0),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Category name cannot be empty')
      .max(100, 'Category name cannot exceed 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    displayOrder: z
      .number()
      .int('Display order must be an integer')
      .min(0, 'Display order cannot be negative')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const createProductSchema = z
  .object({
    categoryId: z
      .string({ required_error: 'Category ID is required' })
      .regex(uuidRegex, 'Invalid categoryId: must be a valid UUID'),
    name: z
      .string({ required_error: 'Product name is required' })
      .trim()
      .min(1, 'Product name cannot be empty')
      .max(150, 'Product name cannot exceed 150 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional(),
    price: priceSchema,
    imageUrl: imageUrlSchema,
    displayOrder: z
      .number()
      .int('Display order must be an integer')
      .min(0, 'Display order cannot be negative')
      .optional()
      .default(0),
    isActive: z.boolean().optional().default(true),
    isAvailable: z.boolean().optional().default(true),
  })
  .strict();

export const updateProductSchema = z
  .object({
    categoryId: z
      .string()
      .regex(uuidRegex, 'Invalid categoryId: must be a valid UUID')
      .optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Product name cannot be empty')
      .max(150, 'Product name cannot exceed 150 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional(),
    price: priceSchema.optional(),
    imageUrl: imageUrlSchema,
    displayOrder: z
      .number()
      .int('Display order must be an integer')
      .min(0, 'Display order cannot be negative')
      .optional(),
    isActive: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
