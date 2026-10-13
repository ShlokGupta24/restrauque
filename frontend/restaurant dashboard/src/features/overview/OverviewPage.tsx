import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, Download } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  mockOverviewMetrics,
  mockTopProducts,
  mockRecentOrders,
} from '../../services/mockData';
import './OverviewPage.css';

export const OverviewPage: React.FC = () => {
  const { activeBranch, availableBranches, setActiveBranch, formatCurrency } = useRestaurant();
  const navigate = useNavigate();

  // SVG Area Chart Calculations
  // Coordinates for 7 days: Mon (0), Tue (1), Wed (2), Thu (3), Fri (4), Sat (5), Sun (6)
  // ViewBox: 0 0 560 160
  // Values roughly: Mon: 100, Tue: 90, Wed: 80, Thu: 60, Fri: 80, Sat: 45, Sun: 30 (inverted for Y)
  const chartPoints = [
    { x: 50, y: 110, day: 'Mon' },
    { x: 130, y: 100, day: 'Tue' },
    { x: 210, y: 75, day: 'Wed' },
    { x: 290, y: 90, day: 'Thu' },
    { x: 370, y: 65, day: 'Fri' },
    { x: 450, y: 40, day: 'Sat' },
    { x: 530, y: 25, day: 'Sun' },
  ];

  const pathD = chartPoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L 530 140 L 50 140 Z`;

  return (
    <div className="overview-page-container">
      {/* Top Banner Notice */}
      <div className="overview-subbanner">
        Your restaurant snapshot · clearly labelled sample data.
      </div>

      {/* Greeting Header & Actions */}
      <div className="overview-header-row">
        <div className="greeting-text-group">
          <h2 className="greeting-title">Good evening, Aarav</h2>
          <div className="greeting-meta">
            01–07 Oct 2026 · {activeBranch.name} · Demo only
          </div>
        </div>

        <div className="greeting-actions">
          {/* Branch Switcher Dropdown */}
          <div className="branch-dropdown-wrapper">
            <select
              className="branch-select"
              value={activeBranch.id}
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

          {/* Export Report Action */}
          <button type="button" className="btn btn-dark export-btn">
            <Download size={14} />
            <span>Export report</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards Grid */}
      <div className="overview-kpi-grid">
        {/* KPI 1: Total Revenue */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total revenue</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">{formatCurrency(mockOverviewMetrics.totalRevenue)}</div>
          <div className="kpi-change">
            <span className="badge-change positive">
              +{mockOverviewMetrics.revenueChangePct}% · previous 7 days
            </span>
          </div>
          <div className="kpi-footer-note">
            Sample data · Gross/net policy: confirm with backend
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total orders</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">{mockOverviewMetrics.totalOrders.toLocaleString()}</div>
          <div className="kpi-subtext">Total includes all order statuses</div>
          <div className="kpi-footer-note">
            Completed and cancelled are separate
          </div>
        </div>

        {/* KPI 3: Average Order Value */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Average order value</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">{formatCurrency(mockOverviewMetrics.averageOrderValue)}</div>
          <div className="kpi-subtext">Stored metric · definition pending</div>
          <div className="kpi-footer-note">
            Sample data · AOV denominator: confirm with backend
          </div>
        </div>

        {/* KPI 4: Returning Customers */}
        <div className="card kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Returning customers</span>
            <ArrowUpRight size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">{mockOverviewMetrics.returningCustomers}</div>
          <div className="kpi-subtext">Count, not a derived percentage</div>
          <div className="kpi-footer-note">
            Backend customer metric
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
                Total revenue · 01–07 Oct · {activeBranch.name.replace(' branch', '')} · Demo
              </div>
            </div>
          </div>

          <div className="chart-stat-row">
            <span className="chart-main-value">
              {formatCurrency(mockOverviewMetrics.totalRevenue)}
            </span>
            <span className="chart-pill-badge">
              +{mockOverviewMetrics.revenueChangePct}%
            </span>
          </div>
          <div className="chart-sub-note">Previous 7-day comparison · demo</div>

          {/* SVG Area Chart */}
          <div className="chart-svg-container">
            <svg
              viewBox="0 0 560 160"
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
              <line x1="40" y1="140" x2="540" y2="140" stroke="#f3f4f6" />

              {/* Y Axis Labels */}
              <text x="25" y="24" fill="#9ca3af" fontSize="9" textAnchor="end">30k</text>
              <text x="25" y="64" fill="#9ca3af" fontSize="9" textAnchor="end">20k</text>
              <text x="25" y="104" fill="#9ca3af" fontSize="9" textAnchor="end">10k</text>
              <text x="25" y="144" fill="#9ca3af" fontSize="9" textAnchor="end">0</text>

              {/* Area & Stroke */}
              <path d={areaD} fill="url(#revenueGradient)" />
              <path
                d={pathD}
                fill="none"
                stroke="#e53935"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* X Axis Labels */}
              {chartPoints.map((pt) => (
                <text
                  key={pt.day}
                  x={pt.x}
                  y="156"
                  fill="#9ca3af"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {pt.day}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Top-Selling Products Card */}
        <div className="card top-products-card">
          <div className="card-header-clean">
            <h3 className="card-title">Top-selling products</h3>
            <div className="card-subtitle">
              By units sold · 01–07 Oct · {activeBranch.name.replace(' branch', '')}
            </div>
          </div>

          <div className="top-products-list">
            {mockTopProducts.map((prod) => {
              const maxUnits = 100;
              const widthPct = Math.min(100, Math.round((prod.unitsSold / maxUnits) * 100));
              return (
                <div key={prod.name} className="top-product-item">
                  <div className="product-meta-row">
                    <span className="product-name">{prod.name}</span>
                    <span className="product-units">{prod.unitsSold}</span>
                  </div>
                  <div className="product-progress-track">
                    <div
                      className={`product-progress-bar ${prod.isHighlight ? 'bar-red' : 'bar-dark'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Recent Orders & Restrauque Intelligence */}
      <div className="overview-bottom-grid">
        {/* Recent Orders Card */}
        <div className="card recent-orders-card">
          <div className="recent-orders-header">
            <div>
              <h3 className="card-title">Recent orders</h3>
              <div className="card-subtitle">
                Latest activity from your restaurant · Sample data
              </div>
            </div>
            <button
              type="button"
              className="view-orders-link"
              onClick={() => navigate('/dashboard/orders')}
            >
              <span>View orders</span>
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
                {mockRecentOrders.map((ord) => (
                  <tr
                    key={ord.id}
                    className="order-row-clickable"
                    onClick={() => navigate(`/dashboard/orders/${ord.orderNumber}`)}
                    title="Click to view order details"
                  >
                    <td className="order-cell-id">{ord.orderNumber}</td>
                    <td className="order-cell-customer">{ord.customerName}</td>
                    <td className="order-cell-amount">{formatCurrency(ord.totalAmount)}</td>
                    <td>
                      <span className="status-pill-pending">
                        {ord.orderStatus.charAt(0).toUpperCase() + ord.orderStatus.slice(1)}
                      </span>
                    </td>
                    <td className="order-cell-time">{ord.orderedAt.split('·')[1]?.trim() || ord.orderedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Restrauque Intelligence Card */}
        <div className="card intelligence-card">
          <div className="card-header-clean">
            <h3 className="card-title">Restrauque Intelligence</h3>
            <div className="card-subtitle">
              Additional daily metrics · same period and branch
            </div>
          </div>

          <div className="intelligence-inner-box">
            <div className="box-badge-row">
              <span className="schema-metrics-badge">SCHEMA METRICS</span>
            </div>

            <div className="intelligence-headline">
              Completed 1,058 · Cancelled 142
            </div>

            <div className="intelligence-subtext">
              Total customers 1,058 · Average rating 4.6/5
            </div>
            <div className="intelligence-micro">
              Demo aggregates; separate from total orders.
            </div>

            <button
              type="button"
              className="btn btn-primary-red ai-insights-btn"
              onClick={() => navigate('/dashboard/ai-insights')}
            >
              <span>AI insights</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="intelligence-footer-notice">
            No insight records yet. Revenue and AOV definitions, status enums and locale formatting need backend confirmation.
          </div>
        </div>
      </div>
    </div>
  );
};
