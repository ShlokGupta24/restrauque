import { z } from 'zod';
import { normalizePhoneNumber } from './auth';

const optionalPhoneSchema = z
  .string()
  .trim()
  .transform(normalizePhoneNumber)
  .refine((val) => !val || /^\+[1-9]\d{7,14}$/.test(val), {
    message: 'Invalid phone number format. Please provide a valid E.164 phone number (e.g. +919876543210).'
  })
  .optional()
  .or(z.literal(''));

const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email('Invalid email address format').max(255, 'Email cannot exceed 255 characters'))
  .optional()
  .or(z.literal(''));

export const createInitialBranchSchema = z.object({
  name: z
    .string({ required_error: 'Branch name is required' })
    .trim()
    .min(1, 'Branch name is required')
    .max(150, 'Branch name cannot exceed 150 characters'),
  phone: optionalPhoneSchema,
  address: z.string().trim().max(500, 'Address is too long').optional().nullable(),
  city: z.string().trim().max(100, 'City is too long').optional().nullable(),
  state: z.string().trim().max(100, 'State is too long').optional().nullable(),
  country: z.string().trim().max(100, 'Country is too long').default('India'),
  timezone: z.string().trim().max(50, 'Timezone is too long').default('Asia/Kolkata'),
});

export const createRestaurantSchema = z.object({
  name: z
    .string({ required_error: 'Restaurant name is required' })
    .trim()
    .min(1, 'Restaurant name is required')
    .max(150, 'Restaurant name cannot exceed 150 characters'),
  legalName: z.string().trim().max(200, 'Legal name cannot exceed 200 characters').optional().nullable(),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  address: z.string().trim().max(500, 'Address is too long').optional().nullable(),
  city: z.string().trim().max(100, 'City is too long').optional().nullable(),
  state: z.string().trim().max(100, 'State is too long').optional().nullable(),
  country: z.string().trim().max(100, 'Country is too long').default('India'),
  timezone: z.string().trim().max(50, 'Timezone is too long').default('Asia/Kolkata'),
  initialBranch: createInitialBranchSchema.optional().nullable(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Restaurant name cannot be empty')
    .max(150, 'Restaurant name cannot exceed 150 characters')
    .optional(),
  legalName: z.string().trim().max(200, 'Legal name cannot exceed 200 characters').optional().nullable(),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  address: z.string().trim().max(500, 'Address is too long').optional().nullable(),
  city: z.string().trim().max(100, 'City is too long').optional().nullable(),
  state: z.string().trim().max(100, 'State is too long').optional().nullable(),
  country: z.string().trim().max(100, 'Country is too long').optional(),
  timezone: z.string().trim().max(50, 'Timezone is too long').optional(),
  status: z
    .enum(['active', 'inactive'], {
      errorMap: () => ({ message: "Status must be 'active' or 'inactive'" }),
    })
    .optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

export const createBranchSchema = z.object({
  name: z
    .string({ required_error: 'Branch name is required' })
    .trim()
    .min(1, 'Branch name is required')
    .max(150, 'Branch name cannot exceed 150 characters'),
  phone: optionalPhoneSchema,
  address: z.string().trim().max(500, 'Address is too long').optional().nullable(),
  city: z.string().trim().max(100, 'City is too long').optional().nullable(),
  state: z.string().trim().max(100, 'State is too long').optional().nullable(),
  country: z.string().trim().max(100, 'Country is too long').default('India'),
  timezone: z.string().trim().max(50, 'Timezone is too long').default('Asia/Kolkata'),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Branch name cannot be empty')
    .max(150, 'Branch name cannot exceed 150 characters')
    .optional(),
  phone: optionalPhoneSchema,
  address: z.string().trim().max(500, 'Address is too long').optional().nullable(),
  city: z.string().trim().max(100, 'City is too long').optional().nullable(),
  state: z.string().trim().max(100, 'State is too long').optional().nullable(),
  country: z.string().trim().max(100, 'Country is too long').optional(),
  timezone: z.string().trim().max(50, 'Timezone is too long').optional(),
  status: z
    .enum(['active', 'inactive'], {
      errorMap: () => ({ message: "Status must be 'active' or 'inactive'" }),
    })
    .optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
