import { prisma } from '@/lib/db/prisma';
import { isValidTokenFormat, hashQrToken } from '@/lib/qr/token';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export interface ResolvedQrContext {
  qrRecord: {
    id: string;
    table_id: string;
    code: string;
    is_active: boolean;
  };
  table: {
    id: string;
    branch_id: string;
    table_number: string;
    capacity: number;
    status: string;
    is_active: boolean;
  };
  branch: {
    id: string;
    restaurant_id: string;
    name: string;
    status: string;
    timezone: string;
  };
  restaurant: {
    id: string;
    name: string;
    status: string;
  };
}

/**
 * Resolves and validates table, branch, and restaurant context from a raw QR token.
 * Rejects inactive, maintenance, expired, or mismatched tables/branches/venues.
 */
export async function resolveQrContext(
  rawToken: string,
  expectedTableId?: string | null,
  dbClient: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ResolvedQrContext> {
  if (!isValidTokenFormat(rawToken)) {
    throw new NotFoundError('QR code is invalid, expired, or inactive');
  }

  const hashedCode = hashQrToken(rawToken);

  const qrRecord = await dbClient.qr_codes.findFirst({
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

  // Validate that table matches the client's expected tableId if supplied
  if (expectedTableId && table.id !== expectedTableId) {
    throw new ValidationError('The scanned QR code does not belong to the specified table');
  }

  // Enforce table active and maintenance status
  if (!table.is_active || table.status === 'maintenance') {
    throw new NotFoundError('This table is currently unavailable or under maintenance');
  }

  // Enforce branch and restaurant operational active status
  if (!branch || branch.status !== 'active') {
    throw new NotFoundError('This branch is currently inactive');
  }

  if (!restaurant || restaurant.status !== 'active') {
    throw new NotFoundError('This restaurant is currently inactive');
  }

  return {
    qrRecord: {
      id: qrRecord.id,
      table_id: qrRecord.table_id,
      code: qrRecord.code,
      is_active: qrRecord.is_active,
    },
    table: {
      id: table.id,
      branch_id: table.branch_id,
      table_number: table.table_number,
      capacity: table.capacity,
      status: table.status,
      is_active: table.is_active,
    },
    branch: {
      id: branch.id,
      restaurant_id: branch.restaurant_id,
      name: branch.name,
      status: branch.status,
      timezone: branch.timezone,
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      status: restaurant.status,
    },
  };
}
