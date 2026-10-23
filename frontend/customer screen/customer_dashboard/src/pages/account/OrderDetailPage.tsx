import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  MessageSquareText,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchCustomerOrderDetail,
  CustomerOrderDetail,
} from '../../services/orderService';
import { ApiClientError } from '../../services/apiClient';
import { LoadingState } from '../../components/common/LoadingState';
import './OrderDetailPage.css';

function formatDateTime(dateStr: string | null | undefined): string {
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

export const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrderDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!orderId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const data = await fetchCustomerOrderDetail(orderId, signal);
        setOrder(data);
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || (err as { code?: string }).code === 'ABORTED')
        ) {
          return;
        }

        if (err instanceof ApiClientError && err.status === 404) {
          setNotFound(true);
        } else {
          const msg =
            err instanceof Error ? err.message : 'Unable to retrieve order details.';
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOrderDetail(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOrderDetail]);

  return (
    <div className="order-detail-shell">
      {/* Back Navigation Bar */}
      <div className="order-detail-top-nav">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate('/account/orders')}
        >
          <ArrowLeft size={16} />
          <span>Back to Order History</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="order-detail-loading-wrap" role="status" aria-live="polite">
          <LoadingState message="Loading order details and receipt..." />
        </div>
      )}

      {/* Safe 404 Not Found State */}
      {!loading && notFound && (
        <div className="order-not-found-card" role="alert">
          <div className="order-not-found-icon">
            <ShieldAlert size={36} />
          </div>
          <h2 className="order-not-found-title">Order Not Found</h2>
          <p className="order-not-found-desc">
            This order does not exist or does not belong to your account. For your security, orders placed by other guests cannot be accessed.
          </p>
          <button
            type="button"
            className="return-orders-btn"
            onClick={() => navigate('/account/orders')}
          >
            Return to Order History
          </button>
        </div>
      )}

      {/* General Error State */}
      {!loading && !notFound && error && (
        <div className="order-detail-error-card" role="alert">
          <div className="order-detail-error-icon">
            <AlertCircle size={26} />
          </div>
          <div className="order-detail-error-content">
            <h3 className="order-detail-error-title">Failed to load order</h3>
            <p className="order-detail-error-message">{error}</p>
          </div>
          <button
            type="button"
            className="order-detail-retry-btn"
            onClick={() => loadOrderDetail()}
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Order Content */}
      {!loading && !notFound && order && (
        <div className="order-detail-content">
          {/* Header Card */}
          <div className="order-detail-card order-detail-header-card">
            <div className="order-header-primary">
              <div className="venue-meta">
                <h1 className="order-venue-name">
                  {order.restaurantName || 'Partner Restaurant'}
                </h1>
                <div className="order-venue-sub">
                  {order.branchName && (
                    <span className="venue-sub-tag">{order.branchName}</span>
                  )}
                  {order.table?.tableNumber && (
                    <span className="venue-sub-tag">Table {order.table.tableNumber}</span>
                  )}
                  <span className="venue-sub-tag order-type-tag">
                    {order.orderType || 'Dine-In'}
                  </span>
                </div>
              </div>

              <div className="order-header-status-badge">
                <span className={`status-pill ${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
              </div>
            </div>

            <div className="order-info-strip">
              <div className="info-block">
                <span className="info-label">Order Number</span>
                <span className="info-val">#{order.orderNumber}</span>
              </div>
              <div className="info-block">
                <span className="info-label">Placed At</span>
                <span className="info-val">{formatDateTime(order.orderedAt)}</span>
              </div>
              {order.completedAt && (
                <div className="info-block">
                  <span className="info-label">Completed At</span>
                  <span className="info-val">{formatDateTime(order.completedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Progression Timeline (if available) */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="order-detail-card">
              <h2 className="section-heading-sm">Order Progress</h2>
              <div className="status-timeline">
                {order.statusHistory.map((step, idx) => (
                  <div key={idx} className="timeline-step">
                    <div className="timeline-dot-wrap">
                      <div className="timeline-dot" />
                      {idx < order.statusHistory.length - 1 && (
                        <div className="timeline-line" />
                      )}
                    </div>
                    <div className="timeline-step-content">
                      <div className="step-status-row">
                        <span className="step-status-name">{step.status}</span>
                        <span className="step-timestamp">
                          {formatDateTime(step.changedAt)}
                        </span>
                      </div>
                      {step.notes && <p className="step-notes">{step.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itemized Order Receipt */}
          <div className="order-detail-card">
            <h2 className="section-heading-sm">Itemized Receipt</h2>
            <div className="items-table-wrap">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="item-row">
                      <td className="item-details-col">
                        <div className="item-primary-name">{item.productName}</div>
                        {item.variantName && (
                          <div className="item-variant-label">
                            Variant: {item.variantName}
                          </div>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="item-addons-list">
                            {item.addons.map((addon) => (
                              <span key={addon.id} className="addon-tag">
                                + {addon.addonName} (₹{addon.unitPriceFormatted})
                              </span>
                            ))}
                          </div>
                        )}
                        {item.specialInstructions && (
                          <div className="item-instructions">
                            Note: {item.specialInstructions}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }} className="item-qty-col">
                        {item.quantity}
                      </td>
                      <td style={{ textAlign: 'right' }} className="item-unit-col">
                        ₹{item.unitPriceFormatted}
                      </td>
                      <td style={{ textAlign: 'right' }} className="item-total-col">
                        ₹{item.totalPriceFormatted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary Breakdown */}
            <div className="pricing-breakdown-card">
              <div className="pricing-row">
                <span className="pricing-label">Subtotal</span>
                <span className="pricing-val">₹{order.pricing.subtotalFormatted}</span>
              </div>

              {order.pricing.discountAmount > 0 && (
                <div className="pricing-row discount-row">
                  <span className="pricing-label">Coupon Discount</span>
                  <span className="pricing-val">
                    -₹{order.pricing.discountAmountFormatted}
                  </span>
                </div>
              )}

              {order.pricing.loyaltyDiscountAmount > 0 && (
                <div className="pricing-row discount-row">
                  <span className="pricing-label">Loyalty Points Redeemed</span>
                  <span className="pricing-val">
                    -₹{order.pricing.loyaltyDiscountAmountFormatted}
                  </span>
                </div>
              )}

              <div className="pricing-row">
                <span className="pricing-label">Taxes & Charges</span>
                <span className="pricing-val">₹{order.pricing.taxAmountFormatted}</span>
              </div>

              <div className="pricing-row total-row">
                <span className="pricing-label">Grand Total</span>
                <span className="pricing-val">₹{order.pricing.totalAmountFormatted}</span>
              </div>
            </div>
          </div>

          {/* Customer Notes */}
          {order.notes && (
            <div className="order-detail-card">
              <h2 className="section-heading-sm">Special Order Instructions</h2>
              <p className="order-notes-text">{order.notes}</p>
            </div>
          )}

          {/* Action Strip */}
          {order.status.toLowerCase() === 'completed' && (
            <div className="order-detail-card action-strip-card">
              <div className="action-strip-content">
                <h3 className="action-strip-title">How was your dining experience?</h3>
                <p className="action-strip-desc">
                  Share your review for this visit to help other diners and earn loyalty rewards.
                </p>
              </div>
              <button
                type="button"
                className="review-order-cta-btn"
                onClick={() => navigate(`/account/feedback?orderId=${encodeURIComponent(order.id)}`)}
              >
                <MessageSquareText size={16} />
                <span>Submit Dining Review</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
