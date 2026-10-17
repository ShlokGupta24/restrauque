import React, { useState, useEffect } from 'react';
import { Check, Receipt, MapPin, LayoutGrid, Clock, ChefHat, UtensilsCrossed, Star, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { OrderConfirmationDetails, OrderStatus } from '../../services/contracts/types';
import { mockDefaultOrder } from '../../mocks/order.mock';
import './OrderConfirmationScreen.css';

/**
 * Screen 08: Order Confirmation & Live Tracking
 * Redesigned with step-by-step status tracker and post-completion feedback popup.
 */
export const OrderConfirmationScreen: React.FC = () => {
  const { activeOrderId, restaurant, navigateTo } = useApp();

  const [order, setOrder] = useState<OrderConfirmationDetails>(mockDefaultOrder);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('pending');
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  // Trigger celebration confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.18 },
        colors: ['#22C55E', '#174A82', '#D7B67C', '#F97316', '#38BDF8'],
      });
    } catch (e) {
      console.warn('Confetti animation skipped', e);
    }
  }, []);

  // Fetch actual order status
  useEffect(() => {
    async function loadOrder() {
      if (activeOrderId) {
        try {
          const res = await customerDataService.getOrderStatus(activeOrderId);
          if (res) {
            setOrder(res);
            setCurrentStatus(res.status);
          }
        } catch (err) {
          console.error('Failed to load order status:', err);
        }
      }
    }
    loadOrder();
  }, [activeOrderId]);

  // Show feedback popup when order becomes completed
  useEffect(() => {
    if (currentStatus === 'completed') {
      const timer = setTimeout(() => setShowFeedbackPopup(true), 600);
      return () => clearTimeout(timer);
    }
  }, [currentStatus]);

  /**
   * Steps in the order journey.
   * The status pipeline: pending → preparing → completed
   * (ready / served are intermediate; we map them all cleanly)
   */
  const steps: { status: OrderStatus; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      status: 'pending',
      label: 'Order Placed',
      sublabel: 'Waiting for restaurant to accept',
      icon: <Receipt size={18} />,
    },
    {
      status: 'preparing',
      label: 'Order Accepted',
      sublabel: 'Being freshly prepared in the kitchen',
      icon: <ChefHat size={18} />,
    },
    {
      status: 'completed',
      label: 'Order Completed',
      sublabel: 'Your meal is ready. Enjoy!',
      icon: <UtensilsCrossed size={18} />,
    },
  ];

  const statusOrder: OrderStatus[] = ['pending', 'preparing', 'ready', 'served', 'completed'];

  function getStepIndex(s: OrderStatus): number {
    // Map pipeline to the 3 visual steps
    if (s === 'pending') return 0;
    if (s === 'preparing' || s === 'ready' || s === 'served') return 1;
    if (s === 'completed') return 2;
    return 0;
  }

  const activeStepIndex = getStepIndex(currentStatus);

  const handleLeaveFeedback = () => {
    setShowFeedbackPopup(false);
    navigateTo('feedback', { orderId: order.orderId });
  };

  const handleDismissPopup = () => {
    setShowFeedbackPopup(false);
  };

  // --- Simulate status progression (for dev/demo) ---
  const handleSimulateNext = () => {
    const idx = statusOrder.indexOf(currentStatus);
    if (idx < statusOrder.length - 1) {
      const next = statusOrder[idx + 1];
      setCurrentStatus(next);
      setOrder((prev) => ({ ...prev, status: next }));
    }
  };

  return (
    <div className="confirmation-page">
      {/* Hero Section */}
      <section className="confirmation-hero" aria-label="Order Placed">
        <div className="check-badge-wrapper">
          <div className="check-circle-green">
            <Check size={44} strokeWidth={3.5} />
          </div>
        </div>
        <h1 className="confirmation-title">Order Placed Successfully!</h1>
        <p className="confirmation-subtitle">
          {currentStatus === 'pending' && 'Waiting for the restaurant to accept your order.'}
          {(currentStatus === 'preparing' || currentStatus === 'ready' || currentStatus === 'served') &&
            'Great news! Your order has been accepted and is being prepared.'}
          {currentStatus === 'completed' && 'Your order is complete. We hope you loved it!'}
        </p>
      </section>

      {/* Order Details Card */}
      <section className="order-details-card" aria-label="Order Details">
        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><Receipt size={20} /></div>
          <div className="order-row-content">
            <div className="order-row-header">
              <span className="order-row-label">Order Number</span>
              <span className="order-row-value-bold">{order.orderNumber || '#NBC1234'}</span>
            </div>
          </div>
        </div>
        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><MapPin size={20} /></div>
          <div className="order-row-content">
            <span className="order-row-label">Restaurant</span>
            <span className="order-row-value">{restaurant?.name || order.restaurantName || 'NBC - Engineering College'}</span>
          </div>
        </div>
        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><LayoutGrid size={20} /></div>
          <div className="order-row-content">
            <span className="order-row-label">Table</span>
            <span className="order-row-value">{restaurant?.tableLabel?.replace(/Table\s*/i, '') || 'F18'}</span>
          </div>
        </div>
        <div className="order-detail-row">
          <div className="order-row-icon-wrap"><Clock size={20} /></div>
          <div className="order-row-content">
            <span className="order-row-label">Ordered At</span>
            <span className="order-row-value">{order.orderedAt || '12 Dec 2024, 1:24 PM'}</span>
          </div>
        </div>
      </section>

      {/* ---- Live Status Tracker ---- */}
      <section className="order-tracker-card" aria-label="Order Status">
        <div className="tracker-header">
          <span className="tracker-label">Live Order Status</span>
          <span className={`tracker-live-dot ${currentStatus !== 'completed' ? 'pulsing' : 'done'}`} />
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
                  {isActive && currentStatus !== 'completed' && (
                    <div className="step-spinner">
                      <div className="spinner-ring" />
                    </div>
                  )}
                  {isCompleted && (
                    <div className="step-check-badge"><Check size={12} strokeWidth={3} /></div>
                  )}
                  {isActive && currentStatus === 'completed' && (
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

        {/* Dev simulator button — remove in production */}
        {currentStatus !== 'completed' && (
          <button className="status-advance-btn" onClick={handleSimulateNext} title="Simulate order progression">
            Simulate Next Status
          </button>
        )}
      </section>

      {/* Action Buttons */}
      <footer className="confirmation-actions">
        {currentStatus === 'completed' ? (
          <button className="track-order-btn" onClick={handleLeaveFeedback}>
            <Star size={18} style={{ marginRight: '8px' }} />
            Leave Feedback
          </button>
        ) : (
          <button className="track-order-btn btn-waiting" disabled>
            <div className="btn-pulse-dot" />
            Waiting for Update...
          </button>
        )}
        <button className="back-to-menu-btn" onClick={() => navigateTo('menu')}>
          Back to Menu
        </button>
      </footer>

      {/* ---- Post-completion Feedback Popup ---- */}
      {showFeedbackPopup && (
        <div className="feedback-popup-overlay" role="dialog" aria-modal="true" aria-label="Leave feedback">
          <div className="feedback-popup-modal">
            {/* Decorative top gradient */}
            <div className="popup-top-gradient" />

            <div className="popup-icon-row">
              <div className="popup-emoji-badge">🍽️</div>
            </div>

            <h2 className="popup-title">Hope you enjoyed your meal!</h2>
            <p className="popup-subtitle">
              After eating, share your experience and earn <strong>loyalty points</strong> — every review counts!
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
