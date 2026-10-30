import React, { useState, useEffect, useCallback } from 'react';
import { Check, Receipt, MapPin, LayoutGrid, Clock, ChefHat, UtensilsCrossed, Star, Gift, RefreshCw, ShoppingBag, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../hooks/useAppContext';
import { fetchOrderById, extractStoredOrderId, type CustomerOrder } from '../../services/orderService';
import { ApiClientError } from '../../services/apiClient';
import './OrderConfirmationScreen.css';

/**
 * Screen 08: Order Confirmation & Live Tracking
 * Displays server-confirmed order status, item details, and feedback CTA.
 * Uses real backend GET /api/v1/customer/orders/[orderId]; never creates an order on refresh.
 */
export const OrderConfirmationScreen: React.FC = () => {
  const { activeOrderId: contextOrderId, latestOrder, restaurant, navigateTo, setActiveOrderId } = useApp();
  const activeOrderId = contextOrderId || extractStoredOrderId();

  useEffect(() => {
    if (activeOrderId && !contextOrderId) {
      setActiveOrderId(activeOrderId);
    }
  }, [activeOrderId, contextOrderId, setActiveOrderId]);

  const [order, setOrder] = useState<CustomerOrder | null>(() => {
    if (latestOrder && (!activeOrderId || latestOrder.id === activeOrderId)) {
      return latestOrder;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(!order && Boolean(activeOrderId));
  const [error, setError] = useState<string | null>(null);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState<boolean>(false);

  // Trigger celebration confetti once when confirmed order loads
  useEffect(() => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.18 },
        colors: ['#22C55E', '#174A82', '#D7B67C', '#F97316', '#38BDF8'],
      });
    } catch {
      // Confetti is decorative; ignore environments where not supported
    }
  }, []);

  // Fetch verified order details from backend
  const loadOrder = useCallback(async () => {
    if (!activeOrderId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchOrderById(activeOrderId);
      setOrder(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || 'Could not load order details.');
      } else {
        setError('Network error loading order details.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrderId]);

  useEffect(() => {
    if (activeOrderId && (!order || order.id !== activeOrderId)) {
      loadOrder();
    }
  }, [activeOrderId, order, loadOrder]);

  // Show feedback popup when order status reaches completed
  useEffect(() => {
    if (order?.status === 'completed') {
      const timer = setTimeout(() => setShowFeedbackPopup(true), 600);
      return () => clearTimeout(timer);
    }
  }, [order?.status]);

  const handleLeaveFeedback = () => {
    setShowFeedbackPopup(false);
    if (order) {
      navigateTo('feedback', { orderId: order.id });
    }
  };

  const handleDismissPopup = () => {
    setShowFeedbackPopup(false);
  };

  // Format order timestamp nicely
  const formattedOrderedAt = React.useMemo(() => {
    if (!order?.orderedAt) return '';
    try {
      const d = new Date(order.orderedAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      // fallback
    }
    return order.orderedAt;
  }, [order?.orderedAt]);

  // Steps in the order journey matching backend status
  const steps: { status: string; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      status: 'pending',
      label: 'Order Placed',
      sublabel: 'Received and awaiting kitchen acceptance',
      icon: <Receipt size={18} />,
    },
    {
      status: 'preparing',
      label: 'In Kitchen',
      sublabel: 'Being freshly prepared by our chefs',
      icon: <ChefHat size={18} />,
    },
    {
      status: 'served',
      label: 'Served to Table',
      sublabel: 'Delivered to your table. Enjoy your meal!',
      icon: <UtensilsCrossed size={18} />,
    },
    {
      status: 'completed',
      label: 'Order Completed',
      sublabel: 'Payment settled. We hope you loved your visit!',
      icon: <Star size={18} />,
    },
  ];

  function getStepIndex(s?: string): number {
    if (!s) return -1;
    switch (s) {
      case 'pending':
        return 0;
      case 'preparing':
        return 1;
      case 'served':
        return 2;
      case 'completed':
        return 3;
      default:
        return -1;
    }
  }

  const activeStepIndex = getStepIndex(order?.status);
  const isCancelled = order?.status === 'cancelled';
  const isKnownStatus = ['pending', 'preparing', 'served', 'completed', 'cancelled'].includes(order?.status || '');

  // If no order and not loading, show neutral state
  if (!activeOrderId && !order) {
    return (
      <div className="confirmation-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <ShoppingBag size={48} strokeWidth={1.5} color="var(--brand-primary, #174A82)" style={{ margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>No Active Order</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-text-color, #666)', marginBottom: '24px' }}>
          You don't have an active order being tracked right now.
        </p>
        <button
          onClick={() => navigateTo('menu')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'var(--brand-primary, #174A82)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Explore Menu
        </button>
      </div>
    );
  }

  // Loading state
  if (loading && !order) {
    return (
      <div className="confirmation-page" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div className="spinner-ring" style={{ width: '36px', height: '36px', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Loading order details...</h2>
      </div>
    );
  }

  // Error state
  if (error && !order) {
    return (
      <div className="confirmation-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <AlertCircle size={44} color="#dc2626" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Unable to Load Order</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={loadOrder}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: 'var(--brand-primary, #174A82)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <RefreshCw size={16} />
          Retry Loading
        </button>
      </div>
    );
  }

  const currency = order?.pricing.currency === 'INR' ? '₹' : (order?.pricing.currency || '₹');

  return (
    <div className="confirmation-page">
      {/* Hero Section */}
      <section className="confirmation-hero" aria-label="Order Placed">
        <div className="check-badge-wrapper">
          <div className={isCancelled ? 'check-circle-red' : 'check-circle-green'}>
            {isCancelled ? <AlertCircle size={44} strokeWidth={2.5} /> : <Check size={44} strokeWidth={3.5} />}
          </div>
        </div>
        <h1 className="confirmation-title">
          {order?.status === 'completed'
            ? 'Order Completed!'
            : order?.status === 'served'
            ? 'Order Served to Table!'
            : isCancelled
            ? 'Order Cancelled'
            : !isKnownStatus
            ? `Order Status: ${order?.status || 'Active'}`
            : 'Order Placed Successfully!'}
        </h1>
        <p className="confirmation-subtitle">
          {order?.status === 'pending' && 'Waiting for the restaurant kitchen to accept your order.'}
          {order?.status === 'preparing' && 'Great news! Your order is being freshly prepared in the kitchen.'}
          {order?.status === 'served' && 'Your food has been delivered to your table. Enjoy your meal!'}
          {order?.status === 'completed' && 'Your visit is complete. We hope you loved your meal!'}
          {isCancelled && 'This order has been cancelled by the restaurant.'}
          {!isKnownStatus && order?.status && `Order is currently in ${order.status} state.`}
        </p>
      </section>

      {/* Order Details Card */}
      <section className="order-details-card" aria-label="Order Details">
        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><Receipt size={20} /></div>
          <div className="order-row-content">
            <div className="order-row-header">
              <span className="order-row-label">Order Number</span>
              <span className="order-row-value-bold">{order?.orderNumber || ''}</span>
            </div>
          </div>
        </div>

        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><MapPin size={20} /></div>
          <div className="order-row-content">
            <span className="order-row-label">Restaurant</span>
            <span className="order-row-value">
              {order?.restaurantName || restaurant?.name || 'Restaurant'}
              {order?.branchName ? ` (${order.branchName})` : ''}
            </span>
          </div>
        </div>

        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><LayoutGrid size={20} /></div>
          <div className="order-row-content">
            <span className="order-row-label">Table</span>
            <span className="order-row-value">
              {order?.table?.tableNumber || restaurant?.tableNumber || restaurant?.tableLabel || 'Dining Table'}
            </span>
          </div>
        </div>

        {formattedOrderedAt && (
          <div className="order-detail-row">
            <div className="order-row-icon-wrap"><Clock size={20} /></div>
            <div className="order-row-content">
              <span className="order-row-label">Ordered At</span>
              <span className="order-row-value">{formattedOrderedAt}</span>
            </div>
          </div>
        )}

        {order?.pricing && (
          <div className="order-detail-row">
            <div className="order-row-icon-wrap"><Check size={20} /></div>
            <div className="order-row-content">
              <div className="order-row-header">
                <span className="order-row-label">Total Amount</span>
                <span className="order-row-value-bold" style={{ color: 'var(--brand-primary, #174A82)' }}>
                  {currency} {order.pricing.totalAmountFormatted}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---- Live Status Tracker or Cancelled Notice ---- */}
      {isCancelled ? (
        <section className="order-tracker-card" aria-label="Order Cancelled" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
          <div className="tracker-header">
            <span className="tracker-label" style={{ color: '#b91c1c' }}>Order Cancelled</span>
            <span className="tracker-live-dot" style={{ backgroundColor: '#ef4444' }} />
          </div>
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '14.5px', color: '#7f1d1d', fontWeight: 600 }}>
              This order was cancelled by the restaurant
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>
              No payment has been charged. Please contact floor staff or browse the menu to order again.
            </p>
          </div>
        </section>
      ) : !isKnownStatus ? (
        <section className="order-tracker-card" aria-label="Order Status">
          <div className="tracker-header">
            <span className="tracker-label">Order Status</span>
            <button
              onClick={loadOrder}
              disabled={loading}
              title="Refresh status"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary, #174A82)', display: 'flex', padding: '2px' }}
            >
              <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            </button>
          </div>
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-text-color, #666)' }}>
              Current state: <strong>{order?.status || 'Unknown'}</strong>
            </p>
          </div>
        </section>
      ) : (
        <section className="order-tracker-card" aria-label="Order Status">
          <div className="tracker-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="tracker-label">Live Order Status</span>
              <button
                onClick={loadOrder}
                disabled={loading}
                title="Refresh status"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary, #174A82)', display: 'flex', padding: '2px' }}
              >
                <RefreshCw size={13} className={loading ? 'spinning' : ''} />
              </button>
            </div>
            <span className={`tracker-live-dot ${order?.status !== 'completed' ? 'pulsing' : 'done'}`} />
          </div>

          <div className="tracker-steps">
            {steps.map((step, idx) => {
              const isCompleted = activeStepIndex > idx;
              const isActive = activeStepIndex === idx;
              const isPending = activeStepIndex < idx;

              return (
                <React.Fragment key={step.status}>
                  <div className={`tracker-step ${isCompleted ? 'step-completed' : ''} ${isActive ? 'step-active' : ''} ${isPending ? 'step-pending' : ''}`}>
                    <div className="step-icon-wrap">
                      <div className="step-icon-circle">
                        {isCompleted ? <Check size={16} strokeWidth={3} /> : step.icon}
                      </div>
                      {isActive && <div className="step-active-ring" />}
                    </div>
                    <div className="step-info">
                      <span className="step-label">{step.label}</span>
                      <span className="step-sublabel">{step.sublabel}</span>
                    </div>
                    {isActive && order?.status !== 'completed' && (
                      <div className="step-spinner">
                        <div className="spinner-ring" />
                      </div>
                    )}
                    {isCompleted && (
                      <div className="step-check-badge"><Check size={12} strokeWidth={3} /></div>
                    )}
                    {isActive && order?.status === 'completed' && (
                      <div className="step-check-badge step-check-gold"><Star size={12} strokeWidth={2.5} /></div>
                    )}
                  </div>

                  {idx < steps.length - 1 && (
                    <div className={`tracker-connector ${activeStepIndex > idx ? 'connector-done' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </section>
      )}

      {/* Action Buttons */}
      <footer className="confirmation-actions">
        {order?.status === 'completed' ? (
          <button className="track-order-btn" onClick={handleLeaveFeedback}>
            <Star size={18} style={{ marginRight: '8px' }} />
            Leave Feedback & Earn Loyalty
          </button>
        ) : isCancelled ? (
          <button className="track-order-btn" onClick={() => navigateTo('menu')}>
            Order Another Meal
          </button>
        ) : (
          <button className="track-order-btn btn-waiting" onClick={loadOrder} disabled={loading}>
            <div className="btn-pulse-dot" />
            {loading ? 'Refreshing Status...' : 'Waiting for Updates (Tap to Refresh)'}
          </button>
        )}
        <button className="back-to-menu-btn" onClick={() => navigateTo('menu')}>
          Back to Menu
        </button>
      </footer>

      {/* Post-completion Feedback Popup */}
      {showFeedbackPopup && (
        <div className="feedback-popup-overlay" role="dialog" aria-modal="true" aria-label="Leave feedback">
          <div className="feedback-popup-modal">
            <div className="popup-top-gradient" />
            <div className="popup-icon-row">
              <div className="popup-emoji-badge">🍽️</div>
            </div>

            <h2 className="popup-title">Hope you enjoyed your meal!</h2>
            <p className="popup-subtitle">
              Share your dining feedback and earn <strong>loyalty rewards</strong>!
            </p>

            <div className="popup-loyalty-chip">
              <Gift size={15} />
              <span>Earn loyalty points for reviewing</span>
            </div>

            <div className="popup-actions">
              <button className="popup-feedback-btn" onClick={handleLeaveFeedback}>
                <Star size={16} />
                Leave Feedback
              </button>
              <button className="popup-dismiss-btn" onClick={handleDismissPopup}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
