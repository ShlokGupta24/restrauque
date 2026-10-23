import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, MapPin, Check, Store, ArrowRight, Menu, AlertCircle, RefreshCw, ShoppingBag } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import {
  submitOrder,
  generateIdempotencyKey,
  type CreateOrderRequest,
  getPendingOrderAttempt,
  storePendingOrderAttempt,
  clearPendingOrderAttempt,
} from '../../services/orderService';
import { mapCartToPreviewItems } from '../../services/orderPreviewService';
import { ApiClientError } from '../../services/apiClient';
import './PaymentOrderSummaryScreen.css';

/**
 * Screen 07: Payment & Order Summary
 * Visual reference: UIUX/07-payment-order-summary.png
 *
 * Implements real backend order creation with client-side idempotency protection,
 * payload freezing, expectedTotal verification, and safe retry on ambiguous failures.
 */
export const PaymentOrderSummaryScreen: React.FC = () => {
  const {
    restaurant,
    activeQrToken,
    cart,
    bill,
    couponCode,
    orderQuote,
    isQuoteLoading,
    refreshOrderPreview,
    auth,
    clearCart,
    setActiveOrderId,
    setLatestOrder,
    navigateTo,
    goBack,
    openNav,
  } = useApp();

  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAmbiguousError, setIsAmbiguousError] = useState<boolean>(false);
  const [isPriceChanged, setIsPriceChanged] = useState<boolean>(false);
  const [selectedPayment] = useState<string>('Pay at Restaurant');

  // Preserve in-flight attempt payload & idempotency key across retries of the same attempt
  const inFlightAttemptRef = useRef<{
    idempotencyKey: string;
    payload: CreateOrderRequest;
  } | null>(null);

  // Restore any pending ambiguous attempt across browser reloads
  useEffect(() => {
    const attempt = getPendingOrderAttempt({
      userId: auth.userId,
      qrToken: activeQrToken || undefined,
      restaurantId: restaurant?.id,
    });
    if (attempt) {
      inFlightAttemptRef.current = attempt;
      setIsAmbiguousError(true);
      setSubmitError(
        'Connection was previously interrupted. You can safely retry without being charged twice.'
      );
    }
  }, [auth.userId, activeQrToken, restaurant?.id]);

  // Discard pending attempt if cart items changed from frozen attempt
  useEffect(() => {
    if (inFlightAttemptRef.current) {
      const frozenItems = inFlightAttemptRef.current.payload.items;
      const currentItems = mapCartToPreviewItems(cart);
      if (JSON.stringify(frozenItems) !== JSON.stringify(currentItems)) {
        inFlightAttemptRef.current = null;
        clearPendingOrderAttempt();
        setIsAmbiguousError(false);
        setSubmitError(null);
      }
    }
  }, [cart]);

  const currencyLabel = orderQuote?.currency === 'INR' || !orderQuote?.currency ? '₹' : orderQuote.currency;
  const totalItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handlePlaceOrder = async () => {
    // 1. Guard against duplicate clicks and concurrent submissions
    if (loading) return;

    // 2. Validate prerequisites
    if (cart.length === 0) {
      setSubmitError('Your cart is empty. Please add items before placing an order.');
      return;
    }

    if (!activeQrToken) {
      setSubmitError('Table QR code is required to place an order.');
      return;
    }

    if (!auth.isAuthenticated) {
      setSubmitError('Please sign in to place your order.');
      navigateTo('auth-login');
      return;
    }

    if (!orderQuote) {
      setSubmitError('A confirmed bill calculation is required before placing the order. Please refresh.');
      return;
    }

    try {
      setLoading(true);
      setSubmitError(null);
      setIsAmbiguousError(false);
      setIsPriceChanged(false);

      // 3. Freeze or snapshot checkout payload for the attempt
      // If retrying an ambiguous failure, reuse the exact same idempotency key and payload
      if (!inFlightAttemptRef.current) {
        const idempotencyKey = generateIdempotencyKey();
        const items = mapCartToPreviewItems(cart);

        const payload: CreateOrderRequest = {
          qrToken: activeQrToken,
          tableId: restaurant?.tableId || undefined,
          idempotencyKey,
          expectedTotal: orderQuote.totalAmount,
          items,
          couponCode: couponCode || undefined,
        };

        inFlightAttemptRef.current = { idempotencyKey, payload };
        storePendingOrderAttempt({
          idempotencyKey,
          payload,
          userId: auth.userId,
          restaurantId: restaurant?.id,
          qrToken: activeQrToken,
          createdAt: Date.now(),
        });
      }

      // 4. Submit to authoritative backend
      const order = await submitOrder(inFlightAttemptRef.current.payload);

      // 5. On verified success: reset attempt, store real order, clear cart and navigate
      inFlightAttemptRef.current = null;
      clearPendingOrderAttempt();
      setLatestOrder(order);
      setActiveOrderId(order.id);
      clearCart();
      navigateTo('order-confirmation', { orderId: order.id });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        // Price changed during checkout: invalidate preview quote and require fresh preview
        if (err.code === 'PRICE_CHANGED' || err.status === 409) {
          inFlightAttemptRef.current = null; // discard stale attempt
          clearPendingOrderAttempt();
          setIsPriceChanged(true);
          setSubmitError(
            err.message || 'Menu prices or taxes have changed since preview. Please refresh your bill.'
          );
          refreshOrderPreview();
          return;
        }

        // Ambiguous failure: network drop, timeout, or 5xx server error
        // Do NOT discard inFlightAttemptRef.current or sessionStorage so the exact same idempotency key is reused on retry
        if (
          err.code === 'NETWORK_ERROR' ||
          err.code === 'TIMEOUT' ||
          err.code === 'SERVICE_UNAVAILABLE' ||
          err.status >= 500
        ) {
          setIsAmbiguousError(true);
          setSubmitError(
            'Connection to the restaurant server was interrupted. The server may still be processing your order. You can safely retry without being charged twice.'
          );
          return;
        }

        // Definite client validation / auth / table error: discard attempt
        inFlightAttemptRef.current = null;
        clearPendingOrderAttempt();
        setSubmitError(err.message || 'Could not place order. Please review your order details.');
      } else {
        inFlightAttemptRef.current = null;
        clearPendingOrderAttempt();
        setSubmitError('An unexpected error occurred while placing your order. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // If cart is empty, render friendly empty state without submitting fake orders
  if (cart.length === 0) {
    return (
      <div className="checkout-page">
        <header className="checkout-header">
          <button className="back-button" onClick={goBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="checkout-title">Place Order</h1>
          <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
            <Menu size={20} />
          </button>
        </header>

        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <ShoppingBag size={48} strokeWidth={1.5} color="var(--brand-primary, #174A82)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>Your cart is empty</h2>
          <p style={{ fontSize: '14px', color: 'var(--muted-text-color, #666)', marginBottom: '24px' }}>
            Add delicious items from the menu before proceeding to checkout.
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
      </div>
    );
  }

  return (
    <div className="checkout-page">
      {/* Header */}
      <header className="checkout-header">
        <button className="back-button" onClick={goBack} aria-label="Back to cart">
          <ChevronLeft size={24} />
        </button>
        <h1 className="checkout-title">Place Order</h1>
        <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
          <Menu size={20} />
        </button>
      </header>

      {/* Error & Retry Banner */}
      {submitError && (
        <section
          style={{
            backgroundColor: isAmbiguousError ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${isAmbiguousError ? '#fde68a' : '#fecaca'}`,
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '16px',
            color: isAmbiguousError ? '#92400e' : '#991b1b',
            fontSize: '13.5px',
            lineHeight: 1.45,
          }}
          aria-live="polite"
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>
                {isAmbiguousError ? 'Network Interrupted' : isPriceChanged ? 'Price Updated' : 'Order Submission Failed'}
              </strong>
              <span>{submitError}</span>
              {isPriceChanged && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => refreshOrderPreview()}
                    style={{
                      background: 'var(--brand-primary, #174A82)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <RefreshCw size={13} />
                    Refresh Quote
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Location / Table Card */}
      <section className="location-card" aria-label="Dining Location">
        <div className="location-left">
          <div className="location-pin-icon-wrap">
            <MapPin size={22} />
          </div>
          <div className="location-meta">
            <span className="location-restaurant-name">
              {restaurant?.name || 'Dining Restaurant'}
            </span>
            <span className="location-table-label">
              {restaurant?.tableLabel || (restaurant?.tableNumber ? `Table ${restaurant.tableNumber}` : 'Dine-In Table')}
            </span>
          </div>
        </div>

        <button className="location-change-btn" onClick={() => navigateTo('menu')}>
          Menu
        </button>
      </section>

      {/* Order Summary Section */}
      <section className="summary-section" aria-label="Order Summary">
        <div className="section-header-row">
          <h2 className="summary-section-title">Order Summary</h2>
          <span className="summary-item-count">
            {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="summary-items-list">
          {cart.map((item) => (
            <div key={item.id} className="summary-item-row">
              <span className="summary-item-name">{item.productName}</span>
              <span className="summary-item-qty">x{item.quantity}</span>
              <span className="summary-item-price">
                {currencyLabel} {item.totalPrice}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Amount Details Section */}
      <section className="summary-section" aria-label="Amount Details">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="summary-section-title">Amount Details</h2>
          {isQuoteLoading ? (
            <span style={{ fontSize: '12px', color: 'var(--brand-primary, #174A82)' }}>
              Calculating...
            </span>
          ) : orderQuote ? (
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
              ✓ Verified Live Quote
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Unconfirmed
            </span>
          )}
        </div>

        <div className="amount-details-card">
          <div className="amount-row">
            <span>Subtotal</span>
            <span>
              {currencyLabel} {orderQuote ? orderQuote.subtotalFormatted : bill.subtotal.toFixed(2)}
            </span>
          </div>

          {(orderQuote?.discountAmount ?? bill.discountAmount) > 0 && (
            <div className="amount-row discount">
              <span>Discount ({orderQuote?.coupon?.code || couponCode})</span>
              <span>
                - {currencyLabel} {orderQuote ? orderQuote.discountAmountFormatted : bill.discountAmount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="amount-row">
            <span>Taxes & Fees</span>
            <span>
              {orderQuote ? `${currencyLabel} ${orderQuote.taxAmountFormatted}` : 'Calculated at submission'}
            </span>
          </div>

          <div className="amount-divider" />

          <div className="amount-row total">
            <span>Total Payable</span>
            <span>
              {currencyLabel} {orderQuote ? orderQuote.totalAmountFormatted : bill.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Payment Method Section */}
      <section className="summary-section" aria-label="Payment Method">
        <h2 className="summary-section-title">Payment Method</h2>

        <div
          className={`payment-method-card ${selectedPayment === 'Pay at Restaurant' ? 'selected' : ''}`}
        >
          <div className="payment-left">
            <div className="payment-check-circle">
              <Check size={16} strokeWidth={3} />
            </div>
            <div className="payment-texts">
              <span className="payment-title">Pay at Restaurant</span>
              <span className="payment-subtitle">Cash / Card / UPI</span>
            </div>
          </div>

          <Store size={26} className="payment-store-icon" />
        </div>
      </section>

      {/* Sticky Bottom Place Order Action Bar */}
      <div className="checkout-sticky-bar">
        <button
          className="place-order-submit-btn"
          onClick={handlePlaceOrder}
          disabled={loading || isQuoteLoading || !orderQuote}
        >
          <span>
            {loading
              ? isAmbiguousError
                ? 'Retrying Idempotent Order...'
                : 'Submitting Order...'
              : isQuoteLoading
              ? 'Calculating Live Total...'
              : `Place Order • ${currencyLabel} ${orderQuote ? orderQuote.totalAmountFormatted : bill.totalAmount.toFixed(2)}`}
          </span>
          {!loading && !isQuoteLoading && <ArrowRight size={18} />}
        </button>
      </div>
    </div>
  );
};
