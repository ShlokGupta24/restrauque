import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const customerMenuQuerySchema = z
  .object({
    qrToken: z
      .string({ required_error: 'QR token is required' })
      .trim()
      .min(20, 'QR token must be at least 20 characters')
      .max(128, 'QR token cannot exceed 128 characters'),
    tableId: z
      .string()
      .regex(uuidRegex, 'Invalid tableId: must be a valid UUID')
      .optional(),
  });

export const orderItemInputSchema = z
  .object({
    productId: z
      .string({ required_error: 'productId is required' })
      .regex(uuidRegex, 'Invalid productId: must be a valid UUID'),
    variantId: z
      .string()
      .regex(uuidRegex, 'Invalid variantId: must be a valid UUID')
      .nullable()
      .optional(),
    addonIds: z
      .array(z.string().regex(uuidRegex, 'Invalid addonId: must be a valid UUID'))
      .max(10, 'Cannot select more than 10 add-ons per item')
      .optional()
      .default([]),
    quantity: z
      .number({ required_error: 'quantity is required' })
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(99, 'Quantity cannot exceed 99'),
    specialInstructions: z
      .string()
      .trim()
      .max(255, 'Special instructions cannot exceed 255 characters')
      .nullable()
      .optional(),
  });

export const orderPreviewSchema = z
  .object({
    qrToken: z
      .string({ required_error: 'QR token is required' })
      .trim()
      .min(20, 'QR token must be at least 20 characters')
      .max(128, 'QR token cannot exceed 128 characters'),
    tableId: z
      .string()
      .regex(uuidRegex, 'Invalid tableId: must be a valid UUID')
      .optional(),
    items: z
      .array(orderItemInputSchema, { required_error: 'items array is required' })
      .min(1, 'Order must contain at least 1 item')
      .max(50, 'Order cannot exceed 50 items'),
    couponCode: z
      .string()
      .trim()
      .max(50, 'Coupon code cannot exceed 50 characters')
      .nullable()
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict();

export const createOrderSchema = z
  .object({
    qrToken: z
      .string({ required_error: 'QR token is required' })
      .trim()
      .min(20, 'QR token must be at least 20 characters')
      .max(128, 'QR token cannot exceed 128 characters'),
    tableId: z
      .string()
      .regex(uuidRegex, 'Invalid tableId: must be a valid UUID')
      .optional(),
    idempotencyKey: z
      .string()
      .trim()
      .min(1, 'Idempotency key cannot be empty')
      .max(100, 'Idempotency key cannot exceed 100 characters')
      .nullable()
      .optional(),
    expectedTotal: z
      .number()
      .min(0, 'expectedTotal cannot be negative')
      .nullable()
      .optional(),
    items: z
      .array(orderItemInputSchema, { required_error: 'items array is required' })
      .min(1, 'Order must contain at least 1 item')
      .max(50, 'Order cannot exceed 50 items'),
    couponCode: z
      .string()
      .trim()
      .max(50, 'Coupon code cannot exceed 50 characters')
      .nullable()
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict();

export type CustomerMenuQueryInput = z.infer<typeof customerMenuQuerySchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type OrderPreviewInput = z.infer<typeof orderPreviewSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
