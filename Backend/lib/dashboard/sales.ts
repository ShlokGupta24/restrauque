import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import {
  DashboardEffectiveRange,
  DashboardSalesMetrics,
  DashboardSettlementMetrics,
  OrderStatusBreakdown,
  PaymentMethodBreakdown,
  TopSellingItem,
  DailySalesTrend,
  HourlySalesTrend,
  DashboardSalesResponse,
  AnomalousOrderSettlement,
} from '@/types/dashboard';
import { getZonedDateParts } from '@/lib/dashboard/timezone';

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Computes all POS sales, settlement, top items, and trend metrics
 * for the specified restaurant, optional branch, and effective date range.
 *
 * Guarantees:
 * - Scoped strictly to the authorized restaurantId (and branchId if supplied).
 * - Avoids Cartesian join multiplication by querying orders, payments, and order_items independently.
 * - Excludes cancelled orders from gross sales, net billed sales, tax, discounts, and realized revenue.
 * - Distinguishes order-period sales (orders.ordered_at) from settlement inflows (payments.paid_at).
 * - Uses immutable historical snapshot names and prices from order_items.
 * - Detects and flags duplicate paid records per order if present in historical data.
 * - Returns zero-safe numeric values and empty arrays when no orders exist.
 */
export async function getDashboardSalesData(
  range: DashboardEffectiveRange
): Promise<DashboardSalesResponse> {
  const { restaurantId, branchId, startDate, endDate, timezone, preset, startDateIso, endDateIso } =
    range;

  // 1. Order-period filter scopes (accrual basis: orders.ordered_at)
  const orderBaseWhere: Prisma.ordersWhereInput = {
    restaurant_id: restaurantId,
    ...(branchId ? { branch_id: branchId } : {}),
    ordered_at: {
      gte: startDate,
      lte: endDate,
    },
  };

  const eligibleOrdersWhere: Prisma.ordersWhereInput = {
    ...orderBaseWhere,
    status: { not: 'cancelled' },
  };

  // 2. Settlement-period filter scope (cash basis: payments.paid_at)
  const paymentBaseWhere: Prisma.paymentsWhereInput = {
    orders: {
      restaurant_id: restaurantId,
      ...(branchId ? { branch_id: branchId } : {}),
      status: { not: 'cancelled' }, // Exclude payments attached to cancelled orders
    },
    status: 'paid', // Qualifying successfully paid settlements
    paid_at: {
      gte: startDate,
      lte: endDate,
    },
  };

  // 3. Execute database aggregations in parallel
  const [
    statusGroups,
    billedAggregates,
    unsettledAggregates,
    topItemGroups,
    ordersForTrends,
    qualifyingPayments,
  ] = await Promise.all([
    // A. Order Status Breakdown
    prisma.orders.groupBy({
      by: ['status'],
      where: orderBaseWhere,
      _count: { id: true },
    }),

    // B. Billed Sales Aggregation (Non-cancelled orders)
    prisma.orders.aggregate({
      where: eligibleOrdersWhere,
      _sum: {
        subtotal: true,
        discount_amount: true,
        tax_amount: true,
        total_amount: true,
      },
      _count: { id: true },
    }),

    // C. Unsettled Orders Aggregation (Non-cancelled orders without qualifying paid settlement)
    prisma.orders.aggregate({
      where: {
        ...eligibleOrdersWhere,
        payments: {
          none: {
            status: 'paid',
          },
        },
      },
      _sum: {
        total_amount: true,
      },
      _count: { id: true },
    }),

    // D. Top Selling Items (Using historical snapshot line-item totals)
    prisma.order_items.groupBy({
      by: ['product_name'],
      where: {
        orders: eligibleOrdersWhere,
      },
      _sum: {
        quantity: true,
        total_price: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 10,
    }),

    // E. Orders for Hourly & Daily Trends
    prisma.orders.findMany({
      where: eligibleOrdersWhere,
      select: {
        ordered_at: true,
        total_amount: true,
      },
      orderBy: {
        ordered_at: 'asc',
      },
    }),

    // F. Qualifying Paid Payments (Full details for duplicate detection & canonical attribution)
    prisma.payments.findMany({
      where: paymentBaseWhere,
      select: {
        id: true,
        order_id: true,
        amount: true,
        payment_method: true,
        paid_at: true,
        created_at: true,
        orders: {
          select: {
            id: true,
            order_number: true,
            total_amount: true,
          },
        },
      },
      orderBy: [
        { paid_at: 'asc' },
        { created_at: 'asc' },
        { id: 'asc' },
      ],
    }),
  ]);

  // --- Process 4. Order and Billed-Sales Metrics ---
  const orderStatusBreakdown: OrderStatusBreakdown = {
    pending: 0,
    preparing: 0,
    served: 0,
    completed: 0,
    cancelled: 0,
  };

  let totalOrdersCount = 0;
  for (const group of statusGroups) {
    if (group.status in orderStatusBreakdown) {
      orderStatusBreakdown[group.status as keyof OrderStatusBreakdown] = group._count.id;
    }
    totalOrdersCount += group._count.id;
  }

  const grossSales = round2(Number(billedAggregates._sum.subtotal ?? 0));
  const totalDiscounts = round2(Number(billedAggregates._sum.discount_amount ?? 0));
  const totalTax = round2(Number(billedAggregates._sum.tax_amount ?? 0));
  const netBilledSales = round2(Number(billedAggregates._sum.total_amount ?? 0));
  const eligibleOrdersCount = billedAggregates._count.id;

  const billedAov =
    eligibleOrdersCount > 0 ? round2(netBilledSales / eligibleOrdersCount) : 0;

  const salesMetrics: DashboardSalesMetrics = {
    grossSales,
    grossSalesFormatted: grossSales.toFixed(2),
    totalDiscounts,
    totalDiscountsFormatted: totalDiscounts.toFixed(2),
    totalTax,
    totalTaxFormatted: totalTax.toFixed(2),
    netBilledSales,
    netBilledSalesFormatted: netBilledSales.toFixed(2),
    billedAov,
    billedAovFormatted: billedAov.toFixed(2),
    totalOrders: totalOrdersCount,
    eligibleOrdersCount,
    orderStatusBreakdown,
  };

  // --- Process 5. Settlement Metrics & Duplicate Settlement Policy ---
  // A. Group qualifying payments by order_id
  const paymentsByOrder = new Map<string, typeof qualifyingPayments>();
  for (const pay of qualifyingPayments) {
    const list = paymentsByOrder.get(pay.order_id) || [];
    list.push(pay);
    paymentsByOrder.set(pay.order_id, list);
  }

  // B. Initialize raw payment method breakdown and total raw recorded amount
  const rawPaymentMethodBreakdown: PaymentMethodBreakdown = {
    cash: { amount: 0, amountFormatted: '0.00', count: 0 },
    upi: { amount: 0, amountFormatted: '0.00', count: 0 },
    card: { amount: 0, amountFormatted: '0.00', count: 0 },
    other: { amount: 0, amountFormatted: '0.00', count: 0 },
  };

  let rawRecordedPaidAmount = 0;
  for (const pay of qualifyingPayments) {
    const amt = round2(Number(pay.amount));
    rawRecordedPaidAmount = round2(rawRecordedPaidAmount + amt);
    const method = pay.payment_method as keyof PaymentMethodBreakdown;
    if (method in rawPaymentMethodBreakdown) {
      rawPaymentMethodBreakdown[method].amount = round2(
        rawPaymentMethodBreakdown[method].amount + amt
      );
      rawPaymentMethodBreakdown[method].count += 1;
      rawPaymentMethodBreakdown[method].amountFormatted =
        rawPaymentMethodBreakdown[method].amount.toFixed(2);
    } else {
      rawPaymentMethodBreakdown.other.amount = round2(
        rawPaymentMethodBreakdown.other.amount + amt
      );
      rawPaymentMethodBreakdown.other.count += 1;
      rawPaymentMethodBreakdown.other.amountFormatted =
        rawPaymentMethodBreakdown.other.amount.toFixed(2);
    }
  }

  // C. Select canonical full settlement per order and record anomalous duplicate settlements
  const canonicalPayments: (typeof qualifyingPayments[0])[] = [];
  const anomalousOrders: AnomalousOrderSettlement[] = [];

  for (const [orderId, pays] of paymentsByOrder.entries()) {
    if (pays.length === 1) {
      // Standard single settlement: exactly one qualifying paid record
      canonicalPayments.push(pays[0]);
    } else {
      // Anomalous order with multiple paid records!
      // Canonical selection policy:
      // 1. Exact match with orders.total_amount first (standard POS full settlement requirement).
      // 2. Earliest settlement timestamp (paid_at ascending).
      // 3. Earliest creation timestamp (created_at ascending).
      // 4. Deterministic tie-breaker: lexical order of payment ID.
      const orderTotal = Number(pays[0].orders.total_amount);
      const sorted = [...pays].sort((a, b) => {
        const aExact = Math.abs(Number(a.amount) - orderTotal) < 0.001 ? 1 : 0;
        const bExact = Math.abs(Number(b.amount) - orderTotal) < 0.001 ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const aPaidTime = a.paid_at ? a.paid_at.getTime() : a.created_at.getTime();
        const bPaidTime = b.paid_at ? b.paid_at.getTime() : b.created_at.getTime();
        if (aPaidTime !== bPaidTime) return aPaidTime - bPaidTime;

        if (a.created_at.getTime() !== b.created_at.getTime()) {
          return a.created_at.getTime() - b.created_at.getTime();
        }

        return a.id.localeCompare(b.id);
      });

      const canonical = sorted[0];
      canonicalPayments.push(canonical);

      const rawOrderPaid = round2(pays.reduce((acc, p) => acc + Number(p.amount), 0));
      const canonicalPaid = round2(Number(canonical.amount));
      const excess = round2(rawOrderPaid - canonicalPaid);

      anomalousOrders.push({
        orderId,
        orderNumber: pays[0].orders.order_number,
        orderTotal: round2(orderTotal),
        orderTotalFormatted: round2(orderTotal).toFixed(2),
        paidRecordsCount: pays.length,
        rawPaidAmount: rawOrderPaid,
        rawPaidAmountFormatted: rawOrderPaid.toFixed(2),
        canonicalPaidAmount: canonicalPaid,
        canonicalPaidAmountFormatted: canonicalPaid.toFixed(2),
        excessAmount: excess,
        excessAmountFormatted: excess.toFixed(2),
        canonicalPaymentMethod: canonical.payment_method,
        canonicalPaidAt: canonical.paid_at
          ? canonical.paid_at.toISOString()
          : canonical.created_at.toISOString(),
      });
    }
  }

  // D. Compute headline realized revenue & headline payment method breakdown from canonical settlements
  const headlinePaymentMethodBreakdown: PaymentMethodBreakdown = {
    cash: { amount: 0, amountFormatted: '0.00', count: 0 },
    upi: { amount: 0, amountFormatted: '0.00', count: 0 },
    card: { amount: 0, amountFormatted: '0.00', count: 0 },
    other: { amount: 0, amountFormatted: '0.00', count: 0 },
  };

  let realizedRevenue = 0;
  for (const can of canonicalPayments) {
    const amt = round2(Number(can.amount));
    realizedRevenue = round2(realizedRevenue + amt);

    const method = can.payment_method as keyof PaymentMethodBreakdown;
    if (method in headlinePaymentMethodBreakdown) {
      headlinePaymentMethodBreakdown[method].amount = round2(
        headlinePaymentMethodBreakdown[method].amount + amt
      );
      headlinePaymentMethodBreakdown[method].count += 1;
      headlinePaymentMethodBreakdown[method].amountFormatted =
        headlinePaymentMethodBreakdown[method].amount.toFixed(2);
    } else {
      headlinePaymentMethodBreakdown.other.amount = round2(
        headlinePaymentMethodBreakdown.other.amount + amt
      );
      headlinePaymentMethodBreakdown.other.count += 1;
      headlinePaymentMethodBreakdown.other.amountFormatted =
        headlinePaymentMethodBreakdown.other.amount.toFixed(2);
    }
  }

  const settledOrdersCount = paymentsByOrder.size;
  const duplicateSettlementExcessAmount = round2(rawRecordedPaidAmount - realizedRevenue);
  const hasDuplicatePaidRecordsWarning = anomalousOrders.length > 0;

  const realizedAov =
    settledOrdersCount > 0 ? round2(realizedRevenue / settledOrdersCount) : 0;

  const unsettledOrdersCount = unsettledAggregates._count.id;
  const unsettledAmount = round2(Number(unsettledAggregates._sum.total_amount ?? 0));

  const settlementMetrics: DashboardSettlementMetrics = {
    realizedRevenue,
    realizedRevenueFormatted: realizedRevenue.toFixed(2),
    rawRecordedPaidAmount,
    rawRecordedPaidAmountFormatted: rawRecordedPaidAmount.toFixed(2),
    duplicateSettlementExcessAmount,
    duplicateSettlementExcessAmountFormatted: duplicateSettlementExcessAmount.toFixed(2),
    settledOrdersCount,
    realizedAov,
    realizedAovFormatted: realizedAov.toFixed(2),
    unsettledOrdersCount,
    unsettledAmount,
    unsettledAmountFormatted: unsettledAmount.toFixed(2),
    paymentMethodBreakdown: headlinePaymentMethodBreakdown,
    rawPaymentMethodBreakdown,
    hasDuplicatePaidRecordsWarning,
    anomalousOrdersCount: anomalousOrders.length,
    anomalousOrders,
    duplicateSettlementPolicy: 'FIRST_CANONICAL_FULL_SETTLEMENT',
  };

  // --- Process 6. Top Selling Items ---
  const topSellingItems: TopSellingItem[] = topItemGroups.map((g) => {
    const rev = round2(Number(g._sum.total_price ?? 0));
    return {
      productName: g.product_name,
      quantitySold: g._sum.quantity ?? 0,
      totalRevenue: rev,
      totalRevenueFormatted: rev.toFixed(2),
    };
  });

  // --- Process 7. Hourly Trend (0 to 23 in Café Timezone) ---
  const hourlyBuckets: { [hour: number]: { count: number; sales: number } } = {};
  for (let h = 0; h < 24; h++) {
    hourlyBuckets[h] = { count: 0, sales: 0 };
  }

  const hourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  });

  for (const order of ordersForTrends) {
    const hourStr = hourFormatter.format(order.ordered_at);
    const hourNum = parseInt(hourStr, 10);
    const amt = Number(order.total_amount);

    if (hourNum >= 0 && hourNum <= 23) {
      hourlyBuckets[hourNum].count += 1;
      hourlyBuckets[hourNum].sales = round2(hourlyBuckets[hourNum].sales + amt);
    }
  }

  const hourlyTrend: HourlySalesTrend[] = [];
  for (let h = 0; h < 24; h++) {
    hourlyTrend.push({
      hour: h,
      ordersCount: hourlyBuckets[h].count,
      netBilledSales: hourlyBuckets[h].sales,
      netBilledSalesFormatted: hourlyBuckets[h].sales.toFixed(2),
    });
  }

  // --- Process 8. Daily Trend ---
  const dailyMap: {
    [dateKey: string]: { netBilledSales: number; realizedRevenue: number; ordersCount: number };
  } = {};

  for (const order of ordersForTrends) {
    const dateKey = getZonedDateParts(order.ordered_at, timezone).dateStr;
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { netBilledSales: 0, realizedRevenue: 0, ordersCount: 0 };
    }
    dailyMap[dateKey].ordersCount += 1;
    dailyMap[dateKey].netBilledSales = round2(
      dailyMap[dateKey].netBilledSales + Number(order.total_amount)
    );
  }

  // Consistent with headline realized revenue: attribute canonical settlement payments to daily trend
  for (const pay of canonicalPayments) {
    if (pay.paid_at) {
      const dateKey = getZonedDateParts(pay.paid_at, timezone).dateStr;
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { netBilledSales: 0, realizedRevenue: 0, ordersCount: 0 };
      }
      dailyMap[dateKey].realizedRevenue = round2(
        dailyMap[dateKey].realizedRevenue + Number(pay.amount)
      );
    }
  }

  const sortedDates = Object.keys(dailyMap).sort();
  const dailyTrend: DailySalesTrend[] = sortedDates.map((dateStr) => {
    const entry = dailyMap[dateStr];
    return {
      date: dateStr,
      netBilledSales: entry.netBilledSales,
      netBilledSalesFormatted: entry.netBilledSales.toFixed(2),
      realizedRevenue: entry.realizedRevenue,
      realizedRevenueFormatted: entry.realizedRevenue.toFixed(2),
      ordersCount: entry.ordersCount,
    };
  });

  return {
    meta: {
      timezone,
      dateFrom: startDateIso,
      dateTo: endDateIso,
      preset,
      restaurantId,
      branchId,
      orderPeriodTimestampBasis: 'orders.ordered_at',
      settlementPeriodTimestampBasis: 'payments.paid_at',
    },
    sales: salesMetrics,
    settlement: settlementMetrics,
    topSellingItems,
    dailyTrend,
    hourlyTrend,
  };
}
