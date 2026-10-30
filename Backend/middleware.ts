import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware for Restrauque API
 * - Enforces explicit CORS origin whitelist for credentialed customer & owner authentication.
 * - Handles CORS preflight OPTIONS requests without routing to business handlers.
 * - Never returns wildcard '*' origin with credentials: 'include'.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173', // Landing page
  'http://localhost:5174', // Customer dashboard
  'http://localhost:5175', // Restaurant dashboard
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>(DEFAULT_ALLOWED_ORIGINS);

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    });
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
      origins.add(appOrigin);
    } catch {
      // Invalid URL ignored
    }
  }

  return origins;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin ? allowedOrigins.has(origin) : false;

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });

    if (isAllowed && origin) {
      preflightResponse.headers.set('Access-Control-Allow-Origin', origin);
      preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      preflightResponse.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      preflightResponse.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept, Cookie'
      );
      preflightResponse.headers.set('Access-Control-Max-Age', '86400');
    }

    return preflightResponse;
  }

  // Handle standard requests
  const response = NextResponse.next();

  if (isAllowed && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
