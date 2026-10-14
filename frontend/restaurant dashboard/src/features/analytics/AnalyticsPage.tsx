import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  dashboardService,
  DashboardSalesResponse,
  DashboardDatePreset,
} from '../../services/dashboardService';
import './AnalyticsPage.css';

export const AnalyticsPage: React.FC = () => {
  const { activeBranch, availableBranches, setActiveBranch, formatCurrency } = useRestaurant();

  const [timeframe, setTimeframe] = useState<DashboardDatePreset>('last_7_days');
  const [salesData, setSalesData] = useState<DashboardSalesResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    revenue: number;
    billed: number;
    ordersCount: number;
    x: number;
    y: number;
  } | null>(null);

  // Fetch sales analytics from backend API
  const fetchAnalytics = useCallback(async () => {
    if (!activeBranch) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await dashboardService.getSalesDashboard({
        branchId: activeBranch.id,
        preset: timeframe,
      });
      setSalesData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve sales analytics';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranch, timeframe]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // SVG Area Chart Calculations
  const svgWidth = 600;
  const svgHeight = 190;
  const paddingLeft = 45;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const dailyTrend = salesData?.dailyTrend || [];
  const maxRevenue = Math.max(
    ...dailyTrend.map((d) => Math.max(d.realizedRevenue, d.netBilledSales)),
    1000
  );

  const points = dailyTrend.map((item, index) => {
    const x =
      dailyTrend.length > 1
        ? paddingLeft + (index / (dailyTrend.length - 1)) * chartWidth
        : paddingLeft + chartWidth / 2;
    const y = paddingTop + chartHeight - (item.realizedRevenue / maxRevenue) * chartHeight;
    const dateObj = new Date(item.date);
    const dayLabel = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString([], { day: 'numeric', month: 'short' })
      : item.date;

    return {
      date: dayLabel,
      revenue: item.realizedRevenue,
      billed: item.netBilledSales,
      ordersCount: item.ordersCount,
      x,
      y,
    };
  });

  const linePath = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : '';

  const timeframeLabels: Record<DashboardDatePreset, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    last_7_days: 'Last 7 days',
    last_30_days: 'Last 30 days',
    this_month: 'This month',
  };

  const branchName = activeBranch?.name || 'Active Branch';

  return (
    <div className="analytics-page">
      {/* Header section with subtitle and filters */}
      <div className="analytics-header-section">
        <div className="analytics-title-row">
          <div>
            <h1>Analytics & Reports</h1>
            <p className="analytics-subtitle">
              {branchName} · {timeframeLabels[timeframe]} · Timezone: {salesData?.meta?.timezone || 'Asia/Kolkata'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Branch Selector */}
            <select
              className="analytics-timeframe-select"
              value={activeBranch?.id || ''}
              onChange={(e) => {
                const b = availableBranches.find((item) => item.id === e.target.value);
                if (b) setActiveBranch(b);
              }}
            >
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Timeframe Preset Select */}
            <select
              className="analytics-timeframe-select"
              id="select-analytics-timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as DashboardDatePreset)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="this_month">This month</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              className="btn btn-outline"
              onClick={fetchAnalytics}
              title="Refresh sales reports"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px' }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Settlement Warning Banner */}
      {salesData?.settlement?.hasDuplicatePaidRecordsWarning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '8px',
            color: '#b45309',
            fontSize: '12px',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Reconciliation Alert:</strong> {salesData.settlement.anomalousOrdersCount} order(s) have multiple recorded paid transactions.
            Headline revenue uses {salesData.settlement.duplicateSettlementPolicy || 'canonical single-settlement attribution'}. Uncounted excess amount: ₹{salesData.settlement.duplicateSettlementExcessAmountFormatted}.
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: '8px',
            color: '#d32f2f',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            style={{
              background: 'none',
              border: 'none',
              color: '#d32f2f',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="analytics-kpi-grid">
        {/* KPI 1: Total Realized Revenue */}
        <div className="analytics-kpi-card" id="kpi-total-revenue">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Realized Revenue</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">
            {salesData ? formatCurrency(salesData.settlement.realizedRevenue) : '₹0.00'}
          </div>
          <div className="analytics-kpi-trend" style={{ color: '#059669' }}>
            Net Billed: {salesData ? formatCurrency(salesData.sales.netBilledSales) : '₹0.00'}
          </div>
          <div className="analytics-kpi-subtext">
            Canonical realized settlement revenue
          </div>
        </div>

        {/* KPI 2: Settled Orders */}
        <div className="analytics-kpi-card" id="kpi-completed-orders">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Settled Orders</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">
            {salesData ? salesData.settlement.settledOrdersCount.toLocaleString() : '0'}
          </div>
          <div className="analytics-kpi-trend" style={{ color: '#2563eb' }}>
            Total Orders: {salesData ? salesData.sales.totalOrders : '0'}
          </div>
          <div className="analytics-kpi-subtext">
            Completed: {salesData ? salesData.sales.orderStatusBreakdown.completed : 0} · Cancelled: {salesData ? salesData.sales.orderStatusBreakdown.cancelled : 0}
          </div>
        </div>

        {/* KPI 3: Realized AOV */}
        <div className="analytics-kpi-card" id="kpi-aov">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Realized AOV</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">
            {salesData ? formatCurrency(salesData.settlement.realizedAov) : '₹0.00'}
          </div>
          <div className="analytics-kpi-trend">
            Billed AOV: {salesData ? formatCurrency(salesData.sales.billedAov) : '₹0.00'}
          </div>
          <div className="analytics-kpi-subtext">
            Realized revenue ÷ settled orders count
          </div>
        </div>

        {/* KPI 4: Unsettled Orders */}
        <div className="analytics-kpi-card" id="kpi-returning-customers">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Unsettled Orders</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val" style={{ color: '#d97706' }}>
            {salesData ? salesData.settlement.unsettledOrdersCount.toLocaleString() : '0'}
          </div>
          <div className="analytics-kpi-trend" style={{ color: '#b45309' }}>
            Unsettled: {salesData ? formatCurrency(salesData.settlement.unsettledAmount) : '₹0.00'}
          </div>
          <div className="analytics-kpi-subtext">
            Customer retention not in sales API
          </div>
        </div>
      </div>

      {/* Middle Row: Revenue Area Chart & Top Products by Revenue */}
      <div className="analytics-middle-grid">
        {/* Left Card: Total revenue by day */}
        <div className="analytics-card" id="card-revenue-chart">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Daily Realized Revenue</h2>
            <p className="analytics-card-subtitle">
              {branchName} · {timeframeLabels[timeframe]} · ₹ (INR)
            </p>
          </div>

          <div className="revenue-headline-group">
            <span className="revenue-headline-num">
              {salesData ? formatCurrency(salesData.settlement.realizedRevenue) : '₹0.00'}
            </span>
            <span className="pill-growth" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              {salesData ? `${salesData.settlement.settledOrdersCount} settled orders` : 'Settled'}
            </span>
          </div>

          {/* Area Chart SVG */}
          <div className="revenue-chart-container">
            {isLoading ? (
              <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                <RefreshCw size={18} className="animate-spin" />
                <span style={{ marginLeft: '8px' }}>Loading daily trend...</span>
              </div>
            ) : points.length === 0 ? (
              <div style={{ height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                No daily revenue recorded for this period
              </div>
            ) : (
              <svg
                className="chart-svg"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="analyticsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E53935" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#E53935" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Gridlines & Y-Axis labels */}
                {[1, 0.5, 0].map((fraction) => {
                  const y = paddingTop + chartHeight - fraction * chartHeight;
                  const labelVal = Math.round(maxRevenue * fraction);
                  return (
                    <g key={fraction}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={svgWidth - paddingRight}
                        y2={y}
                        stroke="#F3F4F6"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        fill="#9CA3AF"
                        fontSize="10"
                        fontFamily="Inter, sans-serif"
                      >
                        {labelVal === 0 ? '0' : `₹${labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}`}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient Fill */}
                {areaPath && <path d={areaPath} fill="url(#analyticsRevenueGrad)" />}

                {/* Line Chart */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#E53935"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data points & X-axis labels */}
                {points.map((pt) => (
                  <g key={pt.date}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredPoint?.date === pt.date ? 6 : 3.5}
                      fill="#ffffff"
                      stroke="#E53935"
                      strokeWidth="2.5"
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onMouseEnter={() =>
                        setHoveredPoint({
                          date: pt.date,
                          revenue: pt.revenue,
                          billed: pt.billed,
                          ordersCount: pt.ordersCount,
                          x: pt.x,
                          y: pt.y,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    <text
                      x={pt.x}
                      y={paddingTop + chartHeight + 18}
                      textAnchor="middle"
                      fill="#9CA3AF"
                      fontSize="10"
                      fontFamily="Inter, sans-serif"
                    >
                      {pt.date}
                    </text>
                  </g>
                ))}

                {/* Hover Tooltip inside SVG */}
                {hoveredPoint && (
                  <g transform={`translate(${hoveredPoint.x}, ${Math.max(hoveredPoint.y - 36, 16)})`}>
                    <rect
                      x="-55"
                      y="-12"
                      width="110"
                      height="24"
                      rx="6"
                      fill="#1F2937"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="Inter, sans-serif"
                    >
                      ₹{hoveredPoint.revenue.toLocaleString()} ({hoveredPoint.ordersCount} ord)
                    </text>
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>

        {/* Right Card: Top products by revenue */}
        <div className="analytics-card" id="card-top-products-revenue">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Top Products by Revenue</h2>
            <p className="analytics-card-subtitle">
              {branchName} · {timeframeLabels[timeframe]} · ranked by sales volume
            </p>
          </div>

          <div className="top-products-list">
            {salesData && salesData.topSellingItems.length > 0 ? (
              (() => {
                const maxRev = Math.max(...salesData.topSellingItems.map((p) => p.totalRevenue), 1);
                return salesData.topSellingItems.map((prod) => {
                  const widthPct = Math.min(100, Math.round((prod.totalRevenue / maxRev) * 100));
                  return (
                    <div key={prod.productName} className="top-product-item">
                      <div className="top-product-info-row">
                        <span className="top-product-name">{prod.productName}</span>
                        <span className="top-product-revenue">
                          {formatCurrency(prod.totalRevenue)} ({prod.quantitySold} units)
                        </span>
                      </div>
                      <div className="top-product-bar-bg">
                        <div
                          className="top-product-bar-fill"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div style={{ padding: '36px 0', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                No product sales records in this period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Payment Tender Breakdown & Revenue Reconciliation */}
      <div className="analytics-bottom-grid">
        {/* Left Card: POS Payment Tender Breakdown */}
        <div className="analytics-card" id="card-order-source-mix">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">POS Payment Tender Breakdown</h2>
            <p className="analytics-card-subtitle">
              Attributed settlement amounts by payment method · {timeframeLabels[timeframe]}
            </p>
          </div>

          {salesData ? (
            <div className="order-source-cards-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div className="order-source-card">
                <span className="order-source-type-label">CASH</span>
                <span className="order-source-pct" style={{ fontSize: '16px', fontWeight: 700 }}>
                  {formatCurrency(salesData.settlement.paymentMethodBreakdown.cash.amount)}
                </span>
                <span className="order-source-orders">
                  {salesData.settlement.paymentMethodBreakdown.cash.count} settlements
                </span>
              </div>

              <div className="order-source-card">
                <span className="order-source-type-label">UPI</span>
                <span className="order-source-pct" style={{ fontSize: '16px', fontWeight: 700 }}>
                  {formatCurrency(salesData.settlement.paymentMethodBreakdown.upi.amount)}
                </span>
                <span className="order-source-orders">
                  {salesData.settlement.paymentMethodBreakdown.upi.count} settlements
                </span>
              </div>

              <div className="order-source-card">
                <span className="order-source-type-label">CARD</span>
                <span className="order-source-pct" style={{ fontSize: '16px', fontWeight: 700 }}>
                  {formatCurrency(salesData.settlement.paymentMethodBreakdown.card.amount)}
                </span>
                <span className="order-source-orders">
                  {salesData.settlement.paymentMethodBreakdown.card.count} settlements
                </span>
              </div>

              <div className="order-source-card">
                <span className="order-source-type-label">OTHER</span>
                <span className="order-source-pct" style={{ fontSize: '16px', fontWeight: 700 }}>
                  {formatCurrency(salesData.settlement.paymentMethodBreakdown.other.amount)}
                </span>
                <span className="order-source-orders">
                  {salesData.settlement.paymentMethodBreakdown.other.count} settlements
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Loading tender breakdown...
            </div>
          )}

          <p className="order-source-notice" style={{ marginTop: '12px' }}>
            Attribution policy: {salesData?.settlement?.duplicateSettlementPolicy || 'FIRST_CANONICAL_FULL_SETTLEMENT'}.
          </p>
        </div>

        {/* Right Card: Financial Reconciliation Audit */}
        <div className="analytics-card" id="card-schema-coverage">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Financial Reconciliation Audit</h2>
            <p className="analytics-card-subtitle">
              Audited billing aggregates & settlement reconciliation
            </p>
          </div>

          {salesData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>Gross Sales (items pre-discount)</span>
                <span style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(salesData.sales.grossSales)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>Total Discounts</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>-{formatCurrency(salesData.sales.totalDiscounts)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>Total Tax</span>
                <span style={{ fontWeight: 600, color: '#111827' }}>+{formatCurrency(salesData.sales.totalTax)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>Net Billed Sales</span>
                <span style={{ fontWeight: 700, color: '#111827' }}>{formatCurrency(salesData.sales.netBilledSales)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#059669', fontWeight: 600 }}>Realized Revenue (Attributed)</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>{formatCurrency(salesData.settlement.realizedRevenue)}</span>
              </div>

              {salesData.settlement.duplicateSettlementExcessAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #fef3c7', color: '#b45309' }}>
                  <span>Duplicate Payment Excess (Uncounted)</span>
                  <span style={{ fontWeight: 700 }}>₹{salesData.settlement.duplicateSettlementExcessAmountFormatted}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#6b7280' }}>
                <span>Unsettled Outstanding</span>
                <span>{formatCurrency(salesData.settlement.unsettledAmount)} ({salesData.settlement.unsettledOrdersCount} ord)</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Loading audit summary...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
