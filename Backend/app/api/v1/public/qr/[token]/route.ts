import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isValidTokenFormat, hashQrToken } from '@/lib/qr/token';
import { formatPublicResolvedTable } from '@/lib/tables/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token format and length before hitting the database
    if (!isValidTokenFormat(token)) {
      throw new NotFoundError('QR code is invalid, expired, or inactive');
    }

    const hashedCode = hashQrToken(token);

    // Look up active QR code matching hash
    const qrRecord = await prisma.qr_codes.findFirst({
      where: {
        code: hashedCode,
        is_active: true,
      },
      include: {
        restaurant_tables: {
          include: {
            branches: {
              include: {
                restaurants: true,
              },
            },
          },
        },
      },
    });

    if (!qrRecord || !qrRecord.restaurant_tables) {
      throw new NotFoundError('QR code is invalid, expired, or inactive');
    }

    const table = qrRecord.restaurant_tables;
    const branch = table.branches;
    const restaurant = branch?.restaurants;

    // Check table, branch, and restaurant active status
    if (
      !table.is_active ||
      table.status === 'maintenance' ||
      !branch ||
      branch.status !== 'active' ||
      !restaurant ||
      restaurant.status !== 'active'
    ) {
      throw new NotFoundError('QR code is invalid, expired, or inactive');
    }

    // Return sanitized public table & venue information
    return successResponse(formatPublicResolvedTable(table, branch, restaurant));
  } catch (error) {
    return handleApiError(error);
  }
}
