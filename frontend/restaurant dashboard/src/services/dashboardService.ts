import { apiClient } from './apiClient';

export type DashboardDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month';

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

export interface OrderStatusBreakdown {
  pending: number;
  preparing: number;
  served: number;
  completed: number;
  cancelled: number;
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
  realizedRevenue: number;
  realizedRevenueFormatted: string;
  rawRecordedPaidAmount: number;
  rawRecordedPaidAmountFormatted: string;
  duplicateSettlementExcessAmount: number;
  duplicateSettlementExcessAmountFormatted: string;
  settledOrdersCount: number;
  realizedAov: number;
  realizedAovFormatted: string;
  unsettledOrdersCount: number;
  unsettledAmount: number;
  unsettledAmountFormatted: string;
  paymentMethodBreakdown: PaymentMethodBreakdown;
  hasDuplicatePaidRecordsWarning?: boolean;
  anomalousOrdersCount?: number;
  anomalousOrders?: AnomalousOrderSettlement[];
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

export const dashboardService = {
  getSalesDashboard: async (params?: {
    preset?: DashboardDatePreset;
    dateFrom?: string;
    dateTo?: string;
    branchId?: string;
  }): Promise<DashboardSalesResponse> => {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params?.dateTo) query.append('dateTo', params.dateTo);
    if (params?.branchId) query.append('branchId', params.branchId);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<DashboardSalesResponse>(`/api/v1/owner/dashboard/sales${qs}`);
  },
};
