import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import {
  handleApiError,
  NotFoundError,
  ConflictError,
} from '@/lib/http/errors';
import { recoverOrderLoyaltyLiability } from '@/lib/loyalty/service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // 1. Authenticate owner and resolve authorized restaurant
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // 2. Validate order identifier
    const { orderId } = await params;
    validateUuid(orderId, 'orderId');

    // 3. Execute atomic recovery inside transaction with row-level locks
    const result = await prisma.$transaction(
      async (tx) => {
        // A. Acquire row-level lock on the target order to verify tenancy and status
        const lockedOrders: any[] = await tx.$queryRaw`
          SELECT id, restaurant_id, status, order_number, customer_id
          FROM orders
          WHERE id = ${orderId}::uuid
          FOR UPDATE
        `;

        if (
          !lockedOrders ||
          lockedOrders.length === 0 ||
          lockedOrders[0].restaurant_id !== restaurantId
        ) {
          throw new NotFoundError('Order not found');
        }

        const currentOrder = lockedOrders[0];

        // B. Enforce that only cancelled orders are eligible for loyalty liability recovery
        if (currentOrder.status !== 'cancelled') {
          throw new ConflictError(
            `Order is in "${currentOrder.status}" status. Loyalty liability recovery can only be performed on cancelled orders.`
          );
        }

        // C. Execute atomic recovery
        return await recoverOrderLoyaltyLiability(tx, {
          orderId,
          orderNumber: currentOrder.order_number,
          restaurantId,
          customerId: currentOrder.customer_id,
        });
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 10000,
      }
    );

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
