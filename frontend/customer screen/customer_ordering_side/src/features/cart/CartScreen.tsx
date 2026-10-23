import React, { useState } from 'react';
import { ChevronLeft, Trash2, Minus, Plus, Percent, ArrowRight, ShoppingBag, Menu } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import './CartScreen.css';

/**
 * Screen 04: Cart & Bill Summary
 * Visual reference: UIUX/04-cart.png
 */
export const CartScreen: React.FC = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    bill,
    couponCode,
    applyCoupon,
    removeCoupon,
    orderQuote,
    isQuoteLoading,
    quoteError,
    refreshOrderPreview,
    auth,
    setPostAuthScreen,
    navigateTo,
    goBack,
    openNav,
  } = useApp();

  const [inputCoupon, setInputCoupon] = useState<string>(couponCode || '');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const currencyLabel = orderQuote?.currency === 'INR' ? '₹' : (orderQuote?.currency || '₹');

  const handleApplyCoupon = async () => {
    if (!inputCoupon.trim()) {
      setPromoMessage({ text: 'Please enter a valid promo code', isError: true });
      return;
    }
    const res = await applyCoupon(inputCoupon.trim());
    if (res.success) {
      setPromoMessage({ text: res.message || 'Promo code applied!', isError: false });
    } else {
      setPromoMessage({ text: res.error || 'Invalid promo code.', isError: true });
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setInputCoupon('');
    setPromoMessage({ text: 'Promo code removed.', isError: false });
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    // If authenticated, go straight to checkout (Screen 07), else authenticate (Screen 05)
    if (auth.isAuthenticated) {
      navigateTo('checkout');
    } else {
      setPostAuthScreen('cart');
      navigateTo('auth-login');
    }
  };

  return (
    <div className="cart-page">
      {/* Header */}
      <header className="cart-header">
        <button
          className="back-button"
          onClick={goBack}
          aria-label="Back to menu"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="cart-title">Your Cart</h1>
        <button
          className="back-button hamburger-btn"
          onClick={openNav}
          aria-label="Navigation menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Cart Content or Empty State */}
      {cart.length === 0 ? (
        <div className="cart-empty-container">
          <ShoppingBag size={48} strokeWidth={1.5} color="var(--brand-primary)" />
          <h2 className="cart-empty-text">Your cart is currently empty</h2>
          <p className="cart-empty-subtext">
            Add delicious dishes and refreshing beverages from the menu to get started.
          </p>
          <button
            className="explore-menu-btn"
            onClick={() => navigateTo('menu')}
          >
            Explore Menu
          </button>
        </div>
      ) : (
        <>
          {/* Cart Item Cards */}
          <section className="cart-items-section" aria-label="Cart Items">
            {cart.map((item) => {
              const customizationDetails = [
                item.variant?.name,
                ...item.addons.map((a) => a.name),
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <article key={item.id} className="cart-item-card">
                  <div className="cart-item-thumb">
                    <img src={item.imageUrl} alt={item.productName} />
                  </div>

                  <div className="cart-item-details">
                    <h2 className="cart-item-name">{item.productName}</h2>
                    {customizationDetails && (
                      <span className="cart-item-customization">
                        {customizationDetails}
                      </span>
                    )}
                    <span className="cart-item-price">{currencyLabel} {item.unitPrice}</span>
                  </div>

                  <div className="cart-item-actions">
                    <button
                      className="cart-item-delete-btn"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.productName} from cart`}
                    >
                      <Trash2 size={18} />
                    </button>

                    <div className="cart-stepper-pill">
                      <button
                        className="cart-stepper-btn"
                        onClick={() => updateCartQuantity(item.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="cart-stepper-qty">{item.quantity}</span>
                      <button
                        className="cart-stepper-btn"
                        onClick={() => updateCartQuantity(item.id, 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Promo Code Section */}
          <section className="promo-section" aria-label="Promotion Code">
            <div className="promo-header">
              <Percent size={18} className="promo-icon" />
              <span>Promo Code</span>
            </div>
            {couponCode ? (
              <div
                className="promo-active-badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--brand-surface, #f9fafb)',
                  borderRadius: '8px',
                  border: '1px dashed var(--brand-primary, #111)',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--brand-primary, #111)' }}>{couponCode.toUpperCase()}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#16a34a', marginLeft: '8px' }}>
                    {orderQuote?.discountAmount ? `Saved ${currencyLabel} ${orderQuote.discountAmountFormatted}` : 'Applied'}
                  </span>
                </div>
                <button
                  onClick={handleRemoveCoupon}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="promo-input-row">
                <input
                  type="text"
                  className="promo-input"
                  placeholder="Enter promo code"
                  value={inputCoupon}
                  onChange={(e) => setInputCoupon(e.target.value)}
                />
                <button
                  className="promo-apply-btn"
                  onClick={handleApplyCoupon}
                  disabled={isQuoteLoading}
                >
                  {isQuoteLoading ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {promoMessage && (
              <p className={`promo-feedback ${promoMessage.isError ? 'error' : 'success'}`}>
                {promoMessage.text}
              </p>
            )}
          </section>

          {/* Bill Details Section */}
          <section className="bill-section" aria-label="Bill Breakdown">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 className="bill-title" style={{ margin: 0 }}>Bill Details</h2>
              {isQuoteLoading ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 500 }}>
                  Calculating...
                </span>
              ) : orderQuote ? (
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}>
                  ✓ Live Quote
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                  Unconfirmed
                </span>
              )}
            </div>

            {quoteError && (
              <div
                className="quote-error-banner"
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  fontSize: '0.85rem',
                  color: '#991b1b',
                }}
              >
                <p style={{ margin: '0 0 6px 0' }}>{quoteError}</p>
                {!auth.isAuthenticated ? (
                  <button
                    onClick={() => {
                      setPostAuthScreen('cart');
                      navigateTo('auth-login');
                    }}
                    style={{
                      background: 'var(--brand-primary, #111)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Sign In to Preview Bill
                  </button>
                ) : (
                  <button
                    onClick={() => refreshOrderPreview()}
                    style={{
                      background: '#991b1b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Retry Quote
                  </button>
                )}
              </div>
            )}

            <div className="bill-row">
              <span>{orderQuote ? 'Subtotal' : 'Estimated Subtotal (Unconfirmed)'}</span>
              <span>{currencyLabel} {orderQuote ? orderQuote.subtotalFormatted : bill.subtotal.toFixed(2)}</span>
            </div>

            {orderQuote && orderQuote.discountAmount > 0 ? (
              <div className="bill-row discount-row">
                <span>Discount ({orderQuote.coupon?.code})</span>
                <span>- {currencyLabel} {orderQuote.discountAmountFormatted}</span>
              </div>
            ) : null}

            <div className="bill-row">
              <span>Taxes</span>
              <span>{orderQuote ? `${currencyLabel} ${orderQuote.taxAmountFormatted}` : 'Calculated at review'}</span>
            </div>

            <div className="bill-divider" />

            <div className="bill-row total-row">
              <span>{orderQuote ? 'Total' : 'Estimated Total (Unconfirmed)'}</span>
              <span>{currencyLabel} {orderQuote ? orderQuote.totalAmountFormatted : bill.totalAmount.toFixed(2)}</span>
            </div>
          </section>

          {/* Sticky Bottom Action Bar */}
          <div className="cart-sticky-bar">
            <button
              className="checkout-submit-btn"
              onClick={handleProceedToCheckout}
              disabled={cart.length === 0 || isQuoteLoading}
            >
              <span>
                {!auth.isAuthenticated
                  ? 'Sign in & Review Order'
                  : isQuoteLoading
                  ? 'Calculating...'
                  : `Proceed to Checkout • ${currencyLabel} ${orderQuote ? orderQuote.totalAmountFormatted : bill.totalAmount.toFixed(2)}`}
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
