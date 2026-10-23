import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { ownerFeedbackQuerySchema } from '@/lib/validation/feedback';
import { getOwnerFeedback } from '@/lib/feedback/service';
import { prisma } from '@/lib/db/prisma';
import { ForbiddenError, NotFoundError, handleApiError } from '@/lib/http/errors';
import { successResponse } from '@/lib/http/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Parse and validate query parameters
    const queryInput = {
      restaurantId: searchParams.get('restaurantId') || undefined,
      branchId: searchParams.get('branchId') || undefined,
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const validatedQuery = ownerFeedbackQuerySchema.parse(queryInput);

    // 2. Authenticate owner and resolve authorized restaurant
    const authContext = await requireAuthorizedRestaurant(request, validatedQuery.restaurantId);
    const restaurantId = authContext.restaurant.id;

    // 3. If branchId filter provided, verify it belongs to this authorized restaurant
    if (validatedQuery.branchId) {
      const branch = await prisma.branches.findUnique({
        where: { id: validatedQuery.branchId },
      });
      if (!branch) {
        throw new NotFoundError('Branch not found');
      }
      if (branch.restaurant_id !== restaurantId) {
        throw new ForbiddenError(
          'Access forbidden: Requested branch does not belong to the authorized restaurant'
        );
      }
    }

    // 4. Retrieve owner feedback list and server-side summary
    const result = await getOwnerFeedback(restaurantId, validatedQuery);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
