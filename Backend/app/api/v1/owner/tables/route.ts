import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { createTableSchema } from '@/lib/validation/tables';
import { formatDiningTable } from '@/lib/tables/format';
import crypto from 'crypto';
import {
  generateSecureQrToken,
  hashQrToken,
  buildPublicQrUrl,
  generateQrCodeDataUrl,
  generateQrCodeSvg,
} from '@/lib/qr/token';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError, ValidationError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const isActiveParam = searchParams.get('isActive');
    const isQrActiveParam = searchParams.get('isQrActive');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.restaurant_tablesWhereInput = {
      branches: {
        restaurant_id: restaurantId,
      },
    };

    if (branchId) {
      validateUuid(branchId, 'branchId');
      where.branch_id = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
      where.is_active = isActiveParam === 'true';
    }

    if (search) {
      where.table_number = { contains: search, mode: 'insensitive' };
    }

    if (isQrActiveParam !== null && isQrActiveParam !== undefined && isQrActiveParam !== '') {
      const qrActive = isQrActiveParam === 'true';
      if (qrActive) {
        where.qr_codes = { some: { is_active: true } };
      } else {
        where.qr_codes = { none: { is_active: true } };
      }
    }

    const [tableList, total, activeCount, inactiveCount, availableCount, occupiedCount, reservedCount, maintenanceCount, qrActiveCount] =
      await Promise.all([
        prisma.restaurant_tables.findMany({
          where,
          include: {
            branches: {
              select: { name: true },
            },
            qr_codes: {
              where: { is_active: true },
              take: 1,
            },
          },
          orderBy: [{ table_number: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        }),
        prisma.restaurant_tables.count({ where }),
        prisma.restaurant_tables.count({
          where: { branches: { restaurant_id: restaurantId }, is_active: true },
        }),
        prisma.restaurant_tables.count({
          where: { branches: { restaurant_id: restaurantId }, is_active: false },
        }),
        prisma.restaurant_tables.count({
          where: { branches: { restaurant_id: restaurantId }, status: 'available' },
        }),
        prisma.restaurant_tables.count({
          where: { branches: { restaurant_id: restaurantId }, status: 'occupied' },
        }),
        prisma.restaurant_tables.count({
          where: { branches: { restaurant_id: restaurantId }, status: 'reserved' },
        }),
        prisma.restaurant_tables.count({
          where: { branches: { restaurant_id: restaurantId }, status: 'maintenance' },
        }),
        prisma.restaurant_tables.count({
          where: {
            branches: { restaurant_id: restaurantId },
            qr_codes: { some: { is_active: true } },
          },
        }),
      ]);

    const formatted = tableList.map((t) => formatDiningTable(t, t.branches?.name, t.qr_codes[0]));

    return successResponse({
      tables: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalTables: activeCount + inactiveCount,
        activeTables: activeCount,
        inactiveTables: inactiveCount,
        availableTables: availableCount,
        occupiedTables: occupiedCount,
        reservedTables: reservedCount,
        maintenanceTables: maintenanceCount,
        qrActiveTables: qrActiveCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const rawBody = await request.json();
    const validatedData = createTableSchema.parse(rawBody);

    // Validate that branch belongs to this restaurant
    const branch = await prisma.branches.findFirst({
      where: {
        id: validatedData.branchId,
        restaurant_id: restaurantId,
      },
    });

    if (!branch) {
      throw new ValidationError(
        'The specified branch does not exist or does not belong to this restaurant'
      );
    }

    // Check for duplicate table number within the branch
    const existing = await prisma.restaurant_tables.findFirst({
      where: {
        branch_id: validatedData.branchId,
        table_number: { equals: validatedData.tableNumber, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictError(
        `A table with number "${validatedData.tableNumber}" already exists in this branch`
      );
    }

    const tableId = crypto.randomUUID();
    const qrId = crypto.randomUUID();
    const rawToken = generateSecureQrToken(tableId, qrId);
    const hashedCode = hashQrToken(rawToken);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const table = await tx.restaurant_tables.create({
          data: {
            id: tableId,
            branch_id: validatedData.branchId,
            table_number: validatedData.tableNumber,
            capacity: validatedData.capacity,
            status: validatedData.status,
            is_active: validatedData.isActive ?? true,
          },
        });

        const qr = await tx.qr_codes.create({
          data: {
            id: qrId,
            table_id: table.id,
            code: hashedCode,
            qr_type: 'table',
            is_active: validatedData.isQrActive ?? true,
          },
        });

        return { table, qr };
      });

      const qrUrl = buildPublicQrUrl(rawToken);
      const [qrImage, qrSvg] = await Promise.all([
        generateQrCodeDataUrl(qrUrl),
        generateQrCodeSvg(qrUrl),
      ]);

      return successResponse(
        {
          table: formatDiningTable(result.table, branch.name, result.qr),
          qr: {
            id: result.qr.id,
            isActive: result.qr.is_active,
            rawToken,
            qrUrl,
            qrImage,
            qrSvg,
          },
        },
        201
      );
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A table with number "${validatedData.tableNumber}" already exists in this branch`
        );
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
