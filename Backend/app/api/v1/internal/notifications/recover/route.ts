import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { recoverPendingNotifications } from '@/lib/notifications/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError, AuthenticationError, AppError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

/**
 * Validates the internal service Bearer token using a constant-time comparison
 * to eliminate timing-attack vulnerabilities.
 */
function verifyInternalSecret(request: NextRequest): void {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || secret.trim() === '') {
    throw new AppError(
      'Internal API secret is not configured on this server',
      500,
      'INTERNAL_API_SECRET_NOT_CONFIGURED'
    );
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or malformed Authorization header');
  }

  const providedToken = authHeader.slice(7).trim();
  const secretBuffer = Buffer.from(secret, 'utf-8');
  const providedBuffer = Buffer.from(providedToken, 'utf-8');

  if (
    secretBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(secretBuffer, providedBuffer)
  ) {
    throw new AuthenticationError('Invalid internal authorization secret');
  }
}

/**
 * POST /api/v1/internal/notifications/recover
 *
 * Secure internal sweep/recovery trigger intended for scheduled AWS EventBridge / CloudWatch
 * or container cron workers. Coordinates durable leases and recovers stale or failed external notifications.
 */
export async function POST(request: NextRequest) {
  try {
    verifyInternalSecret(request);

    let body: { maxBatchSize?: number; retryFailed?: boolean } = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      // Body is optional; fallback to defaults
    }

    const result = await recoverPendingNotifications({
      maxBatchSize: typeof body.maxBatchSize === 'number' ? body.maxBatchSize : undefined,
      retryFailed: typeof body.retryFailed === 'boolean' ? body.retryFailed : false,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
