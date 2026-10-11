import { Prisma } from '@prisma/client';
import type {
  OwnerOrderSummary,
  OwnerOrderDetail,
  OwnerOrderItem,
  OwnerOrderItemAddon,
  OwnerOrderCoupon,
  OwnerOrderPaymentDetail,
  OwnerOrderPaymentSummary,
  OwnerOrderStatusHistoryEntry,
  OwnerOrderPricing,
} from '@/types/owner_order';

function parseDecimal(val: unknown): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) return val;
  if (typeof val === 'number' || typeof val === 'string') return new Prisma.Decimal(val);
  return new Prisma.Decimal(0);
}

export function formatOwnerPricing(order: {
  subtotal: unknown;
  discount_amount: unknown;
  tax_amount: unknown;
  total_amount: unknown;
}): OwnerOrderPricing {
  const subtotal = parseDecimal(order.subtotal);
  const discountAmount = parseDecimal(order.discount_amount);
  const taxAmount = parseDecimal(order.tax_amount);
  const totalAmount = parseDecimal(order.total_amount);

  return {
    subtotal: Number(subtotal),
    subtotalFormatted: subtotal.toFixed(2),
    discountAmount: Number(discountAmount),
    discountAmountFormatted: discountAmount.toFixed(2),
    taxAmount: Number(taxAmount),
    taxAmountFormatted: taxAmount.toFixed(2),
    totalAmount: Number(totalAmount),
    totalAmountFormatted: totalAmount.toFixed(2),
    currency: 'INR',
  };
}

export function formatOwnerOrderPaymentSummary(payments?: any[]): OwnerOrderPaymentSummary {
  if (!payments || payments.length === 0) {
    return {
      status: 'not_recorded',
      paymentMethod: null,
      amount: null,
    };
  }

  const primaryPayment = payments[0];
  const normalizedStatus = (primaryPayment.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid';
  const amountDec = primaryPayment.amount ? parseDecimal(primaryPayment.amount) : null;

  return {
    status: normalizedStatus,
    paymentMethod: primaryPayment.payment_method ?? null,
    amount: amountDec ? Number(amountDec) : null,
  };
}

export function formatOwnerOrderPaymentDetail(payments?: any[]): OwnerOrderPaymentDetail {
  if (!payments || payments.length === 0) {
    return {
      id: null,
      status: 'not_recorded',
      paymentMethod: null,
      amount: null,
      transactionReference: null,
      paidAt: null,
    };
  }

  const primaryPayment = payments[0];
  const normalizedStatus = (primaryPayment.status === 'paid' ? 'paid' : 'pending') as 'pending' | 'paid';
  const amountDec = primaryPayment.amount ? parseDecimal(primaryPayment.amount) : null;

  return {
    id: primaryPayment.id,
    status: normalizedStatus,
    paymentMethod: primaryPayment.payment_method ?? null,
    amount: amountDec ? Number(amountDec) : null,
    transactionReference: primaryPayment.transaction_reference ?? null,
    paidAt: primaryPayment.paid_at instanceof Date ? primaryPayment.paid_at.toISOString() : primaryPayment.paid_at ?? null,
  };
}

export function formatOwnerOrderSummary(order: any): OwnerOrderSummary {
  const pricing = formatOwnerPricing(order);
  const payment = formatOwnerOrderPaymentSummary(order.payments);

  return {
    id: order.id,
    orderNumber: order.order_number,
    orderedAt: order.ordered_at instanceof Date ? order.ordered_at.toISOString() : order.ordered_at,
    completedAt: order.completed_at instanceof Date ? order.completed_at.toISOString() : order.completed_at ?? null,
    orderType: order.order_type,
    status: order.status,
    pricing,
    customer: order.customers
      ? {
          id: order.customers.id,
          name: order.customers.name,
          phone: order.customers.phone,
        }
      : null,
    table: order.restaurant_tables
      ? {
          id: order.restaurant_tables.id,
          tableNumber: order.restaurant_tables.table_number,
          capacity: order.restaurant_tables.capacity,
        }
      : null,
    branch: {
      id: order.branches.id,
      name: order.branches.name,
    },
    payment,
    itemsCount: order._count?.order_items ?? (Array.isArray(order.order_items) ? order.order_items.length : 0),
  };
}

export function formatOwnerOrderDetail(order: any): OwnerOrderDetail {
  const pricing = formatOwnerPricing(order);
  const payment = formatOwnerOrderPaymentDetail(order.payments);

  const items: OwnerOrderItem[] = Array.isArray(order.order_items)
    ? order.order_items.map((it: any) => {
        const itemUnit = parseDecimal(it.unit_price);
        const itemTotal = parseDecimal(it.total_price);

        const addons: OwnerOrderItemAddon[] = Array.isArray(it.order_item_addons)
          ? it.order_item_addons.map((a: any) => {
              const aUnit = parseDecimal(a.unit_price);
              const aTotal = parseDecimal(a.total_price);
              return {
                id: a.id,
                productAddonId: a.product_addon_id ?? null,
                addonName: a.addon_name,
                quantity: a.quantity,
                unitPrice: Number(aUnit),
                unitPriceFormatted: aUnit.toFixed(2),
                totalPrice: Number(aTotal),
                totalPriceFormatted: aTotal.toFixed(2),
              };
            })
          : [];

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
          addons,
        };
      })
    : [];

  const appliedCoupon: OwnerOrderCoupon | null =
    Array.isArray(order.order_coupons) && order.order_coupons.length > 0
      ? {
          couponCode: order.order_coupons[0].coupon_code,
          discountType: order.order_coupons[0].discount_type,
          discountValue: Number(parseDecimal(order.order_coupons[0].discount_value)),
          discountAmount: Number(parseDecimal(order.order_coupons[0].discount_amount)),
        }
      : null;

  const statusHistory: OwnerOrderStatusHistoryEntry[] = Array.isArray(order.order_status_history)
    ? order.order_status_history.map((h: any) => ({
        id: h.id,
        status: h.status,
        changedAt: h.changed_at instanceof Date ? h.changed_at.toISOString() : h.changed_at,
        notes: h.notes ?? null,
      }))
    : [];

  return {
    id: order.id,
    orderNumber: order.order_number,
    orderType: order.order_type,
    status: order.status,
    orderedAt: order.ordered_at instanceof Date ? order.ordered_at.toISOString() : order.ordered_at,
    completedAt: order.completed_at instanceof Date ? order.completed_at.toISOString() : order.completed_at ?? null,
    notes: order.notes ?? null,
    branch: {
      id: order.branches.id,
      name: order.branches.name,
    },
    table: order.restaurant_tables
      ? {
          id: order.restaurant_tables.id,
          tableNumber: order.restaurant_tables.table_number,
          capacity: order.restaurant_tables.capacity,
        }
      : null,
    customer: order.customers
      ? {
          id: order.customers.id,
          name: order.customers.name,
          phone: order.customers.phone,
        }
      : null,
    items,
    pricing,
    appliedCoupon,
    payment,
    statusHistory,
  };
}
