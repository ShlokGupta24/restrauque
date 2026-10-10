import { describe, it, expect } from 'vitest';
import { createJwtToken, verifyJwtToken } from '@/lib/auth/jwt';
import type { SessionPayload } from '@/types/auth';

describe('JWT Token Lifecycle', () => {
  const samplePayload: SessionPayload = {
    userId: '11111111-1111-1111-1111-111111111111',
    sessionId: '22222222-2222-2222-2222-222222222222',
    sessionToken: '3333333333333333333333333333333333333333333333333333333333333333',
    email: 'user@example.com',
    role: 'CUSTOMER',
  };

  it('should sign and verify valid JWT token', async () => {
    const token = await createJwtToken(samplePayload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = await verifyJwtToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(samplePayload.userId);
    expect(verified?.sessionId).toBe(samplePayload.sessionId);
    expect(verified?.sessionToken).toBe(samplePayload.sessionToken);
    expect(verified?.email).toBe(samplePayload.email);
    expect(verified?.role).toBe(samplePayload.role);
  });

  it('should return null for malformed or tampered token', async () => {
    const validToken = await createJwtToken(samplePayload);
    const tampered = validToken.slice(0, -5) + 'abcde';

    const verified = await verifyJwtToken(tampered);
    expect(verified).toBeNull();
  });

  it('should return null for arbitrary strings', async () => {
    const verified = await verifyJwtToken('not-a-jwt-token');
    expect(verified).toBeNull();
  });
});
