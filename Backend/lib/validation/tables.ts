import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const tableStatusEnum = z.enum(['available', 'occupied', 'reserved', 'maintenance'], {
  errorMap: () => ({
    message: 'Status must be one of: available, occupied, reserved, maintenance',
  }),
});

export const createTableSchema = z
  .object({
    branchId: z
      .string({ required_error: 'Branch ID is required' })
      .regex(uuidRegex, 'Invalid branchId: must be a valid UUID'),
    tableNumber: z
      .string({ required_error: 'Table identifier is required' })
      .trim()
      .min(1, 'Table identifier cannot be empty')
      .max(20, 'Table identifier cannot exceed 20 characters'),
    capacity: z
      .number({ required_error: 'Capacity is required' })
      .int('Capacity must be an integer')
      .min(1, 'Capacity must be at least 1')
      .max(100, 'Capacity cannot exceed 100')
      .default(2),
    status: tableStatusEnum.default('available'),
    isActive: z.boolean().optional().default(true),
    isQrActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateTableSchema = z
  .object({
    tableNumber: z
      .string()
      .trim()
      .min(1, 'Table identifier cannot be empty')
      .max(20, 'Table identifier cannot exceed 20 characters')
      .optional(),
    capacity: z
      .number()
      .int('Capacity must be an integer')
      .min(1, 'Capacity must be at least 1')
      .max(100, 'Capacity cannot exceed 100')
      .optional(),
    status: tableStatusEnum.optional(),
    isActive: z.boolean().optional(),
    isQrActive: z.boolean().optional(),
  })
  .strict();

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
