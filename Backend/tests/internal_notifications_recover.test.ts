import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as recoverHandler } from '@/app/api/v1/internal/notifications/recover/route';
import * as notificationService from '@/lib/notifications/service';

vi.mock('@/lib/notifications/service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notifications/service')>(
    '@/lib/notifications/service'
  );
  return {
    ...actual,
    recoverPendingNotifications: vi.fn(),
  };
});

describe('POST /api/v1/internal/notifications/recover', () => {
  const originalSecret = process.env.INTERNAL_API_SECRET;
  const mockSecret = 'super-secret-internal-key-for-testing-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_SECRET = mockSecret;
  });

  afterAll(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it('rejects with 500 if INTERNAL_API_SECRET is not configured on the server', async () => {
    delete process.env.INTERNAL_API_SECRET;

    const req = new NextRequest('http://localhost/api/v1/internal/notifications/recover', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mockSecret}`,
      },
    });

    const res = await recoverHandler(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INTERNAL_API_SECRET_NOT_CONFIGURED');
  });

  it('rejects with 401 if Authorization header is missing', async () => {
    const req = new NextRequest('http://localhost/api/v1/internal/notifications/recover', {
      method: 'POST',
    });

    const res = await recoverHandler(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects with 401 if Authorization token is incorrect', async () => {
    const req = new NextRequest('http://localhost/api/v1/internal/notifications/recover', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-secret-token',
      },
    });

    const res = await recoverHandler(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('successfully triggers recovery sweeper when authorized with valid Bearer secret', async () => {
    (notificationService.recoverPendingNotifications as any).mockResolvedValue({
      scannedCount: 5,
      distinctOrdersCount: 3,
      processedOrdersCount: 3,
      processedCount: 3,
      failedOrdersCount: 0,
    });

    const req = new NextRequest('http://localhost/api/v1/internal/notifications/recover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mockSecret}`,
      },
      body: JSON.stringify({
        maxBatchSize: 25,
        retryFailed: true,
      }),
    });

    const res = await recoverHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.scannedCount).toBe(5);
    expect(json.data.processedCount).toBe(3);

    expect(notificationService.recoverPendingNotifications).toHaveBeenCalledWith({
      maxBatchSize: 25,
      retryFailed: true,
    });
  });
});
