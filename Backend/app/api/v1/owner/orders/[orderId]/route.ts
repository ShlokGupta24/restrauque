import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { formatOwnerOrderDetail } from '@/lib/orders/owner_format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(
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

    // 3. Query order by both orderId AND authenticated restaurantId to guarantee tenant isolation
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        restaurant_id: restaurantId,
      },
      include: {
        branches: {
          select: { id: true, name: true },
        },
        restaurant_tables: {
          select: { id: true, table_number: true, capacity: true },
        },
        customers: {
          select: { id: true, name: true, phone: true },
        },
        order_items: {
          include: {
            order_item_addons: {
              orderBy: { created_at: 'asc' },
            },
          },
          orderBy: { created_at: 'asc' },
        },
        order_coupons: {
          select: {
            coupon_code: true,
            discount_type: true,
            discount_value: true,
            discount_amount: true,
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
            payment_method: true,
            transaction_reference: true,
            paid_at: true,
          },
          orderBy: { created_at: 'desc' },
        },
        order_status_history: {
          select: {
            id: true,
            status: true,
            changed_at: true,
            notes: true,
          },
          orderBy: { changed_at: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // 4. Return sanitized DTO preserving historical snapshots and safe customer identity
    return successResponse(formatOwnerOrderDetail(order));
  } catch (error) {
    return handleApiError(error);
  }
}
