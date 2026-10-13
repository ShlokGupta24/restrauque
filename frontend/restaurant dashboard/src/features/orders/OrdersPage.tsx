import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { mockRecentOrders } from '../../services/mockData';
import './OrdersPage.css';

export const OrdersPage: React.FC = () => {
  const { formatCurrency, activeBranch, availableBranches, setActiveBranch } = useRestaurant();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');

  const filteredOrders = mockRecentOrders.filter((ord) => {
    const matchesSearch =
      ord.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ord.customerName && ord.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      selectedStatus === 'all' || ord.orderStatus === selectedStatus;

    const matchesPayment =
      selectedPaymentStatus === 'all' || ord.paymentStatus === selectedPaymentStatus;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="orders-page-container">
      {/* Sub-banner notice */}
      <div className="orders-subbanner">
        Review orders, order status, payment status and view order detail.
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="orders-kpi-grid">
        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Total orders</span>
          <div className="orders-kpi-value">1,200</div>
        </div>

        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Completed orders</span>
          <div className="orders-kpi-value">1,058</div>
        </div>

        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Cancelled orders</span>
          <div className="orders-kpi-value">142</div>
        </div>

        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Payment status</span>
          <div className="orders-kpi-value text-muted-value">Not available</div>
        </div>
      </div>

      {/* Main Orders List Card */}
      <div className="card orders-table-card">
        <div className="card-header-clean">
          <h3 className="card-title">Orders / List / Demo</h3>
          <div className="card-subtitle">
            Independent order status and payment status · confirm transitions with backend.
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="orders-filter-bar">
          <div className="filter-group-left">
            {/* Date Range Button */}
            <button type="button" className="filter-chip-btn">
              01–07 Oct
            </button>

            {/* Branch Selector */}
            <select
              className="filter-select"
              value={activeBranch.id}
              onChange={(e) => {
                const b = availableBranches.find((item) => item.id === e.target.value);
                if (b) setActiveBranch(b);
              }}
            >
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name.replace(' branch', '')}
                </option>
              ))}
            </select>

            {/* Order Status Selector */}
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Order status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Payment Status Selector */}
            <select
              className="filter-select"
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            >
              <option value="all">Payment status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="not_available">Not available</option>
            </select>

            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search order or customer"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <button type="button" className="filter-chip-btn filter-action-btn">
            <Filter size={14} />
            <span>Filters</span>
          </button>
        </div>

        {/* Orders Table */}
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>ORDER / TIME</th>
                <th>CUSTOMER / TABLE</th>
                <th>TYPE</th>
                <th>TOTAL</th>
                <th>ORDER STATUS</th>
                <th>PAYMENT STATUS</th>
                <th>DETAIL</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((ord) => {
                const timeStr = ord.orderedAt.split('·')[1]?.trim() || ord.orderedAt;
                const customerTableStr =
                  ord.customerName && ord.customerName !== 'Not available'
                    ? ord.tableNumber
                      ? `${ord.customerName} · ${ord.tableNumber}`
                      : ord.customerName
                    : 'Not available';

                return (
                  <tr key={ord.id} className="orders-table-row">
                    <td className="cell-order-time">
                      <span className="order-num-text">{ord.orderNumber}</span>
                      <span className="order-time-text"> · {timeStr}</span>
                    </td>
                    <td className="cell-customer-table">{customerTableStr}</td>
                    <td className="cell-type">Not available</td>
                    <td className="cell-total">{formatCurrency(ord.totalAmount)}</td>
                    <td>
                      <span className="status-pill-pending">
                        {ord.orderStatus.charAt(0).toUpperCase() + ord.orderStatus.slice(1)}
                      </span>
                    </td>
                    <td className="cell-payment-status">Not available</td>
                    <td>
                      <button
                        type="button"
                        className="btn-view-detail"
                        onClick={() => navigate(`/dashboard/orders/${ord.orderNumber}`)}
                      >
                        View detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info & Load More */}
        <div className="orders-table-footer">
          <span className="footer-sample-note">
            7 sample rows · statuses/types: confirm with backend. Formatting follows locale.
          </span>
          <button type="button" className="btn-load-more">
            Load more
          </button>
        </div>
      </div>
    </div>
  );
};
