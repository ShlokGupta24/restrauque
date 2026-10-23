import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { formatQrMetadata } from '@/lib/tables/format';
import {
  deriveDeterministicQrToken,
  hashQrToken,
  buildPublicQrUrl,
  generateQrCodeDataUrl,
  generateQrCodeSvg,
} from '@/lib/qr/token';
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

    const { searchParams } = new URL(request.url);
    const autoProvision = searchParams.get('autoProvision') === 'true';

    let activeQr = table.qr_codes[0];

    // Auto-provision if table has no active QR identity and requested
    if (!activeQr && autoProvision) {
      const qrId = crypto.randomUUID();
      const rawToken = deriveDeterministicQrToken(table.id, qrId);
      const hashedCode = hashQrToken(rawToken);

      activeQr = await prisma.qr_codes.create({
        data: {
          id: qrId,
          table_id: table.id,
          code: hashedCode,
          qr_type: 'table',
          is_active: true,
        },
      });
    }

    if (!activeQr) {
      throw new NotFoundError('No active QR code found for this table');
    }

    // Determine if token is deterministically recoverable from server secret
    const derivedToken = deriveDeterministicQrToken(table.id, activeQr.id);
    let isMatch = hashQrToken(derivedToken) === activeQr.code;

    // If autoProvision is enabled and legacy record does not match, heal it
    if (!isMatch && autoProvision) {
      activeQr = await prisma.qr_codes.update({
        where: { id: activeQr.id },
        data: {
          code: hashQrToken(derivedToken),
          updated_at: new Date(),
        },
      });
      isMatch = true;
    }

    let qrUrl: string | undefined;
    let qrImage: string | undefined;
    let qrSvg: string | undefined;

    if (isMatch) {
      qrUrl = buildPublicQrUrl(derivedToken);
      const [img, svg] = await Promise.all([
        generateQrCodeDataUrl(qrUrl),
        generateQrCodeSvg(qrUrl),
      ]);
      qrImage = img;
      qrSvg = svg;
    }

    return successResponse({
      qr: {
        ...formatQrMetadata(activeQr, table, table.branches),
        ...(qrUrl ? { qrUrl } : {}),
        ...(qrImage ? { qrImage } : {}),
        ...(qrSvg ? { qrSvg } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
