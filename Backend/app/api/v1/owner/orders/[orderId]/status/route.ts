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
import {
  createOrderCompletionNotificationIntent,
  dispatchOrderCompletionNotifications,
} from '@/lib/notifications/service';
import {
  awardOrderSpendLoyaltyReward,
  reverseOrderLoyaltyOnCancellation,
} from '@/lib/loyalty/service';

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
          SELECT id, restaurant_id, branch_id, table_id, status, order_number, completed_at, customer_id, subtotal, discount_amount
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

        // F. If transitioning to completed, create durable notification intent and award spend loyalty points
        if (targetStatus === 'completed' && currentStatus !== 'completed') {
          const orderCustomer = await tx.orders.findUnique({
            where: { id: orderId },
            select: {
              customer_id: true,
              subtotal: true,
              discount_amount: true,
              customers: { select: { id: true, name: true, phone: true } },
              restaurants: { select: { id: true, name: true } },
            },
          });

          if (orderCustomer?.customers) {
            await createOrderCompletionNotificationIntent(tx, {
              orderId,
              orderNumber: currentOrder.order_number,
              restaurantId: orderCustomer.restaurants.id,
              restaurantName: orderCustomer.restaurants.name,
              customerId: orderCustomer.customers.id,
              customerName: orderCustomer.customers.name,
              customerPhone: orderCustomer.customers.phone,
              customerEmail: (orderCustomer.customers as any).email || null,
            });
          }

          const targetCustomerId = orderCustomer?.customer_id || currentOrder.customer_id;
          if (targetCustomerId) {
            await awardOrderSpendLoyaltyReward(tx, {
              orderId,
              orderNumber: currentOrder.order_number,
              restaurantId: orderCustomer?.restaurants?.id || restaurantId,
              customerId: targetCustomerId,
              subtotal: orderCustomer?.subtotal ?? currentOrder.subtotal ?? 0,
              discountAmount: orderCustomer?.discount_amount ?? currentOrder.discount_amount ?? 0,
            });
          }
        }

        // G. If transitioning to cancelled, restore redeemed points and reverse spend loyalty points atomically
        if (targetStatus === 'cancelled' && currentStatus !== 'cancelled') {
          const targetCustomerId = currentOrder.customer_id;
          if (targetCustomerId) {
            await reverseOrderLoyaltyOnCancellation(tx, {
              orderId,
              orderNumber: currentOrder.order_number,
              restaurantId: currentOrder.restaurant_id || restaurantId,
              customerId: targetCustomerId,
            });
          } else {
            await tx.orders.update({
              where: { id: orderId },
              data: { unrecovered_loyalty_points: 0 },
            });
          }
        }

        // H. Retrieve updated order with relations for sanitized DTO response
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

    // 5. Trigger notification dispatch outside the database transaction
    if (targetStatus === 'completed') {
      try {
        await dispatchOrderCompletionNotifications(orderId);
      } catch (dispatchErr) {
        console.error('[POST_COMMIT_NOTIFICATION_DISPATCH_ERROR]', dispatchErr);
      }
    }

    return successResponse(formatOwnerOrderSummary(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
