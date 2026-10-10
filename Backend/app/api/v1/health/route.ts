import { prisma } from '@/lib/db/prisma';
import { successResponse, errorResponse } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Lightweight database ping without exposing connection or credentials
    await prisma.$queryRaw`SELECT 1`;

    return successResponse(
      {
        status: 'healthy',
        database: 'connected',
        version: 'v1',
      },
      200
    );
  } catch {
    return errorResponse(
      'Service temporarily unavailable',
      503,
      'SERVICE_UNAVAILABLE',
      {
        status: 'unhealthy',
        database: 'disconnected',
      }
    );
  }
}
