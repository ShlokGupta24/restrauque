'use client';

import React, { useState, useEffect } from 'react';
import { THEME, formatCurrency } from '../constants';
import {
  CartItem,
  RestaurantContext,
  TableContext,
  ServerPreviewState,
} from '../types';

interface CartSummaryViewProps {
  token: string;
  restaurant: RestaurantContext;
  table: TableContext;
  cart: CartItem[];
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onContinueBrowsing: () => void;
  onProceedToCheckout?: () => void;
}

export default function CartSummaryView({
  token,
  restaurant,
  table,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onContinueBrowsing,
  onProceedToCheckout,
}: CartSummaryViewProps) {
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<ServerPreviewState>({
    status: 'idle',
    quote: null,
    errorMessage: null,
  });

  const estimatedSubtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Trigger server price preview via POST /api/v1/customer/orders/preview
  useEffect(() => {
    let isCancelled = false;

    async function fetchServerPricePreview() {
      if (cart.length === 0) {
        setPreviewState({ status: 'idle', quote: null, errorMessage: null });
        return;
      }

      setPreviewState((prev) => ({ ...prev, status: 'loading' }));

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
        };

        const res = await fetch('/api/v1/customer/orders/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (isCancelled) return;

        if (res.status === 401) {
          // Authentication required for customer order quote preview
          setPreviewState({
            status: 'auth_required',
            quote: null,
            errorMessage: 'Customer verification required for tax & discount quotes',
          });
          return;
        }

        if (!res.ok) {
          setPreviewState({
            status: 'error',
            quote: null,
            errorMessage: json.error?.message || 'Could not verify server prices',
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
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        setPreviewState({
          status: 'error',
          quote: null,
          errorMessage:
            err instanceof Error ? err.message : 'Server price check unavailable',
        });
      }
    }

    const timer = setTimeout(() => {
      fetchServerPricePreview();
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [cart, token, table.id]);

  const handleProceedToCheckoutClick = () => {
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else {
      setCheckoutNotice(
        'Ready for checkout! Mobile OTP verification and table order submission are enabled in Step 3.'
      );
    }
  };

  if (cart.length === 0) {
    return (
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '40px 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            borderRadius: THEME.radius.xl,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            padding: '48px 24px',
            boxShadow: THEME.shadow.card,
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 8px',
            }}
          >
            Your Cart is Empty
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}
          >
            You haven&apos;t added any delicious dishes for Table {table.tableNumber} yet.
          </p>

          <button
            type="button"
            onClick={onContinueBrowsing}
            style={{
              padding: '12px 28px',
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(23, 63, 112, 0.2)',
            }}
          >
            Browse Restaurant Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '16px 16px 120px',
      }}
    >
      {/* Title & Table Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: 0,
            }}
          >
            Review Your Order
          </h2>
          <p
            style={{
              fontSize: '12px',
              color: THEME.colors.textMuted,
              margin: '2px 0 0',
            }}
          >
            {restaurant.name} · Table {table.tableNumber}
          </p>
        </div>

        <button
          type="button"
          onClick={onClearCart}
          style={{
            background: 'none',
            border: 'none',
            color: THEME.colors.badgeRed,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Clear Cart
        </button>
      </div>

      {checkoutNotice && (
        <div
          style={{
            backgroundColor: THEME.colors.successBg,
            border: `1px solid ${THEME.colors.successGreen}`,
            borderRadius: THEME.radius.md,
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <span
              style={{
                fontSize: '13px',
                color: THEME.colors.successGreen,
                fontWeight: 600,
              }}
            >
              {checkoutNotice}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutNotice(null)}
            style={{
              background: 'none',
              border: 'none',
              color: THEME.colors.successGreen,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Cart Items List */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        {cart.map((item, idx) => (
          <div
            key={item.id}
            style={{
              padding: '16px',
              borderBottom:
                idx < cart.length - 1
                  ? `1px solid ${THEME.colors.borderSubtle}`
                  : 'none',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            {/* Item Details */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '2px',
                }}
              >
                <h4
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: THEME.colors.navyPrimary,
                    margin: 0,
                  }}
                >
                  {item.productName}
                </h4>
                {item.variantName && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: THEME.colors.navyLight,
                      color: THEME.colors.navyPrimary,
                      padding: '2px 6px',
                      borderRadius: THEME.radius.sm,
                    }}
                  >
                    {item.variantName}
                  </span>
                )}
              </div>

              {/* Addons List */}
              {item.addons.length > 0 && (
                <div
                  style={{
                    fontSize: '12px',
                    color: THEME.colors.textMuted,
                    margin: '2px 0 4px',
                  }}
                >
                  + {item.addons.map((a) => `${a.name} (${formatCurrency(a.price)})`).join(', ')}
                </div>
              )}

              {/* Special Instructions */}
              {item.specialInstructions && (
                <div
                  style={{
                    fontSize: '11px',
                    fontStyle: 'italic',
                    color: THEME.colors.textMuted,
                    margin: '2px 0 4px',
                  }}
                >
                  Note: &quot;{item.specialInstructions}&quot;
                </div>
              )}

              {/* Unit Price */}
              <div
                style={{
                  fontSize: '12px',
                  color: THEME.colors.textLight,
                  marginTop: '4px',
                }}
              >
                {formatCurrency(item.unitPrice + item.addons.reduce((s, a) => s + a.price, 0))} each
              </div>
            </div>

            {/* Stepper & Line Total */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                }}
              >
                {formatCurrency(item.lineTotal)}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: THEME.colors.bgCardSubtle,
                    border: `1px solid ${THEME.colors.borderSubtle}`,
                    borderRadius: THEME.radius.sm,
                    height: '30px',
                  }}
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                    style={{
                      width: '26px',
                      height: '100%',
                      background: 'none',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: THEME.colors.navyPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    -
                  </button>
                  <span
                    style={{
                      minWidth: '20px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: THEME.colors.navyPrimary,
                    }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                    style={{
                      width: '26px',
                      height: '100%',
                      background: 'none',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: THEME.colors.navyPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => onRemoveItem(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: THEME.colors.textLight,
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Back to Menu Action */}
      <div style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={onContinueBrowsing}
          style={{
            background: 'none',
            border: 'none',
            color: THEME.colors.navyPrimary,
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>←</span>
          <span>Add more dishes to order</span>
        </button>
      </div>

      {/* Bill & Price Preview Breakdown */}
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
          Payment Summary
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: THEME.colors.textMuted,
            }}
          >
            <span>Estimated Subtotal ({totalItemCount} items)</span>
            <span style={{ fontWeight: 600, color: THEME.colors.textMain }}>
              {formatCurrency(estimatedSubtotal)}
            </span>
          </div>

          {/* Server Preview Status / Details */}
          {previewState.status === 'success' && previewState.quote && (
            <>
              {previewState.quote.discountAmount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: THEME.colors.successGreen,
                  }}
                >
                  <span>Promotional Discount</span>
                  <span style={{ fontWeight: 600 }}>
                    -{formatCurrency(previewState.quote.discountAmount)}
                  </span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: THEME.colors.textMuted,
                }}
              >
                <span>Applicable Taxes</span>
                <span style={{ fontWeight: 600, color: THEME.colors.textMain }}>
                  {formatCurrency(previewState.quote.taxAmount)}
                </span>
              </div>
            </>
          )}

          <div
            style={{
              height: '1px',
              backgroundColor: THEME.colors.borderSubtle,
              margin: '6px 0',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                }}
              >
                Estimated Total
              </span>
              <p
                style={{
                  fontSize: '11px',
                  color: THEME.colors.textLight,
                  margin: '2px 0 0',
                }}
              >
                Includes all configured items
              </p>
            </div>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: THEME.colors.navyPrimary,
              }}
            >
              {previewState.status === 'success' && previewState.quote
                ? formatCurrency(previewState.quote.totalAmount)
                : formatCurrency(estimatedSubtotal)}
            </span>
          </div>

          {/* Informational banner when auth required */}
          {previewState.status === 'auth_required' && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: THEME.radius.sm,
                backgroundColor: THEME.colors.navyLight,
                border: `1px solid ${THEME.colors.borderSubtle}`,
                fontSize: '12px',
                color: THEME.colors.navyPrimary,
                lineHeight: 1.4,
              }}
            >
              ℹ️ Taxes, discounts, and verified totals are calculated with your mobile number at checkout.
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Action */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 45,
          padding: '12px 16px',
          backgroundColor: 'rgba(251, 249, 245, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${THEME.colors.borderSubtle}`,
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
              Table {table.tableNumber} Order
            </div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 800,
                color: THEME.colors.navyPrimary,
              }}
            >
              {formatCurrency(estimatedSubtotal)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleProceedToCheckoutClick}
            style={{
              flex: 1,
              maxWidth: '280px',
              height: '46px',
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(23, 63, 112, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Proceed to Checkout</span>
            <span style={{ fontSize: '16px' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
