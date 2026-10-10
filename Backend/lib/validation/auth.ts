import { z } from 'zod';
import { ALLOWED_REGISTRATION_ROLES, type AuthRole } from '@/types/auth';

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.string().email('Invalid email address format').max(255, 'Email cannot exceed 255 characters'));

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password cannot exceed 100 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(150, 'Name cannot exceed 150 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format')
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

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(100, 'Password is too long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
