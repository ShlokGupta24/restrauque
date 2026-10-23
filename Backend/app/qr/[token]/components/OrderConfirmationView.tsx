'use client';

import React, { useState } from 'react';
import { THEME, formatCurrency } from '../constants';
import { ConfirmedOrder, RestaurantContext, TableContext } from '../types';

interface OrderConfirmationViewProps {
  order: ConfirmedOrder;
  restaurant: RestaurantContext;
  table: TableContext;
  onBackToMenu: () => void;
  onProceedToFeedback?: (order: ConfirmedOrder) => void;
}

export default function OrderConfirmationView({
  order,
  restaurant,
  table,
  onBackToMenu,
  onProceedToFeedback,
}: OrderConfirmationViewProps) {
  const [liveStatus, setLiveStatus] = useState<string>(order.status);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Parse formatted timestamp
  const formattedTime = new Date(order.orderedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = new Date(order.orderedAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Track / Refresh Order Status via GET /api/v1/customer/orders/[orderId]
  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const res = await fetch(`/api/v1/customer/orders/${order.id}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Could not refresh order status');
      }

      if (json.data?.status) {
        setLiveStatus(json.data.status);
      }
    } catch (err: unknown) {
      setRefreshError(
        err instanceof Error ? err.message : 'Unable to refresh status at this time.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          label: 'Order Received · Pending Acceptance',
          color: THEME.colors.badgeAmber,
          bg: THEME.colors.badgeAmberBg,
          icon: '⏳',
        };
      case 'preparing':
        return {
          label: 'Cooking in Kitchen',
          color: '#0284c7',
          bg: '#e0f2fe',
          icon: '🍳',
        };
      case 'served':
        return {
          label: 'Delivered to Table',
          color: THEME.colors.successGreen,
          bg: THEME.colors.successBg,
          icon: '🍽️',
        };
      case 'completed':
        return {
          label: 'Dining Session Completed',
          color: THEME.colors.navyPrimary,
          bg: THEME.colors.navyLight,
          icon: '✓',
        };
      case 'cancelled':
        return {
          label: 'Order Cancelled',
          color: THEME.colors.badgeRed,
          bg: THEME.colors.badgeRedBg,
          icon: '✕',
        };
      default:
        return {
          label: status.toUpperCase(),
          color: THEME.colors.navyPrimary,
          bg: THEME.colors.navyLight,
          icon: '📋',
        };
    }
  };

  const currentBadge = getStatusBadge(liveStatus);

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '24px 16px 60px',
      }}
    >
      {/* Success Hero Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.elevated,
          padding: '32px 24px',
          textAlign: 'center',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            backgroundColor: THEME.colors.successBg,
            border: `2px solid ${THEME.colors.successGreen}`,
            color: THEME.colors.successGreen,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            margin: '0 auto 16px',
            boxShadow: '0 4px 16px rgba(22, 163, 74, 0.15)',
          }}
        >
          ✓
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: THEME.colors.navyPrimary,
            margin: '0 0 6px',
          }}
        >
          Order Placed Successfully!
        </h2>

        <p
          style={{
            fontSize: '14px',
            color: THEME.colors.textMuted,
            margin: '0 0 20px',
          }}
        >
          Your dine-in order has been sent to the kitchen.
        </p>

        {/* Order Reference Badge */}
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: THEME.colors.bgCardSubtle,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '12px 24px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '11px', color: THEME.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Order Number
          </span>
          <span style={{ fontSize: '20px', fontWeight: 800, color: THEME.colors.navyPrimary, marginTop: '2px' }}>
            {order.orderNumber}
          </span>
        </div>

        {/* Venue & Table Context */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '13px',
            color: THEME.colors.textMain,
          }}
        >
          <span><strong>Table {table.tableNumber}</strong></span>
          <span>•</span>
          <span>{restaurant.name}</span>
          <span>•</span>
          <span style={{ color: THEME.colors.textMuted }}>{formattedTime}</span>
        </div>
      </div>

      {/* Live Order Tracking Status Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderRadius: THEME.radius.xl,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadow.card,
          padding: '18px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
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
            Live Kitchen Tracking
          </h4>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefreshStatus}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              color: THEME.colors.navyPrimary,
              fontSize: '12px',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            <span>⟳</span>
          </button>
        </div>

        {refreshError && (
          <div
            style={{
              fontSize: '12px',
              color: THEME.colors.badgeRed,
              marginBottom: '10px',
            }}
          >
            {refreshError}
          </div>
        )}

        {/* Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: THEME.radius.md,
            backgroundColor: currentBadge.bg,
            border: `1px solid ${currentBadge.color}30`,
          }}
        >
          <span style={{ fontSize: '18px' }}>{currentBadge.icon}</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: currentBadge.color }}>
              {currentBadge.label}
            </div>
            <div style={{ fontSize: '11px', color: THEME.colors.textMuted, marginTop: '2px' }}>
              Delivering directly to Table {table.tableNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Itemized Order Receipt Card */}
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
            margin: '0 0 14px',
          }}
        >
          Order Receipt
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {order.items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: THEME.colors.textMain }}>
                  {it.quantity}x {it.productName}
                </span>
                {it.variantName && (
                  <span style={{ fontSize: '11px', color: THEME.colors.navyPrimary, marginLeft: '6px' }}>
                    ({it.variantName})
                  </span>
                )}
                {it.addons && it.addons.length > 0 && (
                  <div style={{ fontSize: '11px', color: THEME.colors.textMuted }}>
                    + {it.addons.map((a) => a.addonName).join(', ')}
                  </div>
                )}
              </div>

              <span style={{ fontWeight: 700, color: THEME.colors.navyPrimary }}>
                {formatCurrency(it.totalPrice)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: '1px', backgroundColor: THEME.colors.borderSubtle, margin: '10px 0' }} />

        {/* Pricing Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: THEME.colors.textMuted }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 600, color: THEME.colors.textMain }}>
              {formatCurrency(order.pricing.subtotal)}
            </span>
          </div>

          {order.pricing.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: THEME.colors.successGreen }}>
              <span>Coupon Discount</span>
              <span style={{ fontWeight: 600 }}>
                -{formatCurrency(order.pricing.discountAmount)}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: THEME.colors.textMuted }}>
            <span>Taxes</span>
            <span style={{ fontWeight: 600, color: THEME.colors.textMain }}>
              {formatCurrency(order.pricing.taxAmount)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: `1px solid ${THEME.colors.borderSubtle}`,
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 800, color: THEME.colors.navyPrimary }}>
              Total Amount
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: THEME.colors.navyPrimary }}>
              {formatCurrency(order.pricing.totalAmount)}
            </span>
          </div>
        </div>

        {/* Payment Policy Banner */}
        <div
          style={{
            marginTop: '14px',
            padding: '10px 12px',
            borderRadius: THEME.radius.sm,
            backgroundColor: THEME.colors.bgCardSubtle,
            fontSize: '12px',
            color: THEME.colors.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>💳</span>
          <span>Payment Method: <strong>Pay at Restaurant (Cash / Card / UPI)</strong></span>
        </div>
      </div>

      {/* Completion Feedback CTA Card */}
      {liveStatus === 'completed' && onProceedToFeedback && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            borderRadius: THEME.radius.lg,
            backgroundColor: THEME.colors.bgCardHighlight,
            border: '1px solid #e5d8b8',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              marginBottom: '4px',
            }}
          >
            How was your dining experience?
          </div>
          <p
            style={{
              fontSize: '13px',
              color: THEME.colors.textMuted,
              margin: '0 0 12px',
            }}
          >
            Share your feedback on the dishes you enjoyed and earn instant loyalty rewards!
          </p>
          <button
            type="button"
            onClick={() => onProceedToFeedback(order)}
            style={{
              width: '100%',
              height: '46px',
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(23, 63, 112, 0.2)',
            }}
          >
            <span>★ Rate Order & Earn Stars</span>
          </button>
        </div>
      )}

      {/* Return to Menu Button */}
      <div>
        <button
          type="button"
          onClick={onBackToMenu}
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: liveStatus === 'completed' ? THEME.colors.bgCard : THEME.colors.navyPrimary,
            color: liveStatus === 'completed' ? THEME.colors.navyPrimary : '#ffffff',
            border: liveStatus === 'completed' ? `1px solid ${THEME.colors.borderSubtle}` : 'none',
            borderRadius: THEME.radius.md,
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: liveStatus === 'completed' ? 'none' : '0 4px 14px rgba(23, 63, 112, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>← Back to Restaurant Menu</span>
        </button>
      </div>
    </div>
  );
}
