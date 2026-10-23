import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ForbiddenError } from '@/lib/http/errors';
import { listCancelledOrdersWithOutstandingLoyaltyLiability } from '@/lib/loyalty/service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const discoveryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),
  branchId: z
    .string()
    .regex(uuidRegex, 'Invalid branchId: must be a valid UUID')
    .optional(),
  unrecoveredOnly: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true'),
});

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate owner and resolve authorized restaurant
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const query = discoveryQuerySchema.parse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      branchId: searchParams.get('branchId') || undefined,
      unrecoveredOnly: searchParams.get('unrecoveredOnly') || undefined,
    });

    // 3. Tenancy check on branch if provided
    if (query.branchId) {
      const branchBelongs = restContext.branches.some((b) => b.id === query.branchId);
      if (!branchBelongs) {
        throw new ForbiddenError(
          'Access forbidden: Requested branch does not belong to your authorized restaurant'
        );
      }
    }

    // 4. Execute authoritative, bounded discovery
    const result = await listCancelledOrdersWithOutstandingLoyaltyLiability(
      restaurantId,
      query
    );

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
