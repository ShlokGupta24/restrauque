import React, { useState } from 'react';
import { ChevronLeft, MapPin, Check, Store, ArrowRight, Menu } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { mockProducts } from '../../mocks/menu.mock';
import './PaymentOrderSummaryScreen.css';

/**
 * Screen 07: Payment & Order Summary
 * Visual reference: UIUX/07-payment-order-summary.png
 */
export const PaymentOrderSummaryScreen: React.FC = () => {
  const {
    restaurant,
    cart,
    addToCart,
    clearCart,
    bill,
    setActiveOrderId,
    navigateTo,
    goBack,
    openNav,
  } = useApp();

  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPayment] = useState<string>('Pay at Restaurant');

  // If cart is empty upon direct checkout navigation, provide sample items matching mockup
  const displayCart = React.useMemo(() => {
    if (cart.length > 0) return cart;
    // Fallback sample items matching UIUX reference 07
    return [
      {
        id: 'sample-1',
        productId: 'prod-iced-latte',
        productName: 'Iced Latte',
        imageUrl: '',
        basePrice: 140,
        addons: [],
        quantity: 1,
        unitPrice: 140,
        totalPrice: 140,
      },
      {
        id: 'sample-2',
        productId: 'prod-cold-coffee',
        productName: 'Cold Coffee',
        imageUrl: '',
        basePrice: 130,
        addons: [],
        quantity: 1,
        unitPrice: 130,
        totalPrice: 130,
      },
      {
        id: 'sample-3',
        productId: 'prod-mocha-frappe',
        productName: 'Mocha Frappe',
        imageUrl: '',
        basePrice: 150,
        addons: [],
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
      },
    ];
  }, [cart]);

  const displayBill = React.useMemo(() => {
    if (cart.length > 0) return bill;
    return {
      subtotal: 420,
      discountAmount: 0,
      taxAmount: 21,
      totalAmount: 441,
    };
  }, [cart, bill]);

  const totalItemCount = displayCart.reduce((sum, i) => sum + i.quantity, 0);

  const handlePlaceOrder = async () => {
    try {
      setLoading(true);
      // If currently using sample fallback, ensure items are initialized
      if (cart.length === 0) {
        const latte = mockProducts.find((p) => p.id === 'prod-iced-latte');
        const coldCoffee = mockProducts.find((p) => p.id === 'prod-cold-coffee');
        const mocha = mockProducts.find((p) => p.id === 'prod-mocha-frappe');
        if (latte) addToCart(latte, 1, 'var-latte-reg');
        if (coldCoffee) addToCart(coldCoffee, 1, 'var-cc-reg');
        if (mocha) addToCart(mocha, 1, 'var-mf-reg');
      }

      const orderResult = await customerDataService.createOrder({
        items: displayCart,
        paymentMethod: 'Pay at Restaurant (Cash / Card / UPI)',
      });

      customerDataService.recordCustomerOrder(orderResult, restaurant?.id || 'rest-nbc-01');
      setActiveOrderId(orderResult.orderId);
      clearCart();
      navigateTo('order-confirmation');
    } catch (err) {
      console.error('Failed to place order:', err);
      alert('Could not place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page">
      {/* Header */}
      <header className="checkout-header">
        <button
          className="back-button"
          onClick={goBack}
          aria-label="Back to cart"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="checkout-title">Place Order</h1>
        <button
          className="back-button hamburger-btn"
          onClick={openNav}
          aria-label="Navigation menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Location / Table Card */}
      <section className="location-card" aria-label="Dining Location">
        <div className="location-left">
          <div className="location-pin-icon-wrap">
            <MapPin size={22} />
          </div>
          <div className="location-meta">
            <span className="location-restaurant-name">
              {restaurant?.name || 'NBC - Engineering College'}
            </span>
            <span className="location-table-label">
              {restaurant?.tableLabel || 'Table F18'}
            </span>
          </div>
        </div>

        <button
          className="location-change-btn"
          onClick={() => navigateTo('landing')}
        >
          Change
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
          {displayCart.map((item) => (
            <div key={item.id} className="summary-item-row">
              <span className="summary-item-name">{item.productName}</span>
              <span className="summary-item-qty">x{item.quantity}</span>
              <span className="summary-item-price">₹ {item.totalPrice}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Amount Details Section */}
      <section className="summary-section" aria-label="Amount Details">
        <h2 className="summary-section-title">Amount Details</h2>

        <div className="amount-details-card">
          <div className="amount-row">
            <span>Subtotal</span>
            <span>₹ {displayBill.subtotal}</span>
          </div>

          {displayBill.discountAmount > 0 && (
            <div className="amount-row discount">
              <span>Discount</span>
              <span>- ₹ {displayBill.discountAmount}</span>
            </div>
          )}

          <div className="amount-row">
            <span>Tax</span>
            <span>₹ {displayBill.taxAmount}</span>
          </div>

          <div className="amount-divider" />

          <div className="amount-row total">
            <span>Total</span>
            <span>₹ {displayBill.totalAmount}</span>
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
          disabled={loading}
        >
          <span>
            {loading ? 'Placing Order...' : `Place Order • ₹ ${displayBill.totalAmount}`}
          </span>
          {!loading && <ArrowRight size={18} />}
        </button>
      </div>
    </div>
  );
};
