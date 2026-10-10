import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@/lib/validation/auth';

describe('Authentication Request Validation', () => {
  describe('registerSchema', () => {
    it('should validate and normalize valid registration for CUSTOMER', () => {
      const input = {
        email: '  Alice@Example.Com ',
        password: 'Password123',
        name: 'Alice Smith',
        role: 'CUSTOMER',
      };

      const parsed = registerSchema.parse(input);
      expect(parsed.email).toBe('alice@example.com');
      expect(parsed.role).toBe('CUSTOMER');
    });

    it('should validate valid registration for RESTAURANT_OWNER', () => {
      const input = {
        email: 'owner@bistro.com',
        password: 'Password123',
        name: 'Bob Owner',
        role: 'RESTAURANT_OWNER',
      };

      const parsed = registerSchema.parse(input);
      expect(parsed.role).toBe('RESTAURANT_OWNER');
    });

    it('should REJECT unsupported roles such as ADMIN, STAFF, SUPERADMIN', () => {
      const unsupportedRoles = ['ADMIN', 'STAFF', 'SUPERADMIN', 'MANAGER', 'GUEST'];

      for (const role of unsupportedRoles) {
        expect(() =>
          registerSchema.parse({
            email: 'user@example.com',
            password: 'Password123',
            name: 'User Test',
            role,
          })
        ).toThrow();
      }
    });

    it('should reject weak password (< 8 chars, missing number or uppercase)', () => {
      expect(() =>
        registerSchema.parse({
          email: 'user@example.com',
          password: 'short',
          name: 'User',
          role: 'CUSTOMER',
        })
      ).toThrow();

      expect(() =>
        registerSchema.parse({
          email: 'user@example.com',
          password: 'lowercaseonly123',
          name: 'User',
          role: 'CUSTOMER',
        })
      ).toThrow();
    });

    it('should reject invalid email format', () => {
      expect(() =>
        registerSchema.parse({
          email: 'not-an-email',
          password: 'Password123',
          name: 'User',
          role: 'CUSTOMER',
        })
      ).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should validate and normalize valid login input', () => {
      const parsed = loginSchema.parse({
        email: '  Owner@Cafe.com ',
        password: 'Password123',
      });
      expect(parsed.email).toBe('owner@cafe.com');
    });

    it('should reject missing email or password', () => {
      expect(() => loginSchema.parse({ email: 'owner@cafe.com' })).toThrow();
      expect(() => loginSchema.parse({ password: 'Password123' })).toThrow();
    });
  });
});
