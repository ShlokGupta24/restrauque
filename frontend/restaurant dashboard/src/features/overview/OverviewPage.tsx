import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import {
  dashboardService,
  DashboardSalesResponse,
  DashboardDatePreset,
} from '../../services/dashboardService';
import { orderService, OwnerOrderSummary } from '../../services/orderService';
import './OverviewPage.css';

export const OverviewPage: React.FC = () => {
  const { restaurant, activeBranch, availableBranches, setActiveBranch, formatCurrency } =
    useRestaurant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [salesData, setSalesData] = useState<DashboardSalesResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<OwnerOrderSummary[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<DashboardDatePreset>('last_7_days');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load sales dashboard data and recent orders from backend
  const fetchOverviewData = useCallback(async () => {
    if (!activeBranch) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [salesRes, ordersRes] = await Promise.all([
        dashboardService.getSalesDashboard({
          branchId: activeBranch.id,
          preset: selectedPreset,
        }),
        orderService.getOrders({
          branchId: activeBranch.id,
          limit: 5,
        }),
      ]);

      setSalesData(salesRes);
      setRecentOrders(ordersRes.orders);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve sales analytics';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranch, selectedPreset]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const ownerDisplayName = user?.name || restaurant?.ownerName || 'Owner';
  const branchDisplayName = activeBranch?.name || 'Main Branch';

  // Dynamic SVG Area Chart from backend dailyTrend
  const dailyTrend = salesData?.dailyTrend || [];
  const svgWidth = 560;
  const svgHeight = 160;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 25;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...dailyTrend.map((d) => Math.max(d.realizedRevenue, d.netBilledSales)),
    1000
  );

  const chartPoints = dailyTrend.map((item, idx) => {
    const x =
      dailyTrend.length > 1
        ? paddingLeft + (idx / (dailyTrend.length - 1)) * chartWidth
        : paddingLeft + chartWidth / 2;
    const y = paddingTop + chartHeight - (item.realizedRevenue / maxVal) * chartHeight;
    // Format date e.g. "2026-10-14" -> "14 Oct"
    const dateObj = new Date(item.date);
    const label = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString([], { day: 'numeric', month: 'short' })
      : item.date;
    return { x, y, label, revenue: item.realizedRevenue };
  });

  const pathD = chartPoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD =
    chartPoints.length > 0
      ? `${pathD} L ${chartPoints[chartPoints.length - 1].x} ${paddingTop + chartHeight} L ${chartPoints[0].x} ${paddingTop + chartHeight} Z`
      : '';

  const presetLabels: Record<DashboardDatePreset, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    last_7_days: 'Last 7 days',
    last_30_days: 'Last 30 days',
    this_month: 'This month',
  };

  return (
    <div className="overview-page-container">
      {/* Top Banner Notice */}
      <div className="overview-subbanner">
        Authoritative POS revenue, branch-isolated analytics & verified settlement attribution.
      </div>

      {/* Greeting Header & Actions */}
      <div className="overview-header-row">
        <div className="greeting-text-group">
          <h2 className="greeting-title">Good evening, {ownerDisplayName}</h2>
          <div className="greeting-meta">
            Active Restaurant: {restaurant?.name || 'Workspace'} · {branchDisplayName}
          </div>
        </div>

        <div className="greeting-actions">
          {/* Date Preset Selector */}
          <div className="branch-dropdown-wrapper">
            <select
              className="branch-select"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value as DashboardDatePreset)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
              <option value="this_month">This month</option>
            </select>
            <ChevronDown size={14} className="dropdown-chevron" />
          </div>

          {/* Branch Switcher Dropdown */}
          <div className="branch-dropdown-wrapper">
            <select
              className="branch-select"
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
            <ChevronDown size={14} className="dropdown-chevron" />
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            className="btn btn-outline"
            onClick={fetchOverviewData}
            title="Refresh analytics"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Duplicate Settlement Warning (if surfaced by backend) */}
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
            <strong>Duplicate Payment Warning:</strong>{' '}
            {salesData.settlement.anomalousOrdersCount} order(s) contain multiple paid records. Headline
            realized revenue uses canonical policy ({salesData.settlement.duplicateSettlementPolicy || 'FIRST_SETTLEMENT'}). Excess uncounted amount: ₹{salesData.settlement.duplicateSettlementExcessAmountFormatted}.
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
            onClick={fetchOverviewData}
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

      {/* 4 KPI Summary Cards Grid */}
      <div className="overview-kpi-grid">
        {/* KPI 1: Realized Revenue */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Realized revenue</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">
            {salesData ? formatCurrency(salesData.settlement.realizedRevenue) : '₹0.00'}
          </div>
          <div className="kpi-change">
            <span className="badge-change positive" style={{ fontSize: '11px' }}>
              Billed: {salesData ? formatCurrency(salesData.sales.netBilledSales) : '₹0.00'}
            </span>
          </div>
          <div className="kpi-footer-note">
            Canonical full settlement attribution · {presetLabels[selectedPreset]}
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total orders</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">
            {salesData ? salesData.sales.totalOrders.toLocaleString() : '0'}
          </div>
          <div className="kpi-subtext">
            {salesData
              ? `Completed: ${salesData.sales.orderStatusBreakdown.completed} · In-prep: ${salesData.sales.orderStatusBreakdown.preparing + salesData.sales.orderStatusBreakdown.served}`
              : 'Order fulfillment status counts'}
          </div>
          <div className="kpi-footer-note">
            Cancelled: {salesData ? salesData.sales.orderStatusBreakdown.cancelled : '0'} orders
          </div>
        </div>

        {/* KPI 3: Average Order Value */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Average order value</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">
            {salesData ? formatCurrency(salesData.settlement.realizedAov) : '₹0.00'}
          </div>
          <div className="kpi-subtext">
            Billed AOV: {salesData ? formatCurrency(salesData.sales.billedAov) : '₹0.00'}
          </div>
          <div className="kpi-footer-note">
            Calculated as realized revenue ÷ settled orders count
          </div>
        </div>

        {/* KPI 4: Settled vs Unsettled */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Settled orders</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value" style={{ color: '#059669' }}>
            {salesData ? salesData.settlement.settledOrdersCount.toLocaleString() : '0'}
          </div>
          <div className="kpi-subtext">
            Unsettled: {salesData ? salesData.settlement.unsettledOrdersCount : 0} ({salesData ? formatCurrency(salesData.settlement.unsettledAmount) : '₹0'})
          </div>
          <div className="kpi-footer-note">
            Retention cohorts unavailable in sales API
          </div>
        </div>
      </div>

      {/* Row 2: Revenue Chart & Top Selling Products */}
      <div className="overview-mid-grid">
        {/* Revenue Overview Card */}
        <div className="card chart-card">
          <div className="card-header-clean">
            <div>
              <h3 className="card-title">Revenue overview</h3>
              <div className="card-subtitle">
                Realized revenue daily timeline · {presetLabels[selectedPreset]} · {branchDisplayName}
              </div>
            </div>
          </div>

          <div className="chart-stat-row">
            <span className="chart-main-value">
              {salesData ? formatCurrency(salesData.settlement.realizedRevenue) : '₹0.00'}
            </span>
            <span className="chart-pill-badge" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              {salesData ? `${salesData.settlement.settledOrdersCount} settled orders` : 'Authoritative'}
            </span>
          </div>
          <div className="chart-sub-note">
            Timezone: {salesData?.meta?.timezone || 'Asia/Kolkata'} · Net Billed: {salesData ? formatCurrency(salesData.sales.netBilledSales) : '₹0'}
          </div>

          {/* SVG Area Chart */}
          <div className="chart-svg-container">
            {isLoading ? (
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                <RefreshCw size={18} className="animate-spin" />
                <span style={{ marginLeft: '8px' }}>Loading trend data...</span>
              </div>
            ) : chartPoints.length === 0 ? (
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                No sales records found for this period
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="revenue-chart-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e53935" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#e53935" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="40" y1="20" x2="540" y2="20" stroke="#f3f4f6" strokeDasharray="3 3" />
                <line x1="40" y1="60" x2="540" y2="60" stroke="#f3f4f6" strokeDasharray="3 3" />
                <line x1="40" y1="100" x2="540" y2="100" stroke="#f3f4f6" strokeDasharray="3 3" />
                <line x1="40" y1="135" x2="540" y2="135" stroke="#f3f4f6" />

                {/* Y Axis Labels */}
                <text x="35" y="24" fill="#9ca3af" fontSize="9" textAnchor="end">₹{Math.round(maxVal).toLocaleString()}</text>
                <text x="35" y="75" fill="#9ca3af" fontSize="9" textAnchor="end">₹{Math.round(maxVal / 2).toLocaleString()}</text>
                <text x="35" y="138" fill="#9ca3af" fontSize="9" textAnchor="end">0</text>

                {/* Area & Stroke */}
                {areaD && <path d={areaD} fill="url(#revenueGradient)" />}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#e53935"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points & X Axis Labels */}
                {chartPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.y} r="3.5" fill="#ffffff" stroke="#e53935" strokeWidth="2" />
                    <text
                      x={pt.x}
                      y="152"
                      fill="#9ca3af"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {pt.label}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Top-Selling Products Card */}
        <div className="card top-products-card">
          <div className="card-header-clean">
            <h3 className="card-title">Top-selling products</h3>
            <div className="card-subtitle">
              By units sold · {presetLabels[selectedPreset]} · {branchDisplayName}
            </div>
          </div>

          <div className="top-products-list">
            {salesData && salesData.topSellingItems.length > 0 ? (
              (() => {
                const maxQty = Math.max(...salesData.topSellingItems.map((p) => p.quantitySold), 1);
                return salesData.topSellingItems.map((prod, idx) => {
                  const widthPct = Math.min(100, Math.round((prod.quantitySold / maxQty) * 100));
                  return (
                    <div key={prod.productName} className="top-product-item">
                      <div className="product-meta-row">
                        <span className="product-name">{prod.productName}</span>
                        <span className="product-units">
                          {prod.quantitySold} units ({formatCurrency(prod.totalRevenue)})
                        </span>
                      </div>
                      <div className="product-progress-track">
                        <div
                          className={`product-progress-bar ${idx === 0 ? 'bar-red' : 'bar-dark'}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                No items sold in this reporting period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Recent Orders & Payment Tender Breakdown */}
      <div className="overview-bottom-grid">
        {/* Recent Orders Card */}
        <div className="card recent-orders-card">
          <div className="recent-orders-header">
            <div>
              <h3 className="card-title">Recent orders</h3>
              <div className="card-subtitle">
                Latest live orders from {branchDisplayName}
              </div>
            </div>
            <button
              type="button"
              className="view-orders-link"
              onClick={() => navigate('/dashboard/orders')}
            >
              <span>View all orders</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="recent-orders-table-wrapper">
            <table className="recent-orders-table">
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>CUSTOMER</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>TIME</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length > 0 ? (
                  recentOrders.map((ord) => {
                    const dateObj = new Date(ord.orderedAt);
                    const timeFormatted = isNaN(dateObj.getTime())
                      ? ord.orderedAt
                      : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr
                        key={ord.id}
                        className="order-row-clickable"
                        onClick={() => navigate(`/dashboard/orders/${ord.id}`)}
                        title="Click to view authoritative order details"
                      >
                        <td className="order-cell-id">{ord.orderNumber}</td>
                        <td className="order-cell-customer">
                          {ord.customer ? ord.customer.name : 'Walk-in'}
                        </td>
                        <td className="order-cell-amount">{formatCurrency(ord.pricing.totalAmount)}</td>
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor:
                                ord.status === 'completed'
                                  ? '#ecfdf5'
                                  : ord.status === 'cancelled'
                                  ? '#fef2f2'
                                  : ord.status === 'served'
                                  ? '#f3e8ff'
                                  : ord.status === 'preparing'
                                  ? '#eff6ff'
                                  : '#fef3c7',
                              color:
                                ord.status === 'completed'
                                  ? '#059669'
                                  : ord.status === 'cancelled'
                                  ? '#dc2626'
                                  : ord.status === 'served'
                                  ? '#7c3aed'
                                  : ord.status === 'preparing'
                                  ? '#2563eb'
                                  : '#d97706',
                              textTransform: 'capitalize',
                            }}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="order-cell-time">{timeFormatted}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontStyle: 'italic' }}>
                      No recent orders in this branch
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* POS Payment Tender Breakdown Card */}
        <div className="card intelligence-card">
          <div className="card-header-clean">
            <h3 className="card-title">Payment Tender Breakdown</h3>
            <div className="card-subtitle">
              Attributed POS settlement tender · {presetLabels[selectedPreset]}
            </div>
          </div>

          <div className="intelligence-inner-box">
            <div className="box-badge-row">
              <span className="schema-metrics-badge">SETTLEMENT ATTRIBUTION</span>
            </div>

            {salesData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', margin: '12px 0' }}>
                <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Cash</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                    {formatCurrency(salesData.settlement.paymentMethodBreakdown.cash.amount)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    {salesData.settlement.paymentMethodBreakdown.cash.count} settlements
                  </div>
                </div>

                <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>UPI</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                    {formatCurrency(salesData.settlement.paymentMethodBreakdown.upi.amount)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    {salesData.settlement.paymentMethodBreakdown.upi.count} settlements
                  </div>
                </div>

                <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Card</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                    {formatCurrency(salesData.settlement.paymentMethodBreakdown.card.amount)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    {salesData.settlement.paymentMethodBreakdown.card.count} settlements
                  </div>
                </div>

                <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Other</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                    {formatCurrency(salesData.settlement.paymentMethodBreakdown.other.amount)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    {salesData.settlement.paymentMethodBreakdown.other.count} settlements
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                Loading tender statistics...
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary-red ai-insights-btn"
              onClick={() => navigate('/dashboard/analytics')}
              style={{ marginTop: '8px' }}
            >
              <span>Full analytics</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="intelligence-footer-notice">
            Policy: {salesData?.settlement?.duplicateSettlementPolicy || 'FIRST_CANONICAL_FULL_SETTLEMENT'}.
          </div>
        </div>
      </div>
    </div>
  );
};
