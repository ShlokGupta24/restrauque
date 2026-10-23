import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import {
  deriveDeterministicQrToken,
  hashQrToken,
  buildPublicQrUrl,
  generateQrCodeBuffer,
  generateQrCodeSvg,
} from '@/lib/qr/token';
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
        branches: true,
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

    const derivedToken = deriveDeterministicQrToken(table.id, activeQr.id);
    const isMatch = hashQrToken(derivedToken) === activeQr.code;

    if (!isMatch) {
      throw new NotFoundError(
        'QR code token is legacy or non-recoverable. Please rotate the QR code in the dashboard.'
      );
    }

    const qrUrl = buildPublicQrUrl(derivedToken);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'png';
    const cleanTableNum = table.table_number.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'svg') {
      const svg = await generateQrCodeSvg(qrUrl);
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': `inline; filename="table-${cleanTableNum}-qr.svg"`,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      });
    }

    const pngBuffer = await generateQrCodeBuffer(qrUrl);
    return new NextResponse(pngBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="table-${cleanTableNum}-qr.png"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
