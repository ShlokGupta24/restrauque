'use client';

import React, { useState, useEffect, useId } from 'react';
import { THEME, formatCurrency } from '../constants';
import {
  CartItem,
  RestaurantContext,
  BranchContext,
  TableContext,
  CustomerUser,
  ServerPreviewState,
  ConfirmedOrder,
} from '../types';

interface CheckoutViewProps {
  token: string;
  restaurant: RestaurantContext;
  branch: BranchContext;
  table: TableContext;
  cart: CartItem[];
  currentUser: CustomerUser | null;
  onRequestAuth: () => void;
  onOrderSuccess: (order: ConfirmedOrder) => void;
  onBackToCart: () => void;
}

export default function CheckoutView({
  token,
  restaurant,
  branch,
  table,
  cart,
  currentUser,
  onRequestAuth,
  onOrderSuccess,
  onBackToCart,
}: CheckoutViewProps) {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PAY_AT_RESTAURANT'>('PAY_AT_RESTAURANT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Client-generated unique idempotency key for this checkout session
  const defaultIdempotencyKey = useId().replace(/:/g, '') + '-' + Date.now();
  const [idempotencyKey] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return defaultIdempotencyKey;
  });

  // Authoritative server pricing state
  const [previewState, setPreviewState] = useState<ServerPreviewState>({
    status: 'idle',
    quote: null,
    errorMessage: null,
  });

  const estimatedSubtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  // Revalidate authoritative pricing via POST /api/v1/customer/orders/preview
  const fetchPricePreview = async (couponToApply?: string | null) => {
    if (cart.length === 0) return;

    setPreviewState((prev) => ({ ...prev, status: 'loading' }));
    setCouponError(null);

    try {
      const payload = {
        qrToken: token,
        tableId: table.id,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          addonIds: item.addons.map((a) => a.id),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
        })),
        couponCode: couponToApply || undefined,
        notes: orderNotes.trim() || undefined,
      };

      const res = await fetch('/api/v1/customer/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.status === 401) {
        setPreviewState({
          status: 'auth_required',
          quote: null,
          errorMessage: 'Verification required to calculate server prices',
        });
        return;
      }

      if (!res.ok) {
        if (couponToApply) {
          setCouponError(json.error?.message || 'Invalid or ineligible coupon code.');
          setAppliedCoupon(null);
        }
        setPreviewState({
          status: 'error',
          quote: null,
          errorMessage: json.error?.message || 'Failed to revalidate server pricing',
        });
        return;
      }

      if (json.data?.pricing) {
        setPreviewState({
          status: 'success',
          quote: {
            subtotal: Number(json.data.pricing.subtotal),
            discountAmount: Number(json.data.pricing.discountAmount),
            taxAmount: Number(json.data.pricing.taxAmount),
            totalAmount: Number(json.data.pricing.totalAmount),
            currency: json.data.pricing.currency || 'INR',
          },
          errorMessage: null,
        });

        if (couponToApply) {
          setAppliedCoupon(couponToApply);
        }
      }
    } catch (err: unknown) {
      setPreviewState({
        status: 'error',
        quote: null,
        errorMessage: err instanceof Error ? err.message : 'Network error during price preview',
      });
    }
  };

  // Revalidate on mount and when currentUser changes
  useEffect(() => {
    fetchPricePreview(appliedCoupon);
  }, [currentUser]);

  // Apply Coupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) return;

    if (!currentUser) {
      // Prompt auth first because preview requires customer auth
      onRequestAuth();
      return;
    }

    await fetchPricePreview(trimmed);
  };

  const handleRemoveCoupon = async () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError(null);
    await fetchPricePreview(null);
  };

  // Place Order Action
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;

    // 1. If not authenticated, open customer OTP modal
    if (!currentUser) {
      onRequestAuth();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Authoritative expected total from preview if available, else estimated subtotal
      const expectedTotal = previewState.quote
        ? previewState.quote.totalAmount
        : undefined;

      const payload = {
        qrToken: token,
        tableId: table.id,
        idempotencyKey,
        expectedTotal,
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || null,
          addonIds: item.addons.map((a) => a.id),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || null,
        })),
        couponCode: appliedCoupon || undefined,
        notes: orderNotes.trim() || undefined,
      };

      const res = await fetch('/api/v1/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          onRequestAuth();
          throw new Error('Your session has expired. Please verify your mobile number again.');
        }

        if (res.status === 409 && json.error?.code === 'PRICE_CHANGED') {
          // Re-fetch preview to update prices
          await fetchPricePreview(appliedCoupon);
          throw new Error(
            json.error?.message ||
              'Dish prices or taxes have changed since checkout started. Please review updated totals.'
          );
        }

        throw new Error(json.error?.message || 'Could not place dine-in order.');
      }

      // Success: backend returned formatted order
      const confirmedOrder: ConfirmedOrder = json.data;
      onOrderSuccess(confirmedOrder);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'An unexpected error occurred while placing your order.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '16px 16px 140px',
      }}
    >
      {/* Title & Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            aria-label="Back to Cart"
            onClick={onBackToCart}
            style={{
              background: 'none',
              border: 'none',
              color: THEME.colors.navyPrimary,
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            ←
          </button>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: 0,
            }}
          >
            Dine-In Checkout
          </h2>
        </div>

        {/* Table Badge */}
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            color: THEME.colors.navyPrimary,
            padding: '4px 10px',
            borderRadius: THEME.radius.pill,
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          Table {table.tableNumber}
        </div>
      </div>

      {/* Customer Verification State Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          borderRadius: THEME.radius.lg,
          padding: '14px 16px',
          boxShadow: THEME.shadow.card,
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: currentUser ? THEME.colors.successBg : THEME.colors.badgeAmberBg,
              color: currentUser ? THEME.colors.successGreen : THEME.colors.badgeAmber,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
            }}
          >
            {currentUser ? '✓' : '📱'}
          </div>
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: THEME.colors.navyPrimary,
              }}
            >
              {currentUser
                ? currentUser.name || 'Verified Customer'
                : 'Mobile Verification Required'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: THEME.colors.textMuted,
              }}
            >
              {currentUser
                ? `Phone: ${currentUser.phone}`
                : 'Enter mobile number for order receipt'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRequestAuth}
          style={{
            padding: '6px 12px',
            borderRadius: THEME.radius.pill,
            border: `1px solid ${THEME.colors.navyPrimary}`,
            backgroundColor: currentUser ? 'transparent' : THEME.colors.navyPrimary,
            color: currentUser ? THEME.colors.navyPrimary : '#ffffff',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {currentUser ? 'Switch' : 'Verify'}
        </button>
      </div>

      {/* Error Banner */}
      {submitError && (
        <div
          style={{
            backgroundColor: THEME.colors.badgeRedBg,
            border: `1px solid ${THEME.colors.badgeRed}`,
            borderRadius: THEME.radius.md,
            padding: '12px 14px',
            color: THEME.colors.badgeRed,
            fontSize: '13px',
            marginBottom: '16px',
            lineHeight: 1.4,
          }}
        >
          ⚠️ {submitError}
        </div>
      )}

      {/* Itemized Order Summary Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: `1px solid ${THEME.colors.borderSubtle}`,
          }}
        >
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: THEME.colors.navyPrimary,
              margin: 0,
            }}
          >
            Order Items ({cart.reduce((s, i) => s + i.quantity, 0)})
          </h4>
          <button
            type="button"
            onClick={onBackToCart}
            style={{
              background: 'none',
              border: 'none',
              color: THEME.colors.navyPrimary,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Edit Cart
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cart.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                fontSize: '13px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: THEME.colors.textMain }}>
                  {item.quantity}x {item.productName}
                  {item.variantName && (
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: THEME.colors.navyPrimary,
                      }}
                    >
                      ({item.variantName})
                    </span>
                  )}
                </div>
                {item.addons.length > 0 && (
                  <div style={{ fontSize: '11px', color: THEME.colors.textMuted }}>
                    + {item.addons.map((a) => a.name).join(', ')}
                  </div>
                )}
                {item.specialInstructions && (
                  <div style={{ fontSize: '11px', color: THEME.colors.textMuted, fontStyle: 'italic' }}>
                    &quot;{item.specialInstructions}&quot;
                  </div>
                )}
              </div>

              <div style={{ fontWeight: 700, color: THEME.colors.navyPrimary }}>
                {formatCurrency(item.lineTotal)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coupon Application Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h4
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: THEME.colors.navyPrimary,
            margin: '0 0 10px',
          }}
        >
          Restaurant Coupon
        </h4>

        {appliedCoupon ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: THEME.colors.successBg,
              border: `1px solid ${THEME.colors.successGreen}`,
              borderRadius: THEME.radius.md,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🏷️</span>
              <div>
                <strong style={{ fontSize: '13px', color: THEME.colors.successGreen }}>
                  {appliedCoupon}
                </strong>
                <div style={{ fontSize: '11px', color: THEME.colors.textMuted }}>
                  Coupon applied to this order
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemoveCoupon}
              style={{
                background: 'none',
                border: 'none',
                color: THEME.colors.badgeRed,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Enter promo code"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value);
                if (couponError) setCouponError(null);
              }}
              style={{
                flex: 1,
                height: '42px',
                padding: '0 12px',
                borderRadius: THEME.radius.md,
                border: `1.5px solid ${couponError ? THEME.colors.badgeRed : THEME.colors.borderSubtle}`,
                backgroundColor: THEME.colors.bgCardSubtle,
                color: THEME.colors.textMain,
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!couponCode.trim()}
              style={{
                padding: '0 18px',
                height: '42px',
                backgroundColor: couponCode.trim() ? THEME.colors.navyPrimary : THEME.colors.textLight,
                color: '#ffffff',
                border: 'none',
                borderRadius: THEME.radius.md,
                fontSize: '13px',
                fontWeight: 700,
                cursor: couponCode.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Apply
            </button>
          </form>
        )}

        {couponError && (
          <p
            style={{
              fontSize: '12px',
              color: THEME.colors.badgeRed,
              margin: '8px 0 0',
            }}
          >
            {couponError}
          </p>
        )}
      </div>

      {/* Special Dining Notes */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <label
          htmlFor="order-notes"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 700,
            color: THEME.colors.navyPrimary,
            marginBottom: '6px',
          }}
        >
          Special Dining Requests
        </label>
        <textarea
          id="order-notes"
          rows={2}
          maxLength={500}
          placeholder="e.g. Please bring water first, food packaging preferences..."
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: THEME.radius.md,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            backgroundColor: THEME.colors.bgCardSubtle,
            color: THEME.colors.textMain,
            fontSize: '13px',
            boxSizing: 'border-box',
            resize: 'none',
            outline: 'none',
          }}
        />
      </div>

      {/* Payment Method Selector */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <h4
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: THEME.colors.navyPrimary,
            margin: '0 0 10px',
          }}
        >
          Payment Method
        </h4>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: THEME.radius.md,
            border: `1.5px solid ${THEME.colors.navyPrimary}`,
            backgroundColor: THEME.colors.navyLight,
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="PAY_AT_RESTAURANT"
            checked={paymentMethod === 'PAY_AT_RESTAURANT'}
            onChange={() => setPaymentMethod('PAY_AT_RESTAURANT')}
            style={{
              accentColor: THEME.colors.navyPrimary,
              marginTop: '2px',
            }}
          />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: THEME.colors.navyPrimary }}>
              Pay at Restaurant
            </div>
            <div style={{ fontSize: '12px', color: THEME.colors.textMuted, marginTop: '2px' }}>
              Pay by Cash, UPI, or Card directly at Table {table.tableNumber} after your meal. No online payment required now.
            </div>
          </div>
        </label>
      </div>

      {/* Final Authoritative Price Breakdown */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          padding: '18px',
          marginBottom: '24px',
        }}
      >
        <h4
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: THEME.colors.navyPrimary,
            margin: '0 0 12px',
          }}
        >
          Final Bill Summary
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: THEME.colors.textMuted }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 600, color: THEME.colors.textMain }}>
              {previewState.quote ? formatCurrency(previewState.quote.subtotal) : formatCurrency(estimatedSubtotal)}
            </span>
          </div>

          {previewState.quote && previewState.quote.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: THEME.colors.successGreen }}>
              <span>Coupon Discount</span>
              <span style={{ fontWeight: 600 }}>
                -{formatCurrency(previewState.quote.discountAmount)}
              </span>
            </div>
          )}

          {previewState.quote && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: THEME.colors.textMuted }}>
              <span>Taxes</span>
              <span style={{ fontWeight: 600, color: THEME.colors.textMain }}>
                {formatCurrency(previewState.quote.taxAmount)}
              </span>
            </div>
          )}

          <div style={{ height: '1px', backgroundColor: THEME.colors.borderSubtle, margin: '6px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: THEME.colors.navyPrimary }}>
              Total Payable
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: THEME.colors.navyPrimary }}>
              {previewState.quote
                ? formatCurrency(previewState.quote.totalAmount)
                : formatCurrency(estimatedSubtotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Bottom Place Order Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: '12px 16px',
          backgroundColor: 'rgba(251, 249, 245, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: '0 -4px 16px rgba(23, 63, 112, 0.08)',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: THEME.colors.textMuted }}>
              Table {table.tableNumber} Total
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: THEME.colors.navyPrimary,
              }}
            >
              {previewState.quote
                ? formatCurrency(previewState.quote.totalAmount)
                : formatCurrency(estimatedSubtotal)}
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting || cart.length === 0}
            onClick={handlePlaceOrder}
            style={{
              flex: 1,
              maxWidth: '300px',
              height: '48px',
              backgroundColor: isSubmitting ? THEME.colors.textLight : THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '14px',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(23, 63, 112, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>{isSubmitting ? 'Sending to Kitchen...' : 'Confirm & Place Order'}</span>
            {!isSubmitting && <span style={{ fontSize: '16px' }}>✓</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
