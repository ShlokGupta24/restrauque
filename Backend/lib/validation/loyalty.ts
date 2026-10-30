import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ownerLoyaltyAccountsQuerySchema = z.object({
  restaurantId: z
    .string()
    .regex(uuidRegex, 'Invalid restaurantId: must be a valid UUID')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int('Page must be an integer').min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
    ),
  search: z
    .string()
    .trim()
    .max(100, 'Search term cannot exceed 100 characters')
    .optional(),
  status: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => ['active', 'inactive', 'all'].includes(val), {
      message: "Status must be 'active', 'inactive', or 'all'",
    })
    .optional(),
});

export type OwnerLoyaltyAccountsQueryInput = z.infer<typeof ownerLoyaltyAccountsQuerySchema>;

export const ownerLoyaltyAccountDetailQuerySchema = z.object({
  restaurantId: z
    .string()
    .regex(uuidRegex, 'Invalid restaurantId: must be a valid UUID')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int('Page must be an integer').min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
    ),
});

export type OwnerLoyaltyAccountDetailQueryInput = z.infer<typeof ownerLoyaltyAccountDetailQuerySchema>;

// ==========================================
// Owner Reward Catalogue Validation Schemas
// ==========================================

export const ownerRewardsQuerySchema = z.object({
  restaurantId: z
    .string()
    .regex(uuidRegex, 'Invalid restaurantId: must be a valid UUID')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int('Page must be an integer').min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
    ),
  status: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => ['active', 'inactive', 'all'].includes(val), {
      message: "Status must be 'active', 'inactive', or 'all'",
    })
    .default('all')
    .optional(),
});

export type OwnerRewardsQueryInput = z.infer<typeof ownerRewardsQuerySchema>;

export const createRewardSchema = z
  .object({
    name: z
      .string({ required_error: 'Reward name is required' })
      .trim()
      .min(1, 'Reward name cannot be empty')
      .max(150, 'Reward name cannot exceed 150 characters'),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    rewardType: z.enum(['free_product', 'fixed_discount', 'percentage_discount', 'custom'], {
      required_error: 'Reward type is required',
      invalid_type_error:
        "Reward type must be 'free_product', 'fixed_discount', 'percentage_discount', or 'custom'",
    }),
    starsRequired: z
      .number({ required_error: 'starsRequired is required' })
      .int('starsRequired must be an integer')
      .min(1, 'starsRequired must be a positive integer'),
    discountAmount: z
      .number()
      .min(0, 'discountAmount must be non-negative')
      .nullable()
      .optional(),
    discountPercentage: z
      .number()
      .min(0.01, 'discountPercentage must be greater than zero')
      .max(100, 'discountPercentage cannot exceed 100')
      .nullable()
      .optional(),
    productId: z
      .string()
      .regex(uuidRegex, 'Invalid productId: must be a valid UUID')
      .nullable()
      .optional(),
    redemptionLimit: z
      .number()
      .int('redemptionLimit must be an integer')
      .min(1, 'redemptionLimit must be a positive integer')
      .nullable()
      .optional(),
    validFrom: z
      .string()
      .datetime({ message: 'validFrom must be a valid ISO datetime string' })
      .optional(),
    validUntil: z
      .string()
      .datetime({ message: 'validUntil must be a valid ISO datetime string' })
      .nullable()
      .optional(),
    isActive: z.boolean().default(true).optional(),
  })
  .superRefine((data, ctx) => {
    // Cross-field date check
    if (data.validUntil && data.validFrom) {
      const fromTime = new Date(data.validFrom).getTime();
      const untilTime = new Date(data.validUntil).getTime();
      if (untilTime <= fromTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validUntil must be later than validFrom',
          path: ['validUntil'],
        });
      }
    }

    // Reward type compatibility checks
    if (data.rewardType === 'free_product') {
      if (!data.productId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'productId is required for free_product reward type',
          path: ['productId'],
        });
      }
      if (data.discountAmount !== undefined && data.discountAmount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'discountAmount cannot be specified for free_product reward type',
          path: ['discountAmount'],
        });
      }
      if (data.discountPercentage !== undefined && data.discountPercentage !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'discountPercentage cannot be specified for free_product reward type',
          path: ['discountPercentage'],
        });
      }
    } else if (data.rewardType === 'fixed_discount') {
      if (
        data.discountAmount === undefined ||
        data.discountAmount === null ||
        data.discountAmount <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'discountAmount must be a positive number for fixed_discount reward type',
          path: ['discountAmount'],
        });
      }
      if (data.productId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'productId cannot be specified for fixed_discount reward type',
          path: ['productId'],
        });
      }
      if (data.discountPercentage !== undefined && data.discountPercentage !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'discountPercentage cannot be specified for fixed_discount reward type',
          path: ['discountPercentage'],
        });
      }
    } else if (data.rewardType === 'percentage_discount') {
      if (
        data.discountPercentage === undefined ||
        data.discountPercentage === null ||
        data.discountPercentage <= 0 ||
        data.discountPercentage > 100
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'discountPercentage must be between 0.01 and 100 for percentage_discount reward type',
          path: ['discountPercentage'],
        });
      }
      if (data.productId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'productId cannot be specified for percentage_discount reward type',
          path: ['productId'],
        });
      }
      if (data.discountAmount !== undefined && data.discountAmount !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'discountAmount cannot be specified for percentage_discount reward type',
          path: ['discountAmount'],
        });
      }
    }
  });

export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Reward name cannot be empty')
      .max(150, 'Reward name cannot exceed 150 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    starsRequired: z
      .number()
      .int('starsRequired must be an integer')
      .min(1, 'starsRequired must be a positive integer')
      .optional(),
    discountAmount: z
      .number()
      .min(0, 'discountAmount must be non-negative')
      .nullable()
      .optional(),
    discountPercentage: z
      .number()
      .min(0.01, 'discountPercentage must be greater than zero')
      .max(100, 'discountPercentage cannot exceed 100')
      .nullable()
      .optional(),
    productId: z
      .string()
      .regex(uuidRegex, 'Invalid productId: must be a valid UUID')
      .nullable()
      .optional(),
    redemptionLimit: z
      .number()
      .int('redemptionLimit must be an integer')
      .min(1, 'redemptionLimit must be a positive integer')
      .nullable()
      .optional(),
    validUntil: z
      .string()
      .datetime({ message: 'validUntil must be a valid ISO datetime string' })
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    // Server-managed fields explicitly forbidden
    id: z.never({ message: 'Reward ID is server-managed and cannot be updated' }).optional(),
    restaurantId: z
      .never({ message: 'Restaurant ID is server-managed and cannot be updated' })
      .optional(),
    loyaltyProgramId: z
      .never({ message: 'Loyalty program ID is server-managed and cannot be updated' })
      .optional(),
    redemptionCount: z
      .never({ message: 'redemptionCount is server-managed and cannot be updated' })
      .optional(),
    createdAt: z.never({ message: 'createdAt is server-managed and cannot be updated' }).optional(),
    rewardType: z
      .never({ message: 'rewardType cannot be changed after creation' })
      .optional(),
  });

export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

export const ownerRewardRedemptionsQuerySchema = z.object({
  restaurantId: z
    .string()
    .regex(uuidRegex, 'Invalid restaurantId: must be a valid UUID')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int('Page must be an integer').min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
    ),
  status: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => ['pending', 'completed', 'cancelled', 'failed', 'all'].includes(val), {
      message: "Status must be 'pending', 'completed', 'cancelled', 'failed', or 'all'",
    })
    .default('all')
    .optional(),
});

export type OwnerRewardRedemptionsQueryInput = z.infer<typeof ownerRewardRedemptionsQuerySchema>;

