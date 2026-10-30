import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('CORS and Origin Security Middleware', () => {
  it('should accept OPTIONS preflight from allowed customer dashboard origin with credentials', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/me', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5174',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type, authorization',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5174');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
    // Wildcard origin must strictly NOT be used with credentials
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('should accept OPTIONS preflight from allowed landing page origin with credentials', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/customer/otp/request', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('should REJECT untrusted origin from receiving CORS allow headers during preflight', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/auth/me', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://malicious-phishing-site.com',
        'access-control-request-method': 'GET',
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('should attach CORS headers to standard API responses for allowed origins', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/health', {
      method: 'GET',
      headers: {
        origin: 'http://localhost:5174',
      },
    });

    const res = middleware(req);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5174');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('should not attach CORS headers to requests from unauthorized origins', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/health', {
      method: 'GET',
      headers: {
        origin: 'https://evil-hacker.com',
      },
    });

    const res = middleware(req);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
