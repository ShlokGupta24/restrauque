import React, { useState } from 'react';
import {
  getAnalyticsData,
  AnalyticsSummary,
} from '../../services/analyticsData';
import './AnalyticsPage.css';

export const AnalyticsPage: React.FC = () => {
  const [timeframe, setTimeframe] = useState<string>('7d');
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(() => getAnalyticsData('7d'));
  const [hoveredPoint, setHoveredPoint] = useState<{ day: string; revenue: number; x: number; y: number } | null>(null);

  const handleTimeframeChange = (newTf: string) => {
    setTimeframe(newTf);
    setAnalytics(getAnalyticsData(newTf));
  };

  // SVG dimensions for revenue area chart
  const svgWidth = 600;
  const svgHeight = 190;
  const paddingLeft = 36;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;
  const maxRevenue = 30000;

  // Calculate coordinates for points
  const points = analytics.dailyRevenue.map((item, index) => {
    const x = paddingLeft + (index / (analytics.dailyRevenue.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (item.revenue / maxRevenue) * chartHeight;
    return { ...item, x, y };
  });

  // Construct SVG path strings
  const linePath = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  return (
    <div className="analytics-page">
      {/* Header section with subtitle and Timeframe select */}
      <div className="analytics-header-section">
        <div className="analytics-title-row">
          <div>
            <h1>Analytics & Reports</h1>
            <p className="analytics-subtitle">{analytics.timeframeLabel}</p>
          </div>

          <div className="analytics-timeframe-row">
            <select
              className="analytics-timeframe-select"
              id="select-analytics-timeframe"
              value={timeframe}
              onChange={(e) => handleTimeframeChange(e.target.value)}
            >
              <option value="7d">Last 7 days ⌄</option>
              <option value="30d">Last 30 days ⌄</option>
              <option value="month">This month ⌄</option>
              <option value="ytd">Year to date ⌄</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card" id="kpi-total-revenue">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Total revenue</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">{analytics.totalRevenueFormatted}</div>
          <div className="analytics-kpi-trend">{analytics.revenueChangePct}</div>
          <div className="analytics-kpi-subtext">
            Demo · policy: gross/net/tax/paid unknown
          </div>
        </div>

        <div className="analytics-kpi-card" id="kpi-completed-orders">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Completed orders</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">
            {analytics.completedOrders.toLocaleString()}
          </div>
          <div className="analytics-kpi-trend">{analytics.completedOrdersChangePct}</div>
          <div className="analytics-kpi-subtext">Demo · completed only</div>
        </div>

        <div className="analytics-kpi-card" id="kpi-aov">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Average order value</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">{analytics.averageOrderValueFormatted}</div>
          <div className="analytics-kpi-trend">{analytics.aovChangePct}</div>
          <div className="analytics-kpi-subtext">
            Demo · AOV denominator pending handoff
          </div>
        </div>

        <div className="analytics-kpi-card" id="kpi-returning-customers">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-title">Returning customers</span>
            <span className="analytics-kpi-icon">↗</span>
          </div>
          <div className="analytics-kpi-val">
            {analytics.returningCustomers.toLocaleString()}
          </div>
          <div className="analytics-kpi-trend">Backend count · Demo</div>
          <div className="analytics-kpi-subtext">
            Demo · customer identity pending
          </div>
        </div>
      </div>

      {/* Middle Row: Revenue Area Chart & Top Products by Revenue */}
      <div className="analytics-middle-grid">
        {/* Left Card: Total revenue by day */}
        <div className="analytics-card" id="card-revenue-chart">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Total revenue by day</h2>
            <p className="analytics-card-subtitle">
              Basil & Brick · Hazratganj · Last 7 days · ₹ (INR)
            </p>
          </div>

          <div className="revenue-headline-group">
            <span className="revenue-headline-num">
              {analytics.totalRevenueFormatted}
            </span>
            <span className="pill-growth">{analytics.revenueChangePct}</span>
          </div>

          {/* Area Chart SVG */}
          <div className="revenue-chart-container">
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
              {[30, 20, 10, 0].map((val) => {
                const y = paddingTop + chartHeight - (val / 30) * chartHeight;
                return (
                  <g key={val}>
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
                      {val === 0 ? '0' : `${val}k`}
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient Fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#analyticsRevenueGrad)" />
              )}

              {/* Red Line Chart */}
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
                <g key={pt.day}>
                  {/* Interactive circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPoint?.day === pt.day ? 6 : 3.5}
                    fill="#ffffff"
                    stroke="#E53935"
                    strokeWidth="2.5"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={() =>
                      setHoveredPoint({ day: pt.day, revenue: pt.revenue, x: pt.x, y: pt.y })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* X-axis label */}
                  <text
                    x={pt.x}
                    y={paddingTop + chartHeight + 18}
                    textAnchor="middle"
                    fill="#9CA3AF"
                    fontSize="11"
                    fontFamily="Inter, sans-serif"
                  >
                    {pt.day}
                  </text>
                </g>
              ))}

              {/* Hover Tooltip inside SVG */}
              {hoveredPoint && (
                <g transform={`translate(${hoveredPoint.x}, ${hoveredPoint.y - 32})`}>
                  <rect
                    x="-42"
                    y="-12"
                    width="84"
                    height="24"
                    rx="6"
                    fill="#1F2937"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10.5"
                    fontWeight="600"
                    fontFamily="Inter, sans-serif"
                  >
                    ₹{hoveredPoint.revenue.toLocaleString()}
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Right Card: Top products by revenue */}
        <div className="analytics-card" id="card-top-products-revenue">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Top products by revenue</h2>
            <p className="analytics-card-subtitle">
              Basil & Brick · Hazratganj · Last 7 days · ranked by total revenue
            </p>
          </div>

          <div className="top-products-list">
            {analytics.topProducts.map((prod) => (
              <div key={prod.name} className="top-product-item">
                <div className="top-product-info-row">
                  <span className="top-product-name">{prod.name}</span>
                  <span className="top-product-revenue">{prod.revenueFormatted}</span>
                </div>
                <div className="top-product-bar-bg">
                  <div
                    className="top-product-bar-fill"
                    style={{ width: `${prod.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Order source mix & Schema coverage */}
      <div className="analytics-bottom-grid">
        {/* Left Card: Order source mix */}
        <div className="analytics-card" id="card-order-source-mix">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Order source mix</h2>
            <p className="analytics-card-subtitle">
              Order count by type · 01–07 Oct · Hazratganj · Taxonomy pending
            </p>
          </div>

          <div className="order-source-cards-row">
            {analytics.orderSources.map((source) => (
              <div key={source.typeName} className="order-source-card">
                <span className="order-source-type-label">{source.typeName}</span>
                <span className="order-source-pct">{source.percentage}%</span>
                <span className="order-source-orders">{source.orderCount} orders</span>
              </div>
            ))}
          </div>

          <p className="order-source-notice">
            Type A/B/C are demo placeholders, not canonical enum values. Confirm with backend.
          </p>
        </div>

        {/* Right Card: Schema coverage */}
        <div className="analytics-card" id="card-schema-coverage">
          <div className="analytics-card-header">
            <h2 className="analytics-card-title">Schema coverage</h2>
            <p className="analytics-card-subtitle">
              Current schema-aligned fields · future integrations noted below
            </p>
          </div>

          <div className="schema-coverage-list">
            {analytics.schemaCoverage.map((item) => (
              <div key={item.id} className="schema-coverage-item">
                <span
                  className={item.badge === 'Schema' ? 'badge-schema' : 'badge-needed'}
                >
                  {item.badge}
                </span>
                <div className="schema-item-texts">
                  <span className="schema-item-title">{item.title}</span>
                  <span className="schema-item-desc">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
