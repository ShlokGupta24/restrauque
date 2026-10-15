import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { createPaymentSchema } from '@/lib/validation/payment';
import { formatPaymentRecord } from '@/lib/payments/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError, ConflictError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/owner/orders/[orderId]/payments
 *
 * Records a staff-confirmed POS payment settlement (cash, UPI, card, other).
 *
 * Guarantees:
 * - Scoped strictly to the authenticated restaurant owner.
 * - Uses parameterized row-level locking on orders (SELECT ... FOR UPDATE) to prevent concurrency races.
 * - Rejects payments on cancelled orders.
 * - Compares submitted amount to authoritative order total_amount with exact Decimal precision.
 * - Enforces at most one 'paid' record per order.
 * - Supports verified idempotent replays when matching non-empty transaction reference, method, and amount.
 * - Rejects unreferenced retries and conflicting submissions with HTTP 409 Conflict.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    validateUuid(orderId, 'orderId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const rawBody = await request.json();
    const validatedBody = createPaymentSchema.parse(rawBody);

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Parameterized row-level lock on target order including orderId and restaurantId
        const lockedOrders: any[] = await tx.$queryRaw`
          SELECT id, restaurant_id, branch_id, status, total_amount, order_number
          FROM orders
          WHERE id = ${orderId}::uuid AND restaurant_id = ${restaurantId}::uuid
          FOR UPDATE
        `;

        if (!lockedOrders || lockedOrders.length === 0) {
          throw new NotFoundError('Order not found');
        }

        const order = lockedOrders[0];

        // 2. Reject payment on cancelled orders
        if (order.status === 'cancelled') {
          throw new ConflictError('Cannot record payment for a cancelled order');
        }

        // 3. Exact decimal comparison of submitted amount vs order total_amount
        const expectedTotalDecimal = new Prisma.Decimal(order.total_amount);
        const submittedAmountDecimal = new Prisma.Decimal(validatedBody.amount);

        if (!expectedTotalDecimal.equals(submittedAmountDecimal)) {
          throw new ConflictError(
            `Payment amount (${submittedAmountDecimal.toFixed(2)}) does not match order total amount (${expectedTotalDecimal.toFixed(2)})`
          );
        }

        // 4. Query existing payments while holding the lock
        const existingPayments = await tx.payments.findMany({
          where: { order_id: orderId },
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        });

        const existingPaid = existingPayments.find((p) => p.status === 'paid');

        if (existingPaid) {
          // Idempotent replay check:
          // Must have matching non-empty transactionReference, matching paymentMethod, and matching amount
          const hasNonEmptyRef =
            Boolean(validatedBody.transactionReference) &&
            validatedBody.transactionReference!.trim().length > 0;

          const isSameRef =
            hasNonEmptyRef &&
            existingPaid.transaction_reference === validatedBody.transactionReference;

          const isSameMethod = existingPaid.payment_method === validatedBody.paymentMethod;

          const existingAmountDecimal = new Prisma.Decimal(existingPaid.amount);
          const isSameAmount = existingAmountDecimal.equals(submittedAmountDecimal);

          if (isSameRef && isSameMethod && isSameAmount) {
            return {
              isReplay: true,
              payment: existingPaid,
            };
          }

          // If already paid and not a verified identical replay, reject with 409 Conflict
          throw new ConflictError(
            'Order has already been paid and settled. Duplicate or conflicting payment submissions are not allowed.'
          );
        }

        // 5. Create new payment record with status 'paid' and server-set paid_at
        const now = new Date();
        const created = await tx.payments.create({
          data: {
            order_id: orderId,
            amount: submittedAmountDecimal,
            payment_method: validatedBody.paymentMethod,
            status: 'paid',
            transaction_reference: validatedBody.transactionReference ?? null,
            paid_at: now,
          },
        });

        return {
          isReplay: false,
          payment: created,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 10000,
      }
    );

    if (result.isReplay) {
      return successResponse(
        {
          payment: formatPaymentRecord(result.payment),
          isReplay: true,
        },
        200
      );
    }

    return successResponse(
      {
        payment: formatPaymentRecord(result.payment),
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/v1/owner/orders/[orderId]/payments
 *
 * Retrieves all payment records for an order.
 * Scoped strictly to the authorized restaurant.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    validateUuid(orderId, 'orderId');

    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    // Verify order exists and belongs to authorized restaurant
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        restaurant_id: restaurantId,
      },
      select: {
        id: true,
        order_number: true,
        status: true,
        total_amount: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Query all payment records for this order ordered deterministically
    const paymentRecords = await prisma.payments.findMany({
      where: { order_id: orderId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });

    const hasPaid = paymentRecords.some((p) => p.status === 'paid');
    const paymentStatus =
      paymentRecords.length === 0 ? 'not_recorded' : hasPaid ? 'paid' : 'pending';

    const orderTotalNum = Number(order.total_amount);

    return successResponse({
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: order.status,
      orderTotalAmount: orderTotalNum,
      orderTotalAmountFormatted: orderTotalNum.toFixed(2),
      paymentStatus,
      payments: paymentRecords.map(formatPaymentRecord),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
