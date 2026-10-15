export type DashboardDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month';

export interface DashboardSalesQueryInput {
  dateFrom?: string;
  dateTo?: string;
  preset?: DashboardDatePreset;
  branchId?: string;
}

export interface DashboardEffectiveRange {
  startDate: Date;
  endDate: Date;
  startDateIso: string;
  endDateIso: string;
  timezone: string;
  preset: DashboardDatePreset | null;
  branchId: string | null;
  restaurantId: string;
}

export interface OrderStatusBreakdown {
  pending: number;
  preparing: number;
  served: number;
  completed: number;
  cancelled: number;
}

export interface PaymentMethodMetric {
  amount: number;
  amountFormatted: string;
  count: number;
}

export interface PaymentMethodBreakdown {
  cash: PaymentMethodMetric;
  upi: PaymentMethodMetric;
  card: PaymentMethodMetric;
  other: PaymentMethodMetric;
}

export interface TopSellingItem {
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  totalRevenueFormatted: string;
}

export interface DailySalesTrend {
  date: string;
  netBilledSales: number;
  netBilledSalesFormatted: string;
  realizedRevenue: number;
  realizedRevenueFormatted: string;
  ordersCount: number;
}

export interface HourlySalesTrend {
  hour: number;
  ordersCount: number;
  netBilledSales: number;
  netBilledSalesFormatted: string;
}

export interface DashboardSalesMetrics {
  grossSales: number;
  grossSalesFormatted: string;
  totalDiscounts: number;
  totalDiscountsFormatted: string;
  totalTax: number;
  totalTaxFormatted: string;
  netBilledSales: number;
  netBilledSalesFormatted: string;
  billedAov: number;
  billedAovFormatted: string;
  totalOrders: number;
  eligibleOrdersCount: number;
  orderStatusBreakdown: OrderStatusBreakdown;
}

export interface AnomalousOrderSettlement {
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  orderTotalFormatted: string;
  paidRecordsCount: number;
  rawPaidAmount: number;
  rawPaidAmountFormatted: string;
  canonicalPaidAmount: number;
  canonicalPaidAmountFormatted: string;
  excessAmount: number;
  excessAmountFormatted: string;
  canonicalPaymentMethod: string;
  canonicalPaidAt: string;
}

export interface DashboardSettlementMetrics {
  /** Headline realized revenue: counts at most one canonical settlement per order */
  realizedRevenue: number;
  realizedRevenueFormatted: string;

  /** Raw recorded paid-payment amount: un-capped sum of all qualifying paid rows for reconciliation */
  rawRecordedPaidAmount: number;
  rawRecordedPaidAmountFormatted: string;

  /** Excess amount from duplicate paid records (rawRecordedPaidAmount - realizedRevenue) */
  duplicateSettlementExcessAmount: number;
  duplicateSettlementExcessAmountFormatted: string;

  /** Distinct count of eligible orders that received a qualifying paid settlement */
  settledOrdersCount: number;

  /** Headline realized AOV (realizedRevenue / settledOrdersCount) */
  realizedAov: number;
  realizedAovFormatted: string;

  /** Non-cancelled orders without qualifying paid settlement */
  unsettledOrdersCount: number;
  unsettledAmount: number;
  unsettledAmountFormatted: string;

  /** Headline payment method breakdown: attributes canonical settlements matching realizedRevenue */
  paymentMethodBreakdown: PaymentMethodBreakdown;

  /** Raw payment method breakdown: attributes all qualifying paid rows matching rawRecordedPaidAmount */
  rawPaymentMethodBreakdown?: PaymentMethodBreakdown;

  /** Flag indicating whether any anomalous orders with multiple paid records exist in the reporting window */
  hasDuplicatePaidRecordsWarning?: boolean;

  /** Count of distinct orders with multiple paid payment records in the reporting window */
  anomalousOrdersCount?: number;

  /** Privacy-safe list of anomalous orders with duplicate settlements */
  anomalousOrders?: AnomalousOrderSettlement[];

  /** Identification of the canonical settlement policy applied */
  duplicateSettlementPolicy?: string;
}

export interface DashboardSalesResponse {
  meta: {
    timezone: string;
    dateFrom: string;
    dateTo: string;
    preset: DashboardDatePreset | null;
    restaurantId: string;
    branchId: string | null;
    orderPeriodTimestampBasis: 'orders.ordered_at';
    settlementPeriodTimestampBasis: 'payments.paid_at';
  };
  sales: DashboardSalesMetrics;
  settlement: DashboardSettlementMetrics;
  topSellingItems: TopSellingItem[];
  dailyTrend: DailySalesTrend[];
  hourlyTrend: HourlySalesTrend[];
}
