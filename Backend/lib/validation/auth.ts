import { z } from 'zod';
import { ALLOWED_REGISTRATION_ROLES, type AuthRole } from '@/types/auth';

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  // Strip all whitespace, hyphens, and parentheses
  let cleaned = raw.trim().replace(/[\s\-\(\)]/g, '');
  // If 10-digit number without country code, prefix with Indian country code +91
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  } else if (/^0\d{10}$/.test(cleaned)) {
    // Leading 0 + 10 digits
    cleaned = `+91${cleaned.substring(1)}`;
  } else if (/^91\d{10}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

export const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .min(10, 'Phone number must be at least 10 digits')
  .max(20, 'Phone number is too long')
  .transform(normalizePhoneNumber)
  .refine(
    (val) => /^\+[1-9]\d{7,14}$/.test(val),
    { message: 'Invalid phone number format. Please provide a valid E.164 phone number (e.g. +919876543210).' }
  );

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.string().email('Invalid email address format').max(255, 'Email cannot exceed 255 characters'));

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password cannot exceed 100 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Legacy generic register schema (maintained for backward compatibility)
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(150, 'Name cannot exceed 150 characters'),
  phone: z
    .string()
    .trim()
    .transform(normalizePhoneNumber)
    .refine((val) => !val || /^\+[1-9]\d{7,14}$/.test(val), { message: 'Invalid phone number format' })
    .optional()
    .or(z.literal('')),
  role: z
    .enum(ALLOWED_REGISTRATION_ROLES as unknown as [AuthRole, ...AuthRole[]], {
      errorMap: () => ({
        message: `Role must be one of the permitted roles: ${ALLOWED_REGISTRATION_ROLES.join(', ')}. Administrative and internal staff roles cannot be self-registered.`,
      }),
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Dedicated Restaurant Owner Registration Schema
export const ownerRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string({ required_error: 'Owner name is required' })
    .trim()
    .min(2, 'Owner name must be at least 2 characters long')
    .max(150, 'Owner name cannot exceed 150 characters'),
  phone: z
    .string()
    .trim()
    .transform(normalizePhoneNumber)
    .refine((val) => !val || /^\+[1-9]\d{7,14}$/.test(val), { message: 'Invalid phone number format' })
    .optional()
    .or(z.literal('')),
});

export type OwnerRegisterInput = z.infer<typeof ownerRegisterSchema>;

// Dedicated Restaurant Owner Login Schema
export const ownerLoginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(100, 'Password is too long'),
});

export type OwnerLoginInput = z.infer<typeof ownerLoginSchema>;

// Generic login schema (maintained for backward compatibility)
export const loginSchema = ownerLoginSchema;
export type LoginInput = OwnerLoginInput;

// Dedicated Customer OTP Request Schema
export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

// Dedicated Customer OTP Verify Schema
export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z
    .string({ required_error: 'OTP code is required' })
    .trim()
    .regex(/^\d{6}$/, 'OTP code must be a 6-digit number'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(150, 'Name cannot exceed 150 characters')
    .optional(),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
