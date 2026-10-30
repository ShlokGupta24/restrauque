import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireCustomer } from '@/lib/auth/guard';
import { createOrderSchema, customerOrdersQuerySchema } from '@/lib/validation/order';
import { resolveQrContext } from '@/lib/qr/resolve';
import {
  calculateAuthoritativePricing,
  computeCanonicalPayloadHash,
} from '@/lib/orders/pricing';
import { generateUniqueOrderNumber } from '@/lib/orders/number';
import { formatCustomerOrder, formatCustomerOrderHistoryItem } from '@/lib/orders/format';
import { encodeOrderCursor, decodeOrderCursor } from '@/lib/orders/cursor';
import { successResponse } from '@/lib/http/response';
import {
  handleApiError,
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate customer
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Parse and validate request payload
    const body = await request.json();
    const validatedInput = createOrderSchema.parse(body);

    // 3. Resolve and verify QR and venue context
    const qrContext = await resolveQrContext(
      validatedInput.qrToken,
      validatedInput.tableId
    );

    const tableId = qrContext.table.id;
    const branchId = qrContext.branch.id;
    const restaurantId = qrContext.restaurant.id;

    const canonicalPayloadHash = computeCanonicalPayloadHash(
      tableId,
      validatedInput.items,
      validatedInput.couponCode,
      validatedInput.notes,
      validatedInput.pointsToRedeem
    );

    // 4. Pre-check persistent idempotency for committed prior retries
    if (validatedInput.idempotencyKey) {
      const existingOrder = await prisma.orders.findFirst({
        where: {
          customer_id: customerId,
          idempotency_key: validatedInput.idempotencyKey,
        },
        include: {
          restaurant_tables: true,
          branches: true,
          restaurants: true,
          order_items: {
            include: { order_item_addons: true },
          },
          order_status_history: {
            orderBy: { changed_at: 'asc' },
          },
        },
      });

      if (existingOrder) {
        // Verify payload hash matches original request
        if (existingOrder.idempotency_payload_hash !== canonicalPayloadHash) {
          throw new ConflictError(
            'The idempotency key was previously used with a different order request payload'
          );
        }

        // Return committed order with idempotent replay header
        return successResponse(formatCustomerOrder(existingOrder), 200, {
          'Idempotent-Replay': 'true',
        });
      }
    }

    // 5. Pre-verify authoritative pricing and check price-drift against client expectation
    const previewPricing = await calculateAuthoritativePricing(
      validatedInput.items,
      restaurantId,
      tableId,
      validatedInput.couponCode,
      validatedInput.notes,
      prisma,
      {
        pointsToRedeem: validatedInput.pointsToRedeem,
        customerId,
      }
    );

    if (
      validatedInput.expectedTotal !== undefined &&
      validatedInput.expectedTotal !== null
    ) {
      const diff = Math.abs(
        Number(previewPricing.totalAmount) - validatedInput.expectedTotal
      );
      if (diff > 0.01) {
        throw new AppError(
          'Menu prices or taxes have changed since preview. Please review your updated cart.',
          409,
          'PRICE_CHANGED',
          {
            expectedTotal: validatedInput.expectedTotal,
            currentTotal: Number(previewPricing.totalAmount),
            pricing: {
              subtotal: Number(previewPricing.subtotal),
              discountAmount: Number(previewPricing.discountAmount),
              loyaltyDiscountAmount: Number(previewPricing.loyaltyDiscountAmount),
              taxAmount: Number(previewPricing.taxAmount),
              totalAmount: Number(previewPricing.totalAmount),
            },
          }
        );
      }
    }

    // 6. Execute atomic transaction with parameterized row locking
    let createdOrderId: string | null = null;
    let isReplayDetected = false;

    try {
      const txResult = await prisma.$transaction(
        async (tx) => {
          // A. Acquire row-level lock on table to serialize concurrent table actions
          const lockedTables: any[] = await tx.$queryRaw`
            SELECT id, branch_id, table_number, capacity, status, is_active
            FROM restaurant_tables
            WHERE id = ${tableId}::uuid
            FOR UPDATE
          `;

          if (!lockedTables || lockedTables.length === 0) {
            throw new NotFoundError('Table not found');
          }

          const tableRow = lockedTables[0];

          if (!tableRow.is_active || tableRow.status === 'maintenance') {
            throw new NotFoundError(
              'This table is currently inactive or under maintenance'
            );
          }

          if (tableRow.status === 'reserved') {
            throw new ConflictError(
              'This table is reserved. Please contact staff to place an order.'
            );
          }

          // B. Idempotency race-condition check inside transaction
          if (validatedInput.idempotencyKey) {
            const inFlightExisting = await tx.orders.findFirst({
              where: {
                customer_id: customerId,
                idempotency_key: validatedInput.idempotencyKey,
              },
              select: { id: true, idempotency_payload_hash: true },
            });

            if (inFlightExisting) {
              if (
                inFlightExisting.idempotency_payload_hash !== canonicalPayloadHash
              ) {
                throw new ConflictError(
                  'The idempotency key was previously used with a different order request payload'
                );
              }
              return { isReplay: true, orderId: inFlightExisting.id };
            }
          }

          // C. Acquire row-level lock on customer loyalty account if points redemption is requested
          let lockedAccountId: string | null = null;
          const pointsToRedeem = validatedInput.pointsToRedeem ?? 0;

          if (pointsToRedeem > 0) {
            const lockedAccounts: any[] = await tx.$queryRaw`
              SELECT id, stars_balance, lifetime_stars_earned, lifetime_stars_redeemed
              FROM customer_loyalty_accounts
              WHERE customer_id = ${customerId}::uuid AND restaurant_id = ${restaurantId}::uuid
              FOR UPDATE
            `;

            if (!lockedAccounts || lockedAccounts.length === 0) {
              throw new ValidationError('Customer loyalty account not found or has no points');
            }

            const currentAccount = lockedAccounts[0];
            if (currentAccount.stars_balance < pointsToRedeem) {
              throw new ValidationError(
                `Insufficient loyalty points: requested ${pointsToRedeem} points but account has ${currentAccount.stars_balance} points`
              );
            }

            lockedAccountId = currentAccount.id;
          }

          // D. Re-calculate authoritative pricing under transaction
          const txPricing = await calculateAuthoritativePricing(
            validatedInput.items,
            restaurantId,
            tableId,
            validatedInput.couponCode,
            validatedInput.notes,
            tx,
            {
              pointsToRedeem: validatedInput.pointsToRedeem,
              customerId,
            }
          );

          // Verify expectedTotal again
          if (
            validatedInput.expectedTotal !== undefined &&
            validatedInput.expectedTotal !== null
          ) {
            const diff = Math.abs(
              Number(txPricing.totalAmount) - validatedInput.expectedTotal
            );
            if (diff > 0.01) {
              throw new AppError(
                'Menu prices or taxes have changed since preview. Please review your updated cart.',
                409,
                'PRICE_CHANGED',
                {
                  expectedTotal: validatedInput.expectedTotal,
                  currentTotal: Number(txPricing.totalAmount),
                  pricing: {
                    subtotal: Number(txPricing.subtotal),
                    discountAmount: Number(txPricing.discountAmount),
                    loyaltyDiscountAmount: Number(txPricing.loyaltyDiscountAmount),
                    taxAmount: Number(txPricing.taxAmount),
                    totalAmount: Number(txPricing.totalAmount),
                  },
                }
              );
            }
          }

          // E. Generate collision-resistant order number
          const orderNumber = await generateUniqueOrderNumber(branchId, tx);

          // F. Insert order row
          const order = await tx.orders.create({
            data: {
              restaurant_id: restaurantId,
              branch_id: branchId,
              table_id: tableId,
              customer_id: customerId,
              order_number: orderNumber,
              order_type: 'dine_in',
              status: 'pending',
              subtotal: txPricing.subtotal,
              discount_amount: txPricing.discountAmount,
              loyalty_discount_amount: txPricing.loyaltyDiscountAmount,
              tax_amount: txPricing.taxAmount,
              total_amount: txPricing.totalAmount,
              notes: validatedInput.notes?.trim() || null,
              idempotency_key: validatedInput.idempotencyKey?.trim() || null,
              idempotency_payload_hash: txPricing.canonicalPayloadHash,
            },
          });

          // F. Insert order items & addon snapshots
          for (const itemSnapshot of txPricing.items) {
            const orderItem = await tx.order_items.create({
              data: {
                order_id: order.id,
                product_id: itemSnapshot.productId,
                variant_id: itemSnapshot.variantId,
                product_name: itemSnapshot.productName,
                variant_name: itemSnapshot.variantName,
                quantity: itemSnapshot.quantity,
                unit_price: itemSnapshot.unitPrice,
                total_price: itemSnapshot.totalPrice,
                special_instructions: itemSnapshot.specialInstructions,
              },
            });

            if (itemSnapshot.addons.length > 0) {
              await tx.order_item_addons.createMany({
                data: itemSnapshot.addons.map((a) => ({
                  order_item_id: orderItem.id,
                  product_addon_id: a.productAddonId,
                  addon_name: a.addonName,
                  quantity: a.quantity,
                  unit_price: a.unitPrice,
                  total_price: a.totalPrice,
                })),
              });
            }
          }

          // G. Record coupon linkage if applied
          if (txPricing.couponRecord) {
            await tx.order_coupons.create({
              data: {
                order_id: order.id,
                coupon_id: txPricing.couponRecord.id,
                coupon_code: txPricing.couponRecord.code,
                discount_type: txPricing.couponRecord.discountType,
                discount_value: txPricing.couponRecord.discountValue,
                discount_amount: txPricing.discountAmount,
              },
            });

            await tx.coupons.update({
              where: { id: txPricing.couponRecord.id },
              data: {
                usage_count: { increment: 1 },
              },
            });
          }

          // H. Deduct loyalty points and persist signed ledger transaction if points redeemed
          if (pointsToRedeem > 0 && lockedAccountId) {
            await tx.loyalty_transactions.create({
              data: {
                loyalty_account_id: lockedAccountId,
                customer_id: customerId,
                restaurant_id: restaurantId,
                order_id: order.id,
                transaction_type: 'redemption',
                stars: -pointsToRedeem,
                description: `Redeemed ${pointsToRedeem} points for dining discount (Order #${orderNumber})`,
              },
            });

            await tx.customer_loyalty_accounts.update({
              where: { id: lockedAccountId },
              data: {
                stars_balance: { decrement: pointsToRedeem },
                lifetime_stars_redeemed: { increment: pointsToRedeem },
                updated_at: new Date(),
              },
            });
          }

          // I. Insert initial order status history
          await tx.order_status_history.create({
            data: {
              order_id: order.id,
              status: 'pending',
              notes: 'Customer placed dine-in order',
            },
          });

          // J. Update table status from available to occupied atomically
          if (tableRow.status === 'available') {
            await tx.restaurant_tables.update({
              where: { id: tableId },
              data: { status: 'occupied' },
            });
          }

          return { isReplay: false, orderId: order.id };
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 10000,
        }
      );

      createdOrderId = txResult.orderId;
      isReplayDetected = txResult.isReplay;
    } catch (txError: any) {
      // Handle unique constraint collision on idempotency key under concurrency
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === 'P2002' &&
        validatedInput.idempotencyKey
      ) {
        const raceCommitted = await prisma.orders.findFirst({
          where: {
            customer_id: customerId,
            idempotency_key: validatedInput.idempotencyKey,
          },
          include: {
            restaurant_tables: true,
            branches: true,
            restaurants: true,
            order_items: {
              include: { order_item_addons: true },
            },
            order_status_history: {
              orderBy: { changed_at: 'asc' },
            },
          },
        });

        if (raceCommitted) {
          if (raceCommitted.idempotency_payload_hash !== canonicalPayloadHash) {
            throw new ConflictError(
              'The idempotency key was previously used with a different order request payload'
            );
          }

          return successResponse(formatCustomerOrder(raceCommitted), 200, {
            'Idempotent-Replay': 'true',
          });
        }
      }

      throw txError;
    }

    // 7. Retrieve full committed order and return sanitized response
    const finalOrder = await prisma.orders.findUnique({
      where: { id: createdOrderId! },
      include: {
        restaurant_tables: true,
        branches: true,
        restaurants: true,
        order_items: {
          include: { order_item_addons: true },
        },
        order_status_history: {
          orderBy: { changed_at: 'asc' },
        },
      },
    });

    if (!finalOrder) {
      throw new NotFoundError('Order not found after creation');
    }

    const formattedOrder = formatCustomerOrder(finalOrder);

    if (isReplayDetected) {
      return successResponse(formattedOrder, 200, {
        'Idempotent-Replay': 'true',
      });
    }

    return successResponse(formattedOrder, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate customer - customerId derived strictly from session
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = {
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      status: searchParams.get('status') || undefined,
      feedbackStatus: searchParams.get('feedbackStatus') || undefined,
      restaurantId: searchParams.get('restaurantId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    };

    const validatedQuery = customerOrdersQuerySchema.parse(queryInput);

    // 3. Construct customer-scoped filter clause
    const where: Prisma.ordersWhereInput = {
      customer_id: customerId,
    };

    if (validatedQuery.restaurantId) {
      where.restaurant_id = validatedQuery.restaurantId;
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    if (validatedQuery.feedbackStatus === 'awaiting_review') {
      where.status = 'completed';
      where.feedback = { none: {} };
    } else if (validatedQuery.feedbackStatus === 'reviewed') {
      where.feedback = { some: {} };
    }

    if (validatedQuery.dateFrom || validatedQuery.dateTo) {
      where.ordered_at = {};
      if (validatedQuery.dateFrom) {
        where.ordered_at.gte = new Date(validatedQuery.dateFrom);
      }
      if (validatedQuery.dateTo) {
        let toDate = new Date(validatedQuery.dateTo);
        if (/^\d{4}-\d{2}-\d{2}$/.test(validatedQuery.dateTo.trim())) {
          toDate = new Date(`${validatedQuery.dateTo.trim()}T23:59:59.999Z`);
        }
        where.ordered_at.lte = toDate;
      }
    }

    // 4. Handle cursor pagination anchor if provided
    if (validatedQuery.cursor) {
      const decodedCursorId = decodeOrderCursor(validatedQuery.cursor);
      if (!decodedCursorId) {
        throw new ValidationError('Invalid cursor: malformed cursor string');
      }

      // Verify the cursor order exists and belongs to THIS authenticated customer
      const cursorOrder = await prisma.orders.findFirst({
        where: {
          id: decodedCursorId,
          customer_id: customerId, // Enforces customer tenant isolation
        },
        select: {
          id: true,
          ordered_at: true,
        },
      });

      if (!cursorOrder) {
        throw new ValidationError(
          'Invalid cursor: referenced order does not exist or does not belong to you'
        );
      }

      // Tie-breaker keyset condition: (ordered_at < cursorOrder.ordered_at) OR (ordered_at = cursorOrder.ordered_at AND id < cursorOrder.id)
      const cursorCondition: Prisma.ordersWhereInput = {
        OR: [
          {
            ordered_at: {
              lt: cursorOrder.ordered_at,
            },
          },
          {
            ordered_at: cursorOrder.ordered_at,
            id: {
              lt: cursorOrder.id,
            },
          },
        ],
      };

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          where.AND.push(cursorCondition);
        } else {
          where.AND = [where.AND, cursorCondition];
        }
      } else {
        where.AND = [cursorCondition];
      }
    }

    const limit = validatedQuery.limit ?? 10;

    // 5. Query orders and summary aggregates in parallel
    const [orders, statusGroups] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: {
          restaurants: {
            select: { id: true, name: true },
          },
          branches: {
            select: { id: true, name: true },
          },
          restaurant_tables: {
            select: { id: true, table_number: true },
          },
          payments: {
            select: { id: true, status: true, amount: true, payment_method: true },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          },
          order_items: {
            select: {
              id: true,
              product_name: true,
              quantity: true,
              total_price: true,
            },
            orderBy: { id: 'asc' },
          },
          feedback: {
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [
          { ordered_at: 'desc' },
          { id: 'desc' },
        ],
        take: limit + 1,
      }),
      prisma.orders.groupBy({
        by: ['status'],
        where: { customer_id: customerId },
        _count: { id: true },
      }),
    ]);

    // 6. Calculate pagination metadata
    const hasNextPage = orders.length > limit;
    const pagedOrders = hasNextPage ? orders.slice(0, limit) : orders;
    const lastOrder = pagedOrders[pagedOrders.length - 1];
    const nextCursor =
      hasNextPage && lastOrder
        ? encodeOrderCursor(lastOrder.id, lastOrder.ordered_at)
        : null;

    // 7. Calculate customer lifetime status summary
    const statusCounts: Record<string, number> = {
      pending: 0,
      preparing: 0,
      served: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const group of statusGroups) {
      if (group.status in statusCounts) {
        statusCounts[group.status] = group._count.id;
      }
    }

    const totalOrders = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return successResponse({
      orders: pagedOrders.map(formatCustomerOrderHistoryItem),
      pagination: {
        limit,
        hasNextPage,
        nextCursor,
      },
      summary: {
        totalOrders,
        pending: statusCounts.pending,
        preparing: statusCounts.preparing,
        served: statusCounts.served,
        completed: statusCounts.completed,
        cancelled: statusCounts.cancelled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

