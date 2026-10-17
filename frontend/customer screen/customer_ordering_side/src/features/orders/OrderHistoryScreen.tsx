import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  Menu,
  Clock,
  Receipt,
  ShoppingBag,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { OrderConfirmationDetails, OrderStatus } from '../../services/contracts/types';
import './OrderHistoryScreen.css';

type HistoryFilterTab = 'all' | 'active' | 'completed';

/**
 * Screen: Restaurant-scoped Order History
 * Phase 5 Implementation:
 * - Scoped exclusively to current restaurant & table QR session
 * - Fetches order details using backend's existing order-by-ID pattern
 * - Displays items, quantities, price, timestamp, and authoritative status
 * - Completed status is strictly 'completed'
 * - Provides empty, loading, error, and actionable states
 */
export const OrderHistoryScreen: React.FC = () => {
  const { goBack, navigateTo, openNav, restaurant, activeOrderId } = useApp();
  const [orders, setOrders] = useState<OrderConfirmationDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HistoryFilterTab>('all');

  const restaurantId = restaurant?.id || 'rest-nbc-01';

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch restaurant-scoped orders via data service
      let fetched = await customerDataService.getCustomerOrders(restaurantId);

      // If activeOrderId exists and not yet in list, fetch its status directly using order-by-ID
      if (activeOrderId && !fetched.some((o) => o.orderId === activeOrderId)) {
        try {
          const single = await customerDataService.getOrderStatus(activeOrderId);
          if (single) {
            fetched = [single, ...fetched];
          }
        } catch {
          // Ignore single fetch failure if already listed
        }
      }

      // Enforce strictly authoritative completed status
      const normalized = fetched.map((ord) => ({
        ...ord,
        status: String(ord.status).toLowerCase() === 'completed' ? ('completed' as OrderStatus) : ord.status,
      }));

      setOrders(normalized);
    } catch (err) {
      console.error('Failed to load order history:', err);
      setError('Unable to load your orders. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId, activeOrderId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Status mapping and badge class helper
  const getStatusBadgeMeta = (status: OrderStatus | string) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case 'completed':
        return {
          label: 'Completed',
          className: 'status-badge-completed',
        };
      case 'preparing':
      case 'in_kitchen':
        return {
          label: 'Preparing in Kitchen',
          className: 'status-badge-preparing',
        };
      case 'ready':
        return {
          label: 'Ready to Serve',
          className: 'status-badge-ready',
        };
      case 'served':
        return {
          label: 'Served to Table',
          className: 'status-badge-served',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'status-badge-cancelled',
        };
      case 'pending':
      default:
        return {
          label: 'Order Placed',
          className: 'status-badge-pending',
        };
    }
  };

  // Filter orders by active tab
  const filteredOrders = useMemo(() => {
    if (activeTab === 'active') {
      return orders.filter((o) => {
        const s = String(o.status).toLowerCase();
        return s === 'pending' || s === 'preparing' || s === 'ready';
      });
    }
    if (activeTab === 'completed') {
      return orders.filter((o) => {
        const s = String(o.status).toLowerCase();
        return s === 'completed' || s === 'served';
      });
    }
    return orders;
  }, [orders, activeTab]);

  const activeCount = useMemo(() => {
    return orders.filter((o) => {
      const s = String(o.status).toLowerCase();
      return s === 'pending' || s === 'preparing' || s === 'ready';
    }).length;
  }, [orders]);

  const completedCount = useMemo(() => {
    return orders.filter((o) => {
      const s = String(o.status).toLowerCase();
      return s === 'completed' || s === 'served';
    }).length;
  }, [orders]);

  const formatTimestamp = (raw: string) => {
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      // Fallback
    }
    return raw;
  };

  return (
    <div className="order-history-page">
      {/* Top Header */}
      <header className="order-history-header">
        <button
          className="header-icon-btn back-btn"
          onClick={goBack}
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="header-page-title">Order History</h1>
        <button
          className="header-icon-btn hamburger-btn"
          onClick={openNav}
          aria-label="Navigation menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Venue Context Banner */}
      <div className="history-venue-banner">
        <div className="history-venue-info">
          <UtensilsCrossed size={16} className="venue-cross-icon" />
          <span className="history-venue-name">{restaurant?.name || 'NBC - Engineering College'}</span>
          <span className="history-table-pill">{restaurant?.tableLabel || 'Table F18'}</span>
        </div>
        <p className="history-venue-desc">
          Orders placed at this restaurant during your current dining session.
        </p>
      </div>

      {/* Filter Tabs */}
      {!loading && !error && orders.length > 0 && (
        <div className="history-tabs-container">
          <div className="history-tabs-list" role="tablist">
            <button
              className={`history-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
              type="button"
            >
              <span>All Orders</span>
              <span className="tab-count-badge">{orders.length}</span>
            </button>
            <button
              className={`history-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
              type="button"
            >
              <span>Active</span>
              {activeCount > 0 && <span className="tab-count-badge active-highlight">{activeCount}</span>}
            </button>
            <button
              className={`history-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
              type="button"
            >
              <span>Completed</span>
              {completedCount > 0 && <span className="tab-count-badge">{completedCount}</span>}
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <main className="order-history-content">
        {loading ? (
          <div className="history-loading-state">
            <div className="history-spinner" />
            <p className="loading-text">Loading your dining history...</p>
          </div>
        ) : error ? (
          <div className="history-error-state">
            <AlertCircle size={40} className="error-icon" />
            <h3 className="error-title">Couldn&apos;t Load Orders</h3>
            <p className="error-desc">{error}</p>
            <button
              className="retry-btn"
              onClick={loadOrders}
              type="button"
            >
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="history-empty-state">
            <div className="empty-icon-circle">
              <Receipt size={38} className="empty-receipt-icon" />
            </div>
            <h2 className="empty-state-title">No Orders Placed Yet</h2>
            <p className="empty-state-desc">
              You haven&apos;t placed any orders at {restaurant?.name || 'this restaurant'} yet.
              Explore our freshly prepared menu and order right to your table!
            </p>
            <button
              className="explore-menu-cta"
              onClick={() => navigateTo('menu')}
              type="button"
            >
              <ShoppingBag size={18} />
              <span>Browse Menu</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="history-filter-empty">
            <p>No {activeTab} orders found in this session.</p>
            <button
              className="switch-tab-btn"
              onClick={() => setActiveTab('all')}
              type="button"
            >
              View All Orders ({orders.length})
            </button>
          </div>
        ) : (
          <div className="history-orders-list">
            {filteredOrders.map((ord) => {
              const badge = getStatusBadgeMeta(ord.status);
              const isCompleted = String(ord.status).toLowerCase() === 'completed';
              const isActive = String(ord.status).toLowerCase() === 'preparing' || String(ord.status).toLowerCase() === 'pending';

              return (
                <article key={ord.orderId} className="history-order-card">
                  {/* Card Header */}
                  <div className="order-card-header">
                    <div>
                      <div className="order-card-id-row">
                        <span className="order-card-id">
                          {ord.orderNumber || `Order #${ord.orderId.slice(-6).toUpperCase()}`}
                        </span>
                        <span className="order-card-payment-tag">
                          {ord.paymentMethod || 'Dine-in'}
                        </span>
                      </div>
                      <div className="order-card-time">
                        <Clock size={13} />
                        <span>{formatTimestamp(ord.orderedAt)}</span>
                      </div>
                    </div>
                    <span className={`order-status-badge ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Items Summary */}
                  <div className="order-card-items">
                    {ord.items.map((item, idx: number) => (
                      <div key={idx} className="order-item-row">
                        <span className="order-item-qty">{item.quantity}×</span>
                        <div className="order-item-details">
                          <span className="order-item-name">{item.name}</span>
                          {item.variantName && (
                            <span className="order-item-variant">{item.variantName}</span>
                          )}
                        </div>
                        <span className="order-item-price">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total & Summary */}
                  <div className="order-card-footer">
                    <div className="order-items-count-label">
                      {ord.items.reduce((s, i) => s + i.quantity, 0)} items
                    </div>
                    <div className="order-total-block">
                      <span className="order-total-label">Total:</span>
                      <span className="order-total-value">
                        ₹{(ord.bill?.totalAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="order-card-actions">
                    {isCompleted ? (
                      <button
                        className="order-action-feedback-btn"
                        onClick={() => navigateTo('feedback', { orderId: ord.orderId })}
                        type="button"
                      >
                        <MessageSquare size={16} />
                        <span>Leave Feedback</span>
                      </button>
                    ) : isActive ? (
                      <button
                        className="order-action-track-btn"
                        onClick={() => navigateTo('order-confirmation', { orderId: ord.orderId })}
                        type="button"
                      >
                        <Clock size={16} />
                        <span>Track Live Status</span>
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
