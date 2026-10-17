import React, { useState } from 'react';
import { ChevronLeft, Trash2, Minus, Plus, Percent, ArrowRight, ShoppingBag, Menu } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { mockProducts } from '../../mocks/menu.mock';
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
    addToCart,
    bill,
    couponCode,
    applyCoupon,
    auth,
    navigateTo,
    goBack,
    openNav,
  } = useApp();

  const [inputCoupon, setInputCoupon] = useState<string>(couponCode || '');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleApplyCoupon = async () => {
    if (!inputCoupon.trim()) {
      setPromoMessage({ text: 'Please enter a valid promo code', isError: true });
      return;
    }
    const success = await applyCoupon(inputCoupon.trim());
    if (success && inputCoupon.trim().toUpperCase() === 'WELCOME10') {
      setPromoMessage({ text: 'Promo code applied! 10% discount saved.', isError: false });
    } else {
      setPromoMessage({ text: 'Invalid promo code. Try WELCOME10', isError: true });
    }
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) return;
    // If authenticated, go straight to checkout (Screen 07), else authenticate (Screen 05)
    if (auth.isAuthenticated) {
      navigateTo('checkout');
    } else {
      navigateTo('auth-login');
    }
  };

  // Helper to load sample items matching UIUX reference if cart is empty
  const handleLoadSampleCart = () => {
    const latte = mockProducts.find((p) => p.id === 'prod-iced-latte');
    const coldCoffee = mockProducts.find((p) => p.id === 'prod-cold-coffee');
    const mocha = mockProducts.find((p) => p.id === 'prod-mocha-frappe');

    if (latte) addToCart(latte, 1, 'var-latte-reg');
    if (coldCoffee) addToCart(coldCoffee, 1, 'var-cc-reg');
    if (mocha) addToCart(mocha, 1, 'var-mf-reg');
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
          <button
            className="promo-feedback"
            style={{ marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary)', textDecoration: 'underline' }}
            onClick={handleLoadSampleCart}
          >
            Load sample items from reference design
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
                    <span className="cart-item-price">₹ {item.unitPrice}</span>
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
              >
                Apply
              </button>
            </div>
            {promoMessage && (
              <p className={`promo-feedback ${promoMessage.isError ? 'error' : 'success'}`}>
                {promoMessage.text}
              </p>
            )}
          </section>

          {/* Bill Details Section */}
          <section className="bill-section" aria-label="Bill Breakdown">
            <h2 className="bill-title">Bill Details</h2>

            <div className="bill-row">
              <span>Subtotal</span>
              <span>₹ {bill.subtotal}</span>
            </div>

            {bill.discountAmount > 0 && (
              <div className="bill-row discount-row">
                <span>Discount ({bill.appliedCoupon?.code})</span>
                <span>- ₹ {bill.discountAmount}</span>
              </div>
            )}

            <div className="bill-row">
              <span>Tax</span>
              <span>₹ {bill.taxAmount}</span>
            </div>

            <div className="bill-divider" />

            <div className="bill-row total-row">
              <span>Total</span>
              <span>₹ {bill.totalAmount}</span>
            </div>
          </section>

          {/* Sticky Bottom Action Bar */}
          <div className="cart-sticky-bar">
            <button
              className="checkout-submit-btn"
              onClick={handleProceedToCheckout}
              disabled={cart.length === 0}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
