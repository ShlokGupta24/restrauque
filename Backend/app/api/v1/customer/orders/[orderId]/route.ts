import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCustomer } from '@/lib/auth/guard';
import { formatCustomerOrder } from '@/lib/orders/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // 1. Authenticate customer
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Validate orderId format
    const { orderId } = await params;
    if (!orderId || !UUID_REGEX.test(orderId)) {
      throw new NotFoundError('Order not found');
    }

    // 3. Query order by both orderId AND authenticated customerId to enforce tenant isolation
    const order = await prisma.orders.findFirst({
      where: {
        id: orderId,
        customer_id: customerId,
      },
      include: {
        restaurant_tables: true,
        branches: true,
        restaurants: true,
        order_items: {
          include: {
            order_item_addons: true,
          },
        },
        order_status_history: {
          orderBy: { changed_at: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // 4. Return sanitized customer-facing order representation
    return successResponse(formatCustomerOrder(order));
  } catch (error) {
    return handleApiError(error);
  }
}
