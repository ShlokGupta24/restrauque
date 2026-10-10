import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { generateSecureQrToken, hashQrToken, buildPublicQrUrl } from '@/lib/qr/token';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(
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
    });

    if (!table) {
      throw new NotFoundError('Table not found');
    }

    const newRawToken = generateSecureQrToken();
    const newHashedCode = hashQrToken(newRawToken);

    const newQr = await prisma.$transaction(async (tx) => {
      // Invalidate all existing QR codes for this table
      await tx.qr_codes.updateMany({
        where: { table_id: tableId },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      // Create new active QR code
      return tx.qr_codes.create({
        data: {
          table_id: tableId,
          code: newHashedCode,
          qr_type: 'table',
          is_active: true,
        },
      });
    });

    return successResponse({
      qrCodeId: newQr.id,
      tableId: table.id,
      isQrActive: newQr.is_active,
      rawToken: newRawToken,
      qrUrl: buildPublicQrUrl(newRawToken),
      rotatedAt: newQr.created_at.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
