import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  MessageSquareText,
} from 'lucide-react';
import {
  fetchCustomerOrders,
  CustomerOrderHistoryItem,
  CustomerOrderPaginationMeta,
  CustomerOrderSummaryAggregate,
  CustomerOrderStatus,
  CustomerFeedbackFilterStatus,
} from '../../services/orderService';
import { LoadingState } from '../../components/common/LoadingState';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './OrdersHistoryPage.css';

function formatOrderDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getStatusBadgeClass(status: CustomerOrderStatus): string {
  switch (status) {
    case 'completed':
      return 'status-badge-completed';
    case 'served':
      return 'status-badge-served';
    case 'preparing':
      return 'status-badge-preparing';
    case 'pending':
      return 'status-badge-pending';
    case 'cancelled':
      return 'status-badge-cancelled';
    default:
      return 'status-badge-default';
  }
}

function getStatusLabel(status: CustomerOrderStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'served':
      return 'Served';
    case 'preparing':
      return 'Preparing';
    case 'pending':
      return 'Order Placed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export const OrdersHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dataVersion } = useCustomerAuth();

  // Filters from URL search params or defaults
  const initialStatus = (searchParams.get('status') as CustomerOrderStatus) || 'all';
  const initialFeedback =
    (searchParams.get('feedbackStatus') as CustomerFeedbackFilterStatus) || 'all';
  const restaurantParam = searchParams.get('restaurantId') || undefined;

  const [statusFilter, setStatusFilter] = useState<CustomerOrderStatus | 'all'>(
    ['pending', 'preparing', 'served', 'completed', 'cancelled'].includes(initialStatus)
      ? initialStatus
      : 'all'
  );
  const [feedbackFilter, setFeedbackFilter] = useState<
    CustomerFeedbackFilterStatus | 'all'
  >(
    ['awaiting_review', 'reviewed'].includes(initialFeedback)
      ? initialFeedback
      : 'all'
  );

  // Data state
  const [orders, setOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [pagination, setPagination] = useState<CustomerOrderPaginationMeta | null>(null);
  const [summary, setSummary] = useState<CustomerOrderSummaryAggregate | null>(null);

  // Loading and Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track active request controller to prevent stale overwrites
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadOrders = useCallback(
    async (isPagination = false, cursor?: string | null) => {
      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isPagination) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const queryParams = {
          limit: 10,
          cursor: cursor || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          feedbackStatus: feedbackFilter === 'all' ? undefined : feedbackFilter,
          restaurantId: restaurantParam,
        };

        const res = await fetchCustomerOrders(queryParams, controller.signal);

        setSummary(res.summary);
        setPagination(res.pagination);

        if (isPagination) {
          // Append with deduplication by ID
          setOrders((prev) => {
            const seen = new Set(prev.map((o) => o.id));
            const fresh = res.orders.filter((o) => !seen.has(o.id));
            return [...prev, ...fresh];
          });
        } else {
          setOrders(res.orders);
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || (err as { code?: string }).code === 'ABORTED')
        ) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Unable to load order history.';
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, feedbackFilter, restaurantParam]
  );

  useEffect(() => {
    loadOrders(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadOrders, dataVersion]);

  const handleStatusFilterChange = (status: CustomerOrderStatus | 'all') => {
    setStatusFilter(status);
    const newParams = new URLSearchParams(searchParams);
    if (status === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', status);
    }
    setSearchParams(newParams);
  };

  const handleFeedbackFilterChange = (fb: CustomerFeedbackFilterStatus | 'all') => {
    setFeedbackFilter(fb);
    const newParams = new URLSearchParams(searchParams);
    if (fb === 'all') {
      newParams.delete('feedbackStatus');
    } else {
      newParams.set('feedbackStatus', fb);
    }
    setSearchParams(newParams);
  };

  const handleLoadMore = () => {
    if (pagination?.hasNextPage && pagination?.nextCursor && !loadingMore) {
      loadOrders(true, pagination.nextCursor);
    }
  };

  return (
    <div className="orders-page-shell">
      {/* Header */}
      <header className="orders-page-header">
        <div>
          <h1 className="orders-page-title">Order History</h1>
          <p className="orders-page-subtitle">
            View all past dining visits, inspect itemized receipts, and check review eligibility.
          </p>
        </div>
      </header>

      {/* Lifetime Summary Aggregates */}
      {summary && (
        <section className="orders-metrics-row" aria-label="Orders Lifetime Summary">
          <div className="metric-pill">
            <span className="metric-label">Total Visits</span>
            <span className="metric-val">{summary.totalOrders}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Completed</span>
            <span className="metric-val text-emerald">{summary.completed}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Active / In Progress</span>
            <span className="metric-val text-blue">
              {summary.pending + summary.preparing + summary.served}
            </span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Cancelled</span>
            <span className="metric-val text-red">{summary.cancelled}</span>
          </div>
        </section>
      )}

      {/* Filters Section */}
      <section className="orders-filter-bar" aria-label="Order Filters">
        <div className="status-tabs" role="tablist">
          <button
            type="button"
            className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleStatusFilterChange('all')}
          >
            All Orders
          </button>
          <button
            type="button"
            className={`status-tab ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => handleStatusFilterChange('completed')}
          >
            Completed
          </button>
          <button
            type="button"
            className={`status-tab ${
              statusFilter === 'preparing' || statusFilter === 'served' || statusFilter === 'pending'
                ? 'active'
                : ''
            }`}
            onClick={() => handleStatusFilterChange('preparing')}
          >
            In Kitchen / Active
          </button>
          <button
            type="button"
            className={`status-tab ${statusFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => handleStatusFilterChange('cancelled')}
          >
            Cancelled
          </button>
        </div>

        {/* Feedback filter toggle */}
        <div className="feedback-filter-wrap">
          <select
            className="feedback-filter-select"
            value={feedbackFilter}
            onChange={(e) =>
              handleFeedbackFilterChange(e.target.value as CustomerFeedbackFilterStatus | 'all')
            }
            aria-label="Filter by review status"
          >
            <option value="all">All Feedback Statuses</option>
            <option value="awaiting_review">Awaiting Review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </section>

      {/* Loading Initial State */}
      {loading && orders.length === 0 && (
        <div className="orders-loading-wrap" role="status" aria-live="polite">
          <LoadingState message="Retrieving your order history..." />
        </div>
      )}

      {/* Recoverable Error State */}
      {error && orders.length === 0 && (
        <div className="orders-error-card" role="alert">
          <div className="orders-error-icon">
            <AlertCircle size={26} />
          </div>
          <div className="orders-error-content">
            <h3 className="orders-error-title">Unable to load order history</h3>
            <p className="orders-error-message">{error}</p>
          </div>
          <button
            type="button"
            className="orders-retry-btn"
            onClick={() => loadOrders(false)}
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && orders.length === 0 && (
        <div className="orders-empty-card">
          <div className="orders-empty-icon-wrap">
            <Receipt size={32} />
          </div>
          <h3 className="orders-empty-title">No orders found</h3>
          <p className="orders-empty-desc">
            {statusFilter !== 'all' || feedbackFilter !== 'all'
              ? 'No orders match your selected filters. Try clearing your filters.'
              : 'When you dine at a partner restaurant and place an order using your phone number, your itemized receipts will appear here.'}
          </p>
          {(statusFilter !== 'all' || feedbackFilter !== 'all') && (
            <button
              type="button"
              className="orders-clear-filters-btn"
              onClick={() => {
                setStatusFilter('all');
                setFeedbackFilter('all');
                setSearchParams({});
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Order Cards List */}
      {orders.length > 0 && (
        <div className="orders-list-grid">
          {orders.map((order) => (
            <article key={order.id} className="order-history-card">
              {/* Card Header */}
              <div className="order-card-header">
                <div className="order-header-left">
                  <div className="order-restaurant-row">
                    <span className="order-restaurant-name">
                      {order.restaurant?.name || 'Partner Restaurant'}
                    </span>
                    {order.branch?.name && (
                      <span className="order-branch-tag">{order.branch.name}</span>
                    )}
                    {order.table?.tableNumber && (
                      <span className="order-table-tag">Table {order.table.tableNumber}</span>
                    )}
                  </div>
                  <div className="order-meta-subrow">
                    <span className="order-number-pill">#{order.orderNumber}</span>
                    <span className="order-datetime">
                      <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {formatOrderDateTime(order.orderedAt)}
                    </span>
                  </div>
                </div>

                <div className="order-header-right">
                  <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="order-card-body">
                <div className="order-items-preview">
                  {order.itemsSummary.length > 0 ? (
                    <ul className="order-items-list">
                      {order.itemsSummary.map((item) => (
                        <li key={item.id} className="order-item-row">
                          <span className="item-qty-name">
                            <strong className="item-qty">{item.quantity}×</strong>{' '}
                            {item.productName}
                          </span>
                          <span className="item-price">₹{item.totalPriceFormatted}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="order-items-placeholder">
                      {order.itemCount} items ordered
                    </div>
                  )}
                </div>

                {/* Bill Breakdown Mini Summary */}
                <div className="order-bill-summary-bar">
                  <div className="bill-total-block">
                    <span className="bill-total-label">Total Amount</span>
                    <span className="bill-total-val">₹{order.pricing.totalAmountFormatted}</span>
                  </div>

                  {order.pricing.discountAmount > 0 && (
                    <div className="bill-discount-tag">
                      Saved ₹{order.pricing.discountAmountFormatted}
                    </div>
                  )}

                  <span
                    className={`payment-pill ${
                      order.paymentStatus === 'paid' ? 'paid' : 'pending'
                    }`}
                  >
                    {order.paymentStatus === 'paid' ? 'Paid' : 'Payment Pending'}
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="order-card-footer">
                <div className="footer-feedback-status">
                  {order.status === 'completed' && (
                    order.hasFeedback ? (
                      <span className="feedback-done-tag">
                        <CheckCircle2 size={13} />
                        <span>Reviewed</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-feedback-action"
                        onClick={() =>
                          navigate(
                            `/account/feedback?orderId=${encodeURIComponent(
                              order.id
                            )}&restaurant=${encodeURIComponent(
                              order.restaurant?.id || ''
                            )}`
                          )
                        }
                      >
                        <MessageSquareText size={13} />
                        <span>Review Order</span>
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="order-detail-btn"
                  onClick={() => navigate(`/account/orders/${encodeURIComponent(order.id)}`)}
                >
                  <span>View Details</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination Load More Button */}
      {pagination?.hasNextPage && (
        <div className="orders-pagination-wrap">
          <button
            type="button"
            className="orders-load-more-btn"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <RefreshCw size={14} className="spin-icon" />
                <span>Loading more orders...</span>
              </>
            ) : (
              <>
                <span>Load More Orders</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
