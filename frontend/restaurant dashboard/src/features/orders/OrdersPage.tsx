import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  orderService,
  OwnerOrderSummary,
  OwnerOrdersMetricsSummary,
  OwnerOrdersPagination,
} from '../../services/orderService';
import './OrdersPage.css';

export const OrdersPage: React.FC = () => {
  const { formatCurrency, activeBranch, availableBranches, setActiveBranch } = useRestaurant();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OwnerOrderSummary[]>([]);
  const [summary, setSummary] = useState<OwnerOrdersMetricsSummary | null>(null);
  const [pagination, setPagination] = useState<OwnerOrdersPagination | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [page, setPage] = useState<number>(1);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load orders from backend API
  const fetchOrders = useCallback(async () => {
    if (!activeBranch) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await orderService.getOrders({
        page,
        limit: 20,
        branchId: activeBranch.id,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        paymentStatus: selectedPaymentStatus !== 'all' ? selectedPaymentStatus : undefined,
        search: debouncedSearch.trim() || undefined,
      });

      setOrders(res.orders);
      setSummary(res.summary);
      setPagination(res.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve orders from backend';
      setError(msg);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranch, page, selectedStatus, selectedPaymentStatus, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const handlePaymentFilterChange = (paymentStatus: string) => {
    setSelectedPaymentStatus(paymentStatus);
    setPage(1);
  };

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-badge-completed';
      case 'preparing':
        return 'status-badge-preparing';
      case 'served':
        return 'status-badge-served';
      case 'cancelled':
        return 'status-badge-cancelled';
      case 'pending':
      default:
        return 'status-badge-pending';
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="payment-badge-paid">Paid</span>;
      case 'pending':
        return <span className="payment-badge-pending">Pending</span>;
      case 'not_recorded':
      default:
        return <span className="payment-badge-not-recorded">Not recorded</span>;
    }
  };

  return (
    <div className="orders-page-container">
      {/* Sub-banner notice */}
      <div className="orders-subbanner">
        Live restaurant order operations & status lifecycle · Branch: {activeBranch?.name || 'Active Branch'}
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="orders-kpi-grid">
        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Total orders</span>
          <div className="orders-kpi-value">{summary ? summary.totalOrders.toLocaleString() : '0'}</div>
        </div>

        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Completed orders</span>
          <div className="orders-kpi-value" style={{ color: '#059669' }}>
            {summary ? summary.completedOrders.toLocaleString() : '0'}
          </div>
        </div>

        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Preparing & Served</span>
          <div className="orders-kpi-value" style={{ color: '#2563eb' }}>
            {summary ? (summary.preparingOrders + summary.servedOrders).toLocaleString() : '0'}
          </div>
        </div>

        <div className="card orders-kpi-card">
          <span className="orders-kpi-label">Cancelled orders</span>
          <div className="orders-kpi-value" style={{ color: '#dc2626' }}>
            {summary ? summary.cancelledOrders.toLocaleString() : '0'}
          </div>
        </div>
      </div>

      {/* Main Orders List Card */}
      <div className="card orders-table-card">
        <div className="card-header-clean" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title">Orders Management</h3>
            <div className="card-subtitle">
              Authoritative order state, branch-scoped tenant records, and live status lifecycle.
            </div>
          </div>
          <button
            type="button"
            className="filter-chip-btn"
            onClick={fetchOrders}
            title="Refresh order records"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="orders-filter-bar">
          <div className="filter-group-left">
            {/* Branch Selector */}
            <select
              className="filter-select"
              value={activeBranch?.id || ''}
              onChange={(e) => {
                const b = availableBranches.find((item) => item.id === e.target.value);
                if (b) {
                  setActiveBranch(b);
                  setPage(1);
                }
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
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <option value="all">All order statuses</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="served">Served</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Payment Status Selector */}
            <select
              className="filter-select"
              value={selectedPaymentStatus}
              onChange={(e) => handlePaymentFilterChange(e.target.value)}
            >
              <option value="all">All payment statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="not_recorded">Not recorded</option>
            </select>

            {/* Search Input */}
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search order number, customer or phone"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

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
              margin: '12px 0',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchOrders}
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
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Loading orders from backend...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: '#6b7280' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                      No orders found
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      {debouncedSearch || selectedStatus !== 'all' || selectedPaymentStatus !== 'all'
                        ? 'Try clearing active filters to see branch orders.'
                        : 'No orders have been placed under this branch yet.'}
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const dateObj = new Date(ord.orderedAt);
                  const timeFormatted = isNaN(dateObj.getTime())
                    ? ord.orderedAt
                    : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateFormatted = isNaN(dateObj.getTime())
                    ? ''
                    : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  const customerStr = ord.customer ? ord.customer.name : 'Walk-in Customer';
                  const tableStr = ord.table ? `Table ${ord.table.tableNumber}` : 'Takeaway / QR';
                  const customerTableStr = `${customerStr} · ${tableStr}`;

                  return (
                    <tr key={ord.id} className="orders-table-row">
                      <td className="cell-order-time">
                        <span className="order-num-text">{ord.orderNumber}</span>
                        <span className="order-time-text"> · {dateFormatted} {timeFormatted}</span>
                      </td>
                      <td className="cell-customer-table">{customerTableStr}</td>
                      <td className="cell-type" style={{ textTransform: 'capitalize' }}>
                        {ord.orderType.replace('_', ' ')}
                      </td>
                      <td className="cell-total">{formatCurrency(ord.pricing.totalAmount)}</td>
                      <td>
                        <span className={`status-pill ${getOrderStatusBadgeClass(ord.status)}`}>
                          {ord.status.charAt(0).toUpperCase() + ord.status.slice(1)}
                        </span>
                      </td>
                      <td className="cell-payment-status">
                        {getPaymentStatusBadge(ord.payment.status)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-view-detail"
                          onClick={() => navigate(`/dashboard/orders/${ord.id}`)}
                        >
                          View detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination */}
        <div className="orders-table-footer">
          <span className="footer-sample-note">
            {pagination
              ? `Showing page ${pagination.page} of ${pagination.totalPages || 1} (${pagination.totalCount} total orders)`
              : `Total ${orders.length} orders loaded`}
          </span>

          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn-load-more"
                disabled={!pagination.hasPrevPage || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ opacity: pagination.hasPrevPage ? 1 : 0.5, cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed' }}
              >
                <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} />
                <span>Previous</span>
              </button>
              <span style={{ fontSize: '12px', color: '#6b7280', padding: '0 4px' }}>
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                className="btn-load-more"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => setPage((p) => p + 1)}
                style={{ opacity: pagination.hasNextPage ? 1 : 0.5, cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed' }}
              >
                <span>Next</span>
                <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
