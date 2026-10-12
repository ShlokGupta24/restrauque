import { z } from 'zod';

const decimalPrecisionRefine = (val: number | null | undefined) => {
  if (val === null || val === undefined) return true;
  const str = val.toString();
  const parts = str.split('.');
  return parts.length === 1 || parts[1].length <= 2;
};

const isoDateRefine = (val: string | null | undefined) => {
  if (!val) return true;
  const parsed = Date.parse(val);
  return !isNaN(parsed);
};

export const createCouponSchema = z
  .object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .trim()
      .min(2, 'Coupon code must be at least 2 characters')
      .max(50, 'Coupon code cannot exceed 50 characters')
      .transform((val) => val.toUpperCase())
      .refine((val) => /^[A-Z0-9_-]+$/.test(val), {
        message: 'Coupon code can only contain letters, numbers, hyphens, and underscores',
      }),
    name: z
      .string({ required_error: 'Coupon name is required' })
      .trim()
      .min(1, 'Coupon name cannot be empty')
      .max(150, 'Coupon name cannot exceed 150 characters'),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    discountType: z.enum(['fixed', 'percentage'], {
      errorMap: (issue) => {
        if (issue.code === 'invalid_type' && issue.received === 'undefined') {
          return { message: 'Discount type is required' };
        }
        return { message: 'Discount type must be either "fixed" or "percentage"' };
      },
    }),
    discountValue: z
      .number({ required_error: 'Discount value is required' })
      .positive('Discount value must be positive')
      .max(99999999.99, 'Discount value exceeds maximum supported amount')
      .refine(decimalPrecisionRefine, {
        message: 'Discount value cannot have more than 2 decimal places',
      }),
    minimumOrderAmount: z
      .number()
      .min(0, 'Minimum order amount cannot be negative')
      .max(99999999.99, 'Minimum order amount exceeds maximum supported amount')
      .refine(decimalPrecisionRefine, {
        message: 'Minimum order amount cannot have more than 2 decimal places',
      })
      .optional()
      .default(0),
    maximumDiscountAmount: z
      .number()
      .positive('Maximum discount amount must be positive')
      .max(99999999.99, 'Maximum discount amount exceeds maximum supported amount')
      .refine(decimalPrecisionRefine, {
        message: 'Maximum discount amount cannot have more than 2 decimal places',
      })
      .nullable()
      .optional(),
    usageLimit: z
      .number()
      .int('Usage limit must be an integer')
      .min(1, 'Usage limit must be at least 1')
      .nullable()
      .optional(),
    validFrom: z
      .string()
      .refine(isoDateRefine, { message: 'validFrom must be a valid ISO date or timestamp' })
      .optional(),
    validUntil: z
      .string()
      .refine(isoDateRefine, { message: 'validUntil must be a valid ISO date or timestamp' })
      .nullable()
      .optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict()
  .superRefine((data, ctx) => {
    // 1. Percentage discount bounds
    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    // 2. Reject maximumDiscountAmount for fixed discounts
    if (
      data.discountType === 'fixed' &&
      data.maximumDiscountAmount !== undefined &&
      data.maximumDiscountAmount !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumDiscountAmount'],
        message: 'Maximum discount amount is only applicable for percentage discounts',
      });
    }

    // 3. Date range validation
    if (data.validFrom && data.validUntil) {
      const from = new Date(data.validFrom);
      const until = new Date(data.validUntil);
      if (until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil cannot precede validFrom',
        });
      }
    }
  });

export const updateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Coupon code must be at least 2 characters')
      .max(50, 'Coupon code cannot exceed 50 characters')
      .transform((val) => val.toUpperCase())
      .refine((val) => /^[A-Z0-9_-]+$/.test(val), {
        message: 'Coupon code can only contain letters, numbers, hyphens, and underscores',
      })
      .optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Coupon name cannot be empty')
      .max(150, 'Coupon name cannot exceed 150 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    discountType: z.enum(['fixed', 'percentage']).optional(),
    discountValue: z
      .number()
      .positive('Discount value must be positive')
      .max(99999999.99, 'Discount value exceeds maximum supported amount')
      .refine(decimalPrecisionRefine, {
        message: 'Discount value cannot have more than 2 decimal places',
      })
      .optional(),
    minimumOrderAmount: z
      .number()
      .min(0, 'Minimum order amount cannot be negative')
      .max(99999999.99, 'Minimum order amount exceeds maximum supported amount')
      .refine(decimalPrecisionRefine, {
        message: 'Minimum order amount cannot have more than 2 decimal places',
      })
      .optional(),
    maximumDiscountAmount: z
      .number()
      .positive('Maximum discount amount must be positive')
      .max(99999999.99, 'Maximum discount amount exceeds maximum supported amount')
      .refine(decimalPrecisionRefine, {
        message: 'Maximum discount amount cannot have more than 2 decimal places',
      })
      .nullable()
      .optional(),
    usageLimit: z
      .number()
      .int('Usage limit must be an integer')
      .min(1, 'Usage limit must be at least 1')
      .nullable()
      .optional(),
    validFrom: z
      .string()
      .refine(isoDateRefine, { message: 'validFrom must be a valid ISO date or timestamp' })
      .optional(),
    validUntil: z
      .string()
      .refine(isoDateRefine, { message: 'validUntil must be a valid ISO date or timestamp' })
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })
  .superRefine((data, ctx) => {
    if (
      data.discountType === 'percentage' &&
      data.discountValue !== undefined &&
      data.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    if (
      data.discountType === 'fixed' &&
      data.maximumDiscountAmount !== undefined &&
      data.maximumDiscountAmount !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumDiscountAmount'],
        message: 'Maximum discount amount is only applicable for percentage discounts',
      });
    }

    if (data.validFrom && data.validUntil) {
      const from = new Date(data.validFrom);
      const until = new Date(data.validUntil);
      if (until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil cannot precede validFrom',
        });
      }
    }
  });

export const couponQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1, 'Page must be at least 1')),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(
        z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')
      ),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    search: z
      .string()
      .trim()
      .max(100, 'Search query cannot exceed 100 characters')
      .optional(),
  })
  .strict();

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type CouponQueryInput = z.infer<typeof couponQuerySchema>;
