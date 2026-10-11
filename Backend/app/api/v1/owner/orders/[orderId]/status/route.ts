import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import {
  updateOrderStatusSchema,
  isValidStatusTransition,
} from '@/lib/validation/owner_order';
import { formatOwnerOrderSummary } from '@/lib/orders/owner_format';
import { successResponse } from '@/lib/http/response';
import {
  handleApiError,
  NotFoundError,
  ConflictError,
} from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    // 3. Parse and validate request body
    const body = await request.json();
    const validatedBody = updateOrderStatusSchema.parse(body);
    const targetStatus = validatedBody.status;

    // 4. Execute atomic status transition with row-level locking
    const updated = await prisma.$transaction(
      async (tx) => {
        // A. Acquire row-level lock on the target order to serialize concurrent updates
        const lockedOrders: any[] = await tx.$queryRaw`
          SELECT id, restaurant_id, branch_id, table_id, status, order_number, completed_at
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
        const currentStatus = currentOrder.status;

        // B. Check optimistic concurrency constraint if expectedCurrentStatus was provided
        if (
          validatedBody.expectedCurrentStatus &&
          validatedBody.expectedCurrentStatus !== currentStatus
        ) {
          throw new ConflictError(
            `Order status conflict: expected "${validatedBody.expectedCurrentStatus}", but order is currently "${currentStatus}". Please refresh.`
          );
        }

        // C. Validate transition according to authoritative state machine
        const transitionCheck = isValidStatusTransition(currentStatus, targetStatus);
        if (!transitionCheck.isValid) {
          throw new ConflictError(
            transitionCheck.reason ||
              `Invalid transition from "${currentStatus}" to "${targetStatus}".`
          );
        }

        const now = new Date();

        // D. Update order status and set completed_at when completing
        const orderUpdateData: any = {
          status: targetStatus,
          updated_at: now,
        };

        if (targetStatus === 'completed') {
          orderUpdateData.completed_at = now;
        }

        await tx.orders.update({
          where: { id: orderId },
          data: orderUpdateData,
        });

        // E. Insert status history record in the same transaction
        await tx.order_status_history.create({
          data: {
            order_id: orderId,
            status: targetStatus,
            notes: validatedBody.notes?.trim() || null,
            changed_at: now,
          },
        });

        // F. Retrieve updated order with relations for sanitized DTO response
        const refreshedOrder = await tx.orders.findUnique({
          where: { id: orderId },
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
        });

        if (!refreshedOrder) {
          throw new NotFoundError('Order not found after update');
        }

        return refreshedOrder;
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 10000,
      }
    );

    return successResponse(formatOwnerOrderSummary(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
