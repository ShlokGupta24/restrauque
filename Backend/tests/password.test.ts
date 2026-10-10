import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password Hashing & Verification', () => {
  it('should hash a password and not equal plaintext', async () => {
    const plain = 'StrongPass123';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
  });

  it('should correctly verify valid password', async () => {
    const plain = 'StrongPass123';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it('should reject invalid password', async () => {
    const plain = 'StrongPass123';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword('WrongPass456', hash);
    expect(isValid).toBe(false);
  });
});
