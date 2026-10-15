import { NextRequest } from 'next/server';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { dashboardSalesQuerySchema } from '@/lib/validation/dashboard';
import { resolveDateRange } from '@/lib/dashboard/timezone';
import { getDashboardSalesData } from '@/lib/dashboard/sales';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import { DashboardEffectiveRange } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/owner/dashboard/sales
 *
 * Provides comprehensive POS sales and settlement reporting for restaurant owners.
 *
 * Query Parameters:
 * - dateFrom: Optional ISO date/timestamp string or YYYY-MM-DD
 * - dateTo: Optional ISO date/timestamp string or YYYY-MM-DD
 * - preset: Optional enum ('today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month')
 * - branchId: Optional UUID of branch belonging to authorized restaurant
 *
 * Precedence Rule:
 * Explicit dateFrom / dateTo take precedence over preset. If neither is supplied,
 * defaults to 'today'.
 *
 * Guarantees:
 * - Strictly tenant-isolated: restaurantId is derived exclusively from authorized context.
 * - Timezone-correct boundaries computed in the restaurant/branch configured timezone.
 * - Enforces max 90-day range limit and rejects inverted ranges.
 * - Returns zero-safe numeric metrics and empty arrays for periods with no activity.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate owner and resolve restaurant context
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      preset: searchParams.get('preset') || undefined,
      branchId: searchParams.get('branchId') || undefined,
    };

    const validatedQuery = dashboardSalesQuerySchema.parse(queryInput);

    // 3. Verify branch belongs to authorized restaurant if branchId is specified
    let selectedBranchTimezone: string | null = null;
    if (validatedQuery.branchId) {
      const branch = restContext.branches.find((b) => b.id === validatedQuery.branchId);
      if (!branch) {
        throw new ForbiddenError(
          'Access forbidden: Requested branch does not belong to your authorized restaurant'
        );
      }
      selectedBranchTimezone = branch.timezone || null;
    }

    // 4. Determine effective reporting timezone
    const reportingTimezone =
      selectedBranchTimezone || restContext.restaurant.timezone || 'Asia/Kolkata';

    // 5. Resolve date range boundaries
    const { startDate, endDate, startDateIso, endDateIso, resolvedPreset } = resolveDateRange(
      {
        dateFrom: validatedQuery.dateFrom,
        dateTo: validatedQuery.dateTo,
        preset: validatedQuery.preset,
      },
      reportingTimezone
    );

    // 6. Range validations:
    // A. Inverted range check
    if (startDate.getTime() > endDate.getTime()) {
      throw new ValidationError('dateFrom cannot be after dateTo');
    }

    // B. Maximum 90-day range limit (plus 1 hour tolerance for DST shifts)
    const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000 + 3600000;
    if (endDate.getTime() - startDate.getTime() > MAX_RANGE_MS) {
      throw new ValidationError('Date range cannot exceed 90 calendar days');
    }

    // 7. Compute sales and settlement metrics
    const effectiveRange: DashboardEffectiveRange = {
      startDate,
      endDate,
      startDateIso,
      endDateIso,
      timezone: reportingTimezone,
      preset: resolvedPreset,
      branchId: validatedQuery.branchId || null,
      restaurantId,
    };

    const dashboardData = await getDashboardSalesData(effectiveRange);

    return successResponse(dashboardData);
  } catch (error) {
    return handleApiError(error);
  }
}
