export interface AnalyticsDailyRevenue {
  day: string;
  dateStr: string;
  revenue: number;
}

export interface AnalyticsTopProduct {
  name: string;
  revenue: number;
  revenueFormatted: string;
  percentage: number;
}

export interface OrderSourceType {
  typeName: string;
  percentage: number;
  orderCount: number;
}

export interface SchemaCoverageItem {
  id: string;
  badge: 'Schema' | 'Needed';
  title: string;
  description: string;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalRevenueFormatted: string;
  revenueChangePct: string;
  completedOrders: number;
  completedOrdersChangePct: string;
  averageOrderValue: number;
  averageOrderValueFormatted: string;
  aovChangePct: string;
  returningCustomers: number;
  timeframeLabel: string;
  dailyRevenue: AnalyticsDailyRevenue[];
  topProducts: AnalyticsTopProduct[];
  orderSources: OrderSourceType[];
  schemaCoverage: SchemaCoverageItem[];
}

export const ANALYTICS_DATA: AnalyticsSummary = {
  totalRevenue: 142850,
  totalRevenueFormatted: '₹1,42,850',
  revenueChangePct: '+12.8%',
  completedOrders: 1058,
  completedOrdersChangePct: '+8.4%',
  averageOrderValue: 135,
  averageOrderValueFormatted: '₹135',
  aovChangePct: '+3.2%',
  returningCustomers: 365,
  timeframeLabel: '01–07 Oct 2026 · Hazratganj · Demo INR/timezone; formatting is configurable.',
  dailyRevenue: [
    { day: 'Mon', dateStr: '01 Oct', revenue: 11200 },
    { day: 'Tue', dateStr: '02 Oct', revenue: 14800 },
    { day: 'Wed', dateStr: '03 Oct', revenue: 12600 },
    { day: 'Thu', dateStr: '04 Oct', revenue: 19400 },
    { day: 'Fri', dateStr: '05 Oct', revenue: 16750 },
    { day: 'Sat', dateStr: '06 Oct', revenue: 26500 },
    { day: 'Sun', dateStr: '07 Oct', revenue: 28800 },
  ],
  topProducts: [
    {
      name: 'Paneer Tikka Wrap',
      revenue: 18480,
      revenueFormatted: '₹18,480',
      percentage: 100,
    },
    {
      name: 'Masala Dosa',
      revenue: 12960,
      revenueFormatted: '₹12,960',
      percentage: 70,
    },
    {
      name: 'Cold Coffee',
      revenue: 5700,
      revenueFormatted: '₹5,700',
      percentage: 31,
    },
    {
      name: 'Veg Sandwich',
      revenue: 3380,
      revenueFormatted: '₹3,380',
      percentage: 18,
    },
  ],
  orderSources: [
    {
      typeName: 'Type A · demo',
      percentage: 54,
      orderCount: 572,
    },
    {
      typeName: 'Type B · demo',
      percentage: 31,
      orderCount: 328,
    },
    {
      typeName: 'Type C · demo',
      percentage: 15,
      orderCount: 158,
    },
  ],
  schemaCoverage: [
    {
      id: 'sc-1',
      badge: 'Schema',
      title: 'Order records',
      description: 'Available in current schema',
    },
    {
      id: 'sc-2',
      badge: 'Needed',
      title: 'Inventory / stock',
      description: 'Not in current schema · future integration',
    },
    {
      id: 'sc-3',
      badge: 'Needed',
      title: 'Customer identity',
      description: 'Backend response dependent',
    },
    {
      id: 'sc-4',
      badge: 'Needed',
      title: 'Feedback topics/aspects',
      description: 'Backend response dependent',
    },
  ],
};

export function getAnalyticsData(timeframe: string = '7d'): AnalyticsSummary {
  if (timeframe === '30d') {
    return {
      ...ANALYTICS_DATA,
      totalRevenue: 584200,
      totalRevenueFormatted: '₹5,84,200',
      completedOrders: 4230,
      timeframeLabel: '08 Sep–07 Oct 2026 · Hazratganj · Demo INR/timezone; formatting is configurable.',
    };
  }
  return { ...ANALYTICS_DATA };
}
