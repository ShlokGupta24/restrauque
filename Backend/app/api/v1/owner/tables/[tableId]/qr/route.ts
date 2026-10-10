import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { formatQrMetadata } from '@/lib/tables/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    validateUuid(tableId, 'tableId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const table = await prisma.restaurant_tables.findFirst({
      where: {
        id: tableId,
        branches: {
          restaurant_id: restaurantId,
        },
      },
      include: {
        branches: {
          select: { id: true, name: true },
        },
        qr_codes: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!table) {
      throw new NotFoundError('Table not found');
    }

    const activeQr = table.qr_codes[0];
    if (!activeQr) {
      throw new NotFoundError('No active QR code found for this table');
    }

    return successResponse({
      qr: formatQrMetadata(activeQr, table, table.branches),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
