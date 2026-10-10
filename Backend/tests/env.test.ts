import { describe, it, expect } from 'vitest';
import { getEnv } from '@/lib/config/env';

describe('Environment Variable Validation', () => {
  it('should successfully validate when required variables are present', () => {
    const env = getEnv();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.JWT_SECRET).toBeDefined();
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeDefined();
  });
});
