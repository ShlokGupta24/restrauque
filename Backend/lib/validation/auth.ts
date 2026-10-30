import { z } from 'zod';
import { ALLOWED_REGISTRATION_ROLES, type AuthRole } from '@/types/auth';

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  // Strip all whitespace, hyphens, parentheses, and dots
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');

  // Strip all leading '+' for clean pattern matching
  cleaned = cleaned.replace(/^\++/, '');

  // 1. If 10-digit number starting with 0 (e.g. 09876543210), strip 0 and prefix +91
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned.substring(1)}`;
  }

  // 2. If 10-digit Indian mobile number (6, 7, 8, 9), prefix with Indian country code +91
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // 3. If 12-digit number starting with 91 followed by Indian mobile (e.g. 919876543210)
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 4. Standard international E.164 digits without plus (7 to 15 digits)
  if (/^[1-9]\d{6,14}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .min(10, 'Phone number must be at least 10 digits')
  .max(20, 'Phone number is too long')
  .transform(normalizePhoneNumber)
  .refine(
    (val) => /^\+[1-9]\d{7,14}$/.test(val),
    { message: 'Invalid phone number format. Please provide a valid E.164 phone number (e.g. +919876543210).' }
  )
  .refine(
    (val) => {
      if (val.startsWith('+91')) {
        return /^\+91[6-9]\d{9}$/.test(val);
      }
      return true;
    },
    { message: 'Invalid Indian mobile number. Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9.' }
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
