import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireCustomer } from '@/lib/auth/guard';
import { createOrderSchema } from '@/lib/validation/order';
import { resolveQrContext } from '@/lib/qr/resolve';
import {
  calculateAuthoritativePricing,
  computeCanonicalPayloadHash,
} from '@/lib/orders/pricing';
import { generateUniqueOrderNumber } from '@/lib/orders/number';
import { formatCustomerOrder } from '@/lib/orders/format';
import { successResponse } from '@/lib/http/response';
import {
  handleApiError,
  AppError,
  ConflictError,
  NotFoundError,
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
      validatedInput.notes
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
      validatedInput.notes
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

          // C. Re-calculate authoritative pricing under transaction
          const txPricing = await calculateAuthoritativePricing(
            validatedInput.items,
            restaurantId,
            tableId,
            validatedInput.couponCode,
            validatedInput.notes,
            tx
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
                    taxAmount: Number(txPricing.taxAmount),
                    totalAmount: Number(txPricing.totalAmount),
                  },
                }
              );
            }
          }

          // D. Generate collision-resistant order number
          const orderNumber = await generateUniqueOrderNumber(branchId, tx);

          // E. Insert order row
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

          // H. Insert initial order status history
          await tx.order_status_history.create({
            data: {
              order_id: order.id,
              status: 'pending',
              notes: 'Customer placed dine-in order',
            },
          });

          // I. Update table status from available to occupied atomically
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
