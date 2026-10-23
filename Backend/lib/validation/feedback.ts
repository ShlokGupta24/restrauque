import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const itemFeedbackInputSchema = z
  .object({
    productId: z
      .string({ required_error: 'productId is required' })
      .regex(uuidRegex, 'Invalid productId: must be a valid UUID'),
    rating: z
      .number({ required_error: 'Item rating is required' })
      .int('Rating must be an integer')
      .min(1, 'Rating must be between 1 and 5 stars')
      .max(5, 'Rating must be between 1 and 5 stars'),
    comment: z
      .string()
      .trim()
      .max(500, 'Item comment cannot exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict();

export const createFeedbackSchema = z
  .object({
    rating: z
      .number({ required_error: 'Overall rating is required' })
      .int('Rating must be an integer')
      .min(1, 'Overall rating must be between 1 and 5 stars')
      .max(5, 'Overall rating must be between 1 and 5 stars'),
    comment: z
      .string()
      .trim()
      .max(1000, 'Overall comment cannot exceed 1000 characters')
      .nullable()
      .optional(),
    items: z
      .array(itemFeedbackInputSchema)
      .max(50, 'Cannot review more than 50 items')
      .optional()
      .default([]),
  })
  .strict();

export const updateLoyaltyRulesSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Program name must be at least 2 characters')
      .max(150, 'Program name cannot exceed 150 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    starsPerVisit: z
      .number()
      .int('Stars per visit must be an integer')
      .min(0, 'Stars per visit cannot be negative')
      .max(500, 'Stars per visit cannot exceed 500')
      .optional(),
    starsPerReview: z
      .number()
      .int('Stars per review must be an integer')
      .min(0, 'Stars per review cannot be negative')
      .max(500, 'Stars per review cannot exceed 500')
      .optional(),
    earningMode: z
      .enum(['visit_and_review', 'review_only', 'visit_only'])
      .optional(),
    redemptionRate: z
      .number({ invalid_type_error: 'Redemption rate must be a number' })
      .finite('Redemption rate must be a finite number')
      .positive('Redemption rate must be greater than 0')
      .max(100, 'Redemption rate cannot exceed 100')
      .refine(
        (val) => Number(val.toFixed(2)) === val,
        'Redemption rate cannot have more than 2 decimal places'
      )
      .optional(),
  })
  .strict();

export type ItemFeedbackInput = z.infer<typeof itemFeedbackInputSchema>;
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateLoyaltyRulesInput = z.infer<typeof updateLoyaltyRulesSchema>;

export const customerFeedbackStatusEnum = z.enum(['all', 'awaiting_review', 'reviewed']);
export type CustomerFeedbackStatus = z.infer<typeof customerFeedbackStatusEnum>;

export const customerFeedbackQuerySchema = z
  .object({
    status: customerFeedbackStatusEnum.optional().default('all'),
    restaurantId: z
      .string()
      .regex(uuidRegex, 'Invalid restaurantId: must be a valid UUID')
      .optional(),
    limit: z
      .string()
      .optional()
      .refine(
        (val) => val === undefined || (/^\d+$/.test(val.trim()) && !isNaN(parseInt(val.trim(), 10))),
        { message: 'Limit must be a valid positive integer' }
      )
      .transform((val) => (val ? parseInt(val.trim(), 10) : 10))
      .pipe(
        z
          .number()
          .int()
          .min(1, 'Limit must be at least 1')
          .max(50, 'Limit cannot exceed 50')
      ),
    cursor: z
      .string()
      .trim()
      .max(500, 'Cursor is too long')
      .optional(),
  });

export interface CustomerFeedbackQueryOptions {
  status?: 'all' | 'awaiting_review' | 'reviewed';
  restaurantId?: string;
  limit?: number;
  cursor?: string;
}

export type CustomerFeedbackQueryInput = CustomerFeedbackQueryOptions;

export const ownerFeedbackQuerySchema = z
  .object({
    restaurantId: z
      .string()
      .regex(uuidRegex, 'Invalid restaurantId: must be a valid UUID')
      .optional(),
    branchId: z
      .string()
      .regex(uuidRegex, 'Invalid branchId: must be a valid UUID')
      .optional(),
    limit: z
      .union([
        z
          .string()
          .refine(
            (val) => /^\d+$/.test(val.trim()) && !isNaN(parseInt(val.trim(), 10)),
            { message: 'Limit must be a valid positive integer' }
          )
          .transform((val) => parseInt(val.trim(), 10)),
        z.number().int({ message: 'Limit must be an integer' }),
      ])
      .optional()
      .default(20)
      .pipe(
        z
          .number()
          .int()
          .min(1, 'Limit must be at least 1')
          .max(100, 'Limit cannot exceed 100')
      ),
    cursor: z
      .string()
      .trim()
      .max(500, 'Cursor is too long')
      .optional(),
    startDate: z
      .string()
      .datetime({ message: 'Invalid startDate: must be a valid ISO 8601 date string' })
      .optional(),
    endDate: z
      .string()
      .datetime({ message: 'Invalid endDate: must be a valid ISO 8601 date string' })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate cannot be after endDate',
      path: ['startDate'],
    }
  );

export type OwnerFeedbackQueryInput = z.infer<typeof ownerFeedbackQuerySchema>;
