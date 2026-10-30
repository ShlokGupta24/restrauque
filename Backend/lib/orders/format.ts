import { Prisma } from '@prisma/client';
import { AuthoritativePricingResult } from './pricing';

export function formatOrderPreviewResponse(
  pricingResult: AuthoritativePricingResult,
  table: { id: string; table_number: string }
) {
  return {
    isValid: true,
    table: {
      id: table.id,
      tableNumber: table.table_number,
    },
    items: pricingResult.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId,
      variantName: item.variantName,
      unitPrice: Number(item.unitPrice),
      unitPriceFormatted: item.unitPrice.toFixed(2),
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
      totalPriceFormatted: item.totalPrice.toFixed(2),
      specialInstructions: item.specialInstructions,
      addons: item.addons.map((a) => ({
        productAddonId: a.productAddonId,
        addonName: a.addonName,
        unitPrice: Number(a.unitPrice),
        unitPriceFormatted: a.unitPrice.toFixed(2),
        totalPrice: Number(a.totalPrice),
        totalPriceFormatted: a.totalPrice.toFixed(2),
        quantity: a.quantity,
      })),
    })),
    pricing: {
      subtotal: Number(pricingResult.subtotal),
      subtotalFormatted: pricingResult.subtotal.toFixed(2),
      discountAmount: Number(pricingResult.discountAmount),
      discountAmountFormatted: pricingResult.discountAmount.toFixed(2),
      loyaltyDiscountAmount: Number(pricingResult.loyaltyDiscountAmount ?? 0),
      loyaltyDiscountAmountFormatted: (pricingResult.loyaltyDiscountAmount ?? new Prisma.Decimal(0)).toFixed(2),
      pointsRedeemed: pricingResult.pointsRedeemed ?? 0,
      taxAmount: Number(pricingResult.taxAmount),
      taxAmountFormatted: pricingResult.taxAmount.toFixed(2),
      totalAmount: Number(pricingResult.totalAmount),
      totalAmountFormatted: pricingResult.totalAmount.toFixed(2),
      currency: 'INR',
    },
    coupon: pricingResult.couponRecord
      ? {
          code: pricingResult.couponRecord.code,
          discountType: pricingResult.couponRecord.discountType,
        }
      : null,
  };
}

export function formatCustomerOrder(order: any) {
  const subtotal = typeof order.subtotal === 'object' && order.subtotal !== null
    ? new Prisma.Decimal(order.subtotal)
    : new Prisma.Decimal(order.subtotal ?? 0);
  const discountAmount = typeof order.discount_amount === 'object' && order.discount_amount !== null
    ? new Prisma.Decimal(order.discount_amount)
    : new Prisma.Decimal(order.discount_amount ?? 0);
  const loyaltyDiscountAmount = typeof order.loyalty_discount_amount === 'object' && order.loyalty_discount_amount !== null
    ? new Prisma.Decimal(order.loyalty_discount_amount)
    : new Prisma.Decimal(order.loyalty_discount_amount ?? 0);
  const taxAmount = typeof order.tax_amount === 'object' && order.tax_amount !== null
    ? new Prisma.Decimal(order.tax_amount)
    : new Prisma.Decimal(order.tax_amount ?? 0);
  const totalAmount = typeof order.total_amount === 'object' && order.total_amount !== null
    ? new Prisma.Decimal(order.total_amount)
    : new Prisma.Decimal(order.total_amount ?? 0);

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    orderType: order.order_type,
    table: order.restaurant_tables
      ? {
          id: order.restaurant_tables.id,
          tableNumber: order.restaurant_tables.table_number,
        }
      : order.table_id
      ? { id: order.table_id }
      : null,
    branchName: order.branches?.name,
    restaurantName: order.restaurants?.name,
    pricing: {
      subtotal: Number(subtotal),
      subtotalFormatted: subtotal.toFixed(2),
      discountAmount: Number(discountAmount),
      discountAmountFormatted: discountAmount.toFixed(2),
      loyaltyDiscountAmount: Number(loyaltyDiscountAmount),
      loyaltyDiscountAmountFormatted: loyaltyDiscountAmount.toFixed(2),
      taxAmount: Number(taxAmount),
      taxAmountFormatted: taxAmount.toFixed(2),
      totalAmount: Number(totalAmount),
      totalAmountFormatted: totalAmount.toFixed(2),
    },
    notes: order.notes ?? null,
    orderedAt: order.ordered_at instanceof Date ? order.ordered_at.toISOString() : order.ordered_at,
    completedAt: order.completed_at instanceof Date ? order.completed_at.toISOString() : order.completed_at ?? null,
    items: Array.isArray(order.order_items)
      ? order.order_items.map((it: any) => {
          const itemUnit = new Prisma.Decimal(it.unit_price ?? 0);
          const itemTotal = new Prisma.Decimal(it.total_price ?? 0);
          return {
            id: it.id,
            productId: it.product_id,
            productName: it.product_name,
            variantId: it.variant_id ?? null,
            variantName: it.variant_name ?? null,
            quantity: it.quantity,
            unitPrice: Number(itemUnit),
            unitPriceFormatted: itemUnit.toFixed(2),
            totalPrice: Number(itemTotal),
            totalPriceFormatted: itemTotal.toFixed(2),
            specialInstructions: it.special_instructions ?? null,
            addons: Array.isArray(it.order_item_addons)
              ? it.order_item_addons.map((a: any) => {
                  const addonUnit = new Prisma.Decimal(a.unit_price ?? 0);
                  const addonTotal = new Prisma.Decimal(a.total_price ?? 0);
                  return {
                    id: a.id,
                    productAddonId: a.product_addon_id ?? null,
                    addonName: a.addon_name,
                    quantity: a.quantity,
                    unitPrice: Number(addonUnit),
                    unitPriceFormatted: addonUnit.toFixed(2),
                    totalPrice: Number(addonTotal),
                    totalPriceFormatted: addonTotal.toFixed(2),
                  };
                })
              : [],
          };
        })
      : [],
    statusHistory: Array.isArray(order.order_status_history)
      ? order.order_status_history.map((h: any) => ({
          status: h.status,
          notes: h.notes ?? null,
          changedAt: h.changed_at instanceof Date ? h.changed_at.toISOString() : h.changed_at,
        }))
      : [],
  };
}

export function formatCustomerOrderHistoryItem(order: any) {
  const subtotal =
    typeof order.subtotal === 'object' && order.subtotal !== null
      ? new Prisma.Decimal(order.subtotal)
      : new Prisma.Decimal(order.subtotal ?? 0);
  const discountAmount =
    typeof order.discount_amount === 'object' && order.discount_amount !== null
      ? new Prisma.Decimal(order.discount_amount)
      : new Prisma.Decimal(order.discount_amount ?? 0);
  const loyaltyDiscountAmount =
    typeof order.loyalty_discount_amount === 'object' && order.loyalty_discount_amount !== null
      ? new Prisma.Decimal(order.loyalty_discount_amount)
      : new Prisma.Decimal(order.loyalty_discount_amount ?? 0);
  const taxAmount =
    typeof order.tax_amount === 'object' && order.tax_amount !== null
      ? new Prisma.Decimal(order.tax_amount)
      : new Prisma.Decimal(order.tax_amount ?? 0);
  const totalAmount =
    typeof order.total_amount === 'object' && order.total_amount !== null
      ? new Prisma.Decimal(order.total_amount)
      : new Prisma.Decimal(order.total_amount ?? 0);

  // Derive payment status
  let paymentStatus: 'paid' | 'pending' | 'unpaid' = 'unpaid';
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    if (order.payments.some((p: any) => p.status === 'paid')) {
      paymentStatus = 'paid';
    } else if (order.payments.some((p: any) => p.status === 'pending')) {
      paymentStatus = 'pending';
    }
  }

  const items = Array.isArray(order.order_items)
    ? order.order_items.map((it: any) => {
        const itemTotal =
          typeof it.total_price === 'object' && it.total_price !== null
            ? new Prisma.Decimal(it.total_price)
            : new Prisma.Decimal(it.total_price ?? 0);
        return {
          id: it.id,
          productName: it.product_name,
          quantity: it.quantity,
          totalPrice: Number(itemTotal),
          totalPriceFormatted: itemTotal.toFixed(2),
        };
      })
    : [];

  const itemCount = items.reduce(
    (acc: number, it: any) => acc + (typeof it.quantity === 'number' ? it.quantity : 1),
    0
  );

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    orderType: order.order_type,
    restaurant: order.restaurants
      ? {
          id: order.restaurants.id,
          name: order.restaurants.name,
        }
      : null,
    branch: order.branches
      ? {
          id: order.branches.id,
          name: order.branches.name,
        }
      : null,
    table: order.restaurant_tables
      ? {
          id: order.restaurant_tables.id,
          tableNumber: order.restaurant_tables.table_number,
        }
      : order.table_id
      ? { id: order.table_id }
      : null,
    pricing: {
      subtotal: Number(subtotal),
      subtotalFormatted: subtotal.toFixed(2),
      discountAmount: Number(discountAmount),
      discountAmountFormatted: discountAmount.toFixed(2),
      loyaltyDiscountAmount: Number(loyaltyDiscountAmount),
      loyaltyDiscountAmountFormatted: loyaltyDiscountAmount.toFixed(2),
      taxAmount: Number(taxAmount),
      taxAmountFormatted: taxAmount.toFixed(2),
      totalAmount: Number(totalAmount),
      totalAmountFormatted: totalAmount.toFixed(2),
    },
    paymentStatus,
    itemCount,
    itemsSummary: items,
    orderedAt:
      order.ordered_at instanceof Date
        ? order.ordered_at.toISOString()
        : order.ordered_at,
    completedAt:
      order.completed_at instanceof Date
        ? order.completed_at.toISOString()
        : order.completed_at ?? null,
    hasFeedback:
      Array.isArray(order.feedback) && order.feedback.length > 0,
  };
}

