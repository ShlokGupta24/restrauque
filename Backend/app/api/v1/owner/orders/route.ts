import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { ownerOrdersQuerySchema } from '@/lib/validation/owner_order';
import { formatOwnerOrderSummary } from '@/lib/orders/owner_format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ForbiddenError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate owner and resolve authorized restaurant
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      branchId: searchParams.get('branchId') || undefined,
      status: searchParams.get('status') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const validatedQuery = ownerOrdersQuerySchema.parse(queryInput);

    // 3. Verify branch belongs to authorized restaurant if branchId is specified
    if (validatedQuery.branchId) {
      const branchBelongsToRestaurant = restContext.branches.some(
        (b) => b.id === validatedQuery.branchId
      );
      if (!branchBelongsToRestaurant) {
        throw new ForbiddenError(
          'Access forbidden: Requested branch does not belong to your authorized restaurant'
        );
      }
    }

    // 4. Construct scoped filter clause
    const where: Prisma.ordersWhereInput = {
      restaurant_id: restaurantId,
    };

    if (validatedQuery.branchId) {
      where.branch_id = validatedQuery.branchId;
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    if (validatedQuery.dateFrom || validatedQuery.dateTo) {
      where.ordered_at = {};
      if (validatedQuery.dateFrom) {
        where.ordered_at.gte = new Date(validatedQuery.dateFrom);
      }
      if (validatedQuery.dateTo) {
        where.ordered_at.lte = new Date(validatedQuery.dateTo);
      }
    }

    if (validatedQuery.search) {
      const term = validatedQuery.search;
      where.OR = [
        { order_number: { contains: term, mode: 'insensitive' } },
        { customers: { name: { contains: term, mode: 'insensitive' } } },
        { customers: { phone: { contains: term } } },
      ];
    }

    if (validatedQuery.paymentStatus) {
      if (validatedQuery.paymentStatus === 'paid') {
        where.payments = { some: { status: 'paid' } };
      } else if (validatedQuery.paymentStatus === 'pending') {
        where.payments = { some: { status: 'pending' } };
      } else if (validatedQuery.paymentStatus === 'not_recorded') {
        where.payments = { none: {} };
      }
    }

    // 5. Calculate pagination
    const page = validatedQuery.page ?? 1;
    const limit = validatedQuery.limit ?? 20;
    const skip = (page - 1) * limit;

    // 6. Scope for summary metrics: covers active venue filter (restaurant + branch + date)
    const summaryScopeWhere: Prisma.ordersWhereInput = {
      restaurant_id: restaurantId,
      ...(validatedQuery.branchId ? { branch_id: validatedQuery.branchId } : {}),
      ...(where.ordered_at ? { ordered_at: where.ordered_at } : {}),
    };

    // 7. Execute parallel queries for paginated records, filtered count, and status aggregates
    const [orders, totalFilteredCount, statusGroups] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: {
          customers: {
            select: { id: true, name: true, phone: true },
          },
          restaurant_tables: {
            select: { id: true, table_number: true, capacity: true },
          },
          branches: {
            select: { id: true, name: true },
          },
          payments: {
            select: { id: true, status: true, amount: true, payment_method: true },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          _count: {
            select: { order_items: true },
          },
        },
        orderBy: [
          { ordered_at: 'desc' },
          { id: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.orders.count({ where }),
      prisma.orders.groupBy({
        by: ['status'],
        where: summaryScopeWhere,
        _count: { id: true },
      }),
    ]);

    // 8. Collate status group counts
    const statusCounts: Record<string, number> = {};
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count.id;
    }

    const totalOrdersInScope = Object.values(statusCounts).reduce((acc, count) => acc + count, 0);
    const completedOrders = statusCounts['completed'] ?? 0;
    const cancelledOrders = statusCounts['cancelled'] ?? 0;
    const pendingOrders = statusCounts['pending'] ?? 0;
    const preparingOrders = statusCounts['preparing'] ?? 0;
    const servedOrders = statusCounts['served'] ?? 0;

    const totalPages = Math.ceil(totalFilteredCount / limit);

    return successResponse({
      orders: orders.map(formatOwnerOrderSummary),
      pagination: {
        page,
        limit,
        totalCount: totalFilteredCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summary: {
        totalOrders: totalOrdersInScope,
        completedOrders,
        cancelledOrders,
        pendingOrders,
        preparingOrders,
        servedOrders,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
