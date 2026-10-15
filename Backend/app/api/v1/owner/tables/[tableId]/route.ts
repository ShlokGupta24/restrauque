import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { updateTableSchema } from '@/lib/validation/tables';
import { formatDiningTable } from '@/lib/tables/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

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
          select: { name: true },
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

    return successResponse({
      table: formatDiningTable(table, table.branches?.name, table.qr_codes[0]),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    validateUuid(tableId, 'tableId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const existingTable = await prisma.restaurant_tables.findFirst({
      where: {
        id: tableId,
        branches: {
          restaurant_id: restaurantId,
        },
      },
      include: {
        branches: {
          select: { name: true },
        },
        qr_codes: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!existingTable) {
      throw new NotFoundError('Table not found');
    }

    const rawBody = await request.json();
    const validatedData = updateTableSchema.parse(rawBody);

    // If changing table number, check uniqueness within this branch
    if (
      validatedData.tableNumber &&
      validatedData.tableNumber.toLowerCase() !== existingTable.table_number.toLowerCase()
    ) {
      const duplicate = await prisma.restaurant_tables.findFirst({
        where: {
          branch_id: existingTable.branch_id,
          table_number: { equals: validatedData.tableNumber, mode: 'insensitive' },
          NOT: { id: tableId },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          `A table with number "${validatedData.tableNumber}" already exists in this branch`
        );
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const table = await tx.restaurant_tables.update({
          where: { id: tableId },
          data: {
            ...(validatedData.tableNumber !== undefined ? { table_number: validatedData.tableNumber } : {}),
            ...(validatedData.capacity !== undefined ? { capacity: validatedData.capacity } : {}),
            ...(validatedData.status !== undefined ? { status: validatedData.status } : {}),
            ...(validatedData.isActive !== undefined ? { is_active: validatedData.isActive } : {}),
            updated_at: new Date(),
          },
          include: {
            branches: {
              select: { name: true },
            },
          },
        });

        if (validatedData.isQrActive !== undefined) {
          await tx.qr_codes.updateMany({
            where: { table_id: tableId },
            data: {
              is_active: validatedData.isQrActive,
              updated_at: new Date(),
            },
          });
        }

        const activeQr = await tx.qr_codes.findFirst({
          where: { table_id: tableId, is_active: true },
        });

        return { table, activeQr };
      });

      return successResponse({
        table: formatDiningTable(updated.table, updated.table.branches?.name, updated.activeQr),
      });
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

export async function DELETE(
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
          select: { name: true },
        },
      },
    });

    if (!table) {
      throw new NotFoundError('Table not found');
    }

    // Check if table has historical order records
    const orderCount = await prisma.orders.count({
      where: { table_id: tableId },
    });

    if (orderCount > 0) {
      // Unsafe to physically delete: deactivate and archive
      const deactivated = await prisma.$transaction(async (tx) => {
        const archivedTable = await tx.restaurant_tables.update({
          where: { id: tableId },
          data: {
            is_active: false,
            status: 'maintenance',
            updated_at: new Date(),
          },
          include: {
            branches: {
              select: { name: true },
            },
          },
        });

        await tx.qr_codes.updateMany({
          where: { table_id: tableId },
          data: {
            is_active: false,
            updated_at: new Date(),
          },
        });

        return archivedTable;
      });

      return successResponse({
        deleted: false,
        archived: true,
        table: formatDiningTable(deactivated, deactivated.branches?.name),
        message:
          'Table has historical orders. It has been deactivated and archived instead of permanently deleted to preserve order history.',
      });
    }

    // Safe to permanently delete (cascades qr_codes automatically)
    await prisma.restaurant_tables.delete({
      where: { id: tableId },
    });

    return successResponse({
      deleted: true,
      archived: false,
      message: 'Table deleted successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
