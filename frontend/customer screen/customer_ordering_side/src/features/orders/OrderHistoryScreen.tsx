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
  LogIn,
} from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { fetchCustomerOrders, type CustomerOrderHistoryItem } from '../../services/orderService';
import { ApiClientError } from '../../services/apiClient';
import './OrderHistoryScreen.css';

type HistoryFilterTab = 'all' | 'active' | 'completed';

/**
 * Screen: Customer Order History
 * Integrates directly with real backend GET /api/v1/customer/orders.
 * Displays authoritative orders placed by the authenticated customer.
 */
export const OrderHistoryScreen: React.FC = () => {
  const { goBack, navigateTo, openNav, restaurant, auth, setActiveOrderId } = useApp();
  const [orders, setOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HistoryFilterTab>('all');

  const loadOrders = useCallback(async () => {
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchCustomerOrders({ limit: 20 });
      setOrders(response.orders);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || 'Unable to load your orders.');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Status mapping and badge class helper
  const getStatusBadgeMeta = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'completed':
        return {
          label: 'Completed',
          className: 'status-badge-completed',
        };
      case 'preparing':
        return {
          label: 'In Kitchen',
          className: 'status-badge-preparing',
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
        const s = o.status.toLowerCase();
        return s === 'pending' || s === 'preparing';
      });
    }
    if (activeTab === 'completed') {
      return orders.filter((o) => {
        const s = o.status.toLowerCase();
        return s === 'completed' || s === 'served';
      });
    }
    return orders;
  }, [orders, activeTab]);

  const activeCount = useMemo(() => {
    return orders.filter((o) => {
      const s = o.status.toLowerCase();
      return s === 'pending' || s === 'preparing';
    }).length;
  }, [orders]);

  const completedCount = useMemo(() => {
    return orders.filter((o) => {
      const s = o.status.toLowerCase();
      return s === 'completed' || s === 'served';
    }).length;
  }, [orders]);

  const formatTimestamp = (raw: string) => {
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', {
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
          <span className="history-venue-name">{restaurant?.name || 'Restaurant'}</span>
          <span className="history-table-pill">
            {restaurant?.tableLabel || (restaurant?.tableNumber ? `Table ${restaurant.tableNumber}` : 'Dining Table')}
          </span>
        </div>
        <p className="history-venue-desc">
          Authoritative record of your dine-in orders placed across sessions.
        </p>
      </div>

      {/* Unauthenticated State */}
      {!auth.isAuthenticated && (
        <div className="history-empty-state" style={{ padding: '60px 20px' }}>
          <div className="empty-icon-circle">
            <LogIn size={38} className="empty-receipt-icon" />
          </div>
          <h2 className="empty-state-title">Sign in to View Orders</h2>
          <p className="empty-state-desc">
            Please sign in with your mobile number to view your past orders, status, and receipts.
          </p>
          <button
            className="explore-menu-cta"
            onClick={() => navigateTo('auth-login')}
            type="button"
          >
            <LogIn size={18} />
            <span>Sign In</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      {auth.isAuthenticated && !loading && !error && orders.length > 0 && (
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
      {auth.isAuthenticated && (
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
                You haven&apos;t placed any orders yet. Explore our freshly prepared menu and order right to your table!
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
                const isCompleted = ord.status.toLowerCase() === 'completed';
                const isActive = ord.status.toLowerCase() === 'preparing' || ord.status.toLowerCase() === 'pending';
                const currency = ord.pricing?.currency === 'INR' ? '₹' : (ord.pricing?.currency || '₹');

                return (
                  <article key={ord.id} className="history-order-card">
                    {/* Card Header */}
                    <div className="order-card-header">
                      <div>
                        <div className="order-card-id-row">
                          <span className="order-card-id">
                            {ord.orderNumber}
                          </span>
                          <span className="order-card-payment-tag">
                            {ord.restaurant?.name || 'Dine-in'}
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
                      {ord.itemsSummary.map((item) => (
                        <div key={item.id} className="order-item-row">
                          <span className="order-item-qty">{item.quantity}×</span>
                          <div className="order-item-details">
                            <span className="order-item-name">{item.productName}</span>
                          </div>
                          <span className="order-item-price">
                            {currency} {item.totalPriceFormatted}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total & Summary */}
                    <div className="order-card-footer">
                      <div className="order-items-count-label">
                        {ord.itemCount} {ord.itemCount === 1 ? 'item' : 'items'}
                      </div>
                      <div className="order-total-block">
                        <span className="order-total-label">Total:</span>
                        <span className="order-total-value">
                          {currency} {ord.pricing.totalAmountFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="order-card-actions">
                      {isCompleted ? (
                        <button
                          className="order-action-feedback-btn"
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            navigateTo('feedback', { orderId: ord.id });
                          }}
                          type="button"
                        >
                          <MessageSquare size={16} />
                          <span>{ord.hasFeedback ? 'View Feedback' : 'Leave Feedback'}</span>
                        </button>
                      ) : isActive ? (
                        <button
                          className="order-action-track-btn"
                          onClick={() => {
                            setActiveOrderId(ord.id);
                            navigateTo('order-confirmation');
                          }}
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
      )}
    </div>
  );
};
