import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { orderPreviewSchema } from '@/lib/validation/order';
import { resolveQrContext } from '@/lib/qr/resolve';
import { calculateAuthoritativePricing } from '@/lib/orders/pricing';
import { formatOrderPreviewResponse } from '@/lib/orders/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce customer authentication
    await requireCustomer(request);

    // 2. Parse and validate request body
    const body = await request.json();
    const validatedInput = orderPreviewSchema.parse(body);

    // 3. Resolve and verify QR, table, branch, and restaurant context
    const qrContext = await resolveQrContext(
      validatedInput.qrToken,
      validatedInput.tableId
    );

    // 4. Compute authoritative pricing using Prisma Decimal (client prices ignored)
    const pricingResult = await calculateAuthoritativePricing(
      validatedInput.items,
      qrContext.restaurant.id,
      qrContext.table.id,
      validatedInput.couponCode,
      validatedInput.notes
    );

    // 5. Format sanitized quote response
    const formattedQuote = formatOrderPreviewResponse(
      pricingResult,
      qrContext.table
    );

    return successResponse(formattedQuote);
  } catch (error) {
    return handleApiError(error);
  }
}
