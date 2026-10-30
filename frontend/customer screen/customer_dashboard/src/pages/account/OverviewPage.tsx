import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  MessageSquareText,
  Coins,
  ArrowRight,
  Clock,
  CheckCircle2,
  UtensilsCrossed,
  Sparkles,
  LogOut,
  Sun,
  Moon,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchCustomerDashboardOverview,
  CustomerDashboardOverviewResponse,
} from '../../services/overviewService';
import {
  fetchCustomerOrders,
  CustomerOrderHistoryItem,
} from '../../services/orderService';
import { LoadingState } from '../../components/common/LoadingState';
import './OverviewPage.css';

interface LayoutOutletContext {
  openLogoutModal: () => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const OverviewPage: React.FC = () => {
  const { profile, logout } = useCustomerAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const outletCtx = useOutletContext<LayoutOutletContext | undefined>();

  // Live overview API state
  const [overview, setOverview] = useState<CustomerDashboardOverviewResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetchCustomerDashboardOverview(signal),
      fetchCustomerOrders({ limit: 3 }, signal),
    ]).then(([overviewResult, ordersResult]) => {
      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
      } else {
        const err = overviewResult.reason;
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || (err as { code?: string }).code === 'ABORTED')
        ) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Unable to load account overview.';
        setError(message);
      }

      if (ordersResult.status === 'fulfilled') {
        setRecentOrders(ordersResult.value.orders);
      }

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadOverview(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOverview]);

  const handleLogout = () => {
    if (outletCtx?.openLogoutModal) {
      outletCtx.openLogoutModal();
    } else {
      logout();
      navigate('/login');
    }
  };

  // Derive display values from live data (fallback to session profile where safe)
  const customerName = overview?.customer?.name || profile.name || 'Customer';
  const firstName = customerName.split(' ')[0] || customerName;
  const customerPhone = overview?.customer?.phone || profile.phone;

  const feedbackSummary = overview?.feedbackSummary ?? {
    pendingFeedbackCount: 0,
    submittedFeedbackCount: 0,
    completedOrdersCount: 0,
  };

  const loyaltyAccounts = overview?.loyaltyAccounts ?? [];
  const totalLoyaltyPoints = loyaltyAccounts.reduce(
    (sum, acc) => sum + (acc.pointsBalance || 0),
    0
  );
  const recentPointsActivity = overview?.recentPointsActivity ?? [];

  return (
    <div className="overview-container">
      {/* Greeting Header */}
      <header className="overview-header-section">
        <div className="overview-header-top-row">
          <div className="overview-greeting-pill">
            <Sparkles size={14} className="greeting-sparkle" />
            <span>Hello, {firstName}</span>
          </div>

          <div className="overview-user-logout-wrap">
            <button
              type="button"
              className="overview-theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={13} className="text-amber" /> : <Moon size={13} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            {customerPhone && (
              <span className="overview-verified-phone">
                {customerPhone.startsWith('+') ? customerPhone : `+91 ${customerPhone}`}
              </span>
            )}
            <button
              type="button"
              className="overview-logout-btn"
              onClick={handleLogout}
              title="Log out of customer account"
            >
              <LogOut size={13} />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        <h1 className="overview-page-title">Your Restrauque account</h1>
        <p className="overview-page-subtitle">
          Track your dining feedback, review completed visits, and view your separate restaurant loyalty points.
        </p>
      </header>

      {/* Loading State */}
      {loading && !overview && (
        <div className="overview-loading-container" role="status" aria-live="polite">
          <LoadingState message="Fetching your real-time account overview..." />
        </div>
      )}

      {/* Recoverable Error State */}
      {error && !overview && (
        <div className="overview-error-card" role="alert">
          <div className="overview-error-icon">
            <AlertCircle size={26} />
          </div>
          <div className="overview-error-content">
            <h3 className="overview-error-title">Unable to load dashboard</h3>
            <p className="overview-error-message">{error}</p>
          </div>
          <button
            type="button"
            className="overview-retry-btn"
            onClick={() => loadOverview()}
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Live Content Section */}
      {overview && (
        <>
          {/* Two Prominent Summary Cards: Feedback & Loyalty */}
          <section className="overview-summary-grid" aria-label="Account Summary">
            {/* Card 1: Feedback Summary */}
            <div className="summary-card feedback-summary-card">
              <div className="summary-card-top">
                <div className="summary-card-icon feedback-icon-bg">
                  <MessageSquareText size={22} />
                </div>
                <div className="summary-card-meta">
                  <span className="summary-card-label">Dining Feedback</span>
                  <h2 className="summary-card-heading">
                    {feedbackSummary.submittedFeedbackCount} Submitted
                  </h2>
                </div>
              </div>

              <div className="summary-card-body">
                <div className="feedback-status-pill">
                  {feedbackSummary.pendingFeedbackCount > 0 ? (
                    <>
                      <Clock size={14} className="text-amber" />
                      <span>
                        <strong>{feedbackSummary.pendingFeedbackCount}</strong> completed{' '}
                        {feedbackSummary.pendingFeedbackCount === 1 ? 'order' : 'orders'} awaiting review
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} className="text-emerald" />
                      <span>All completed orders have been reviewed</span>
                    </>
                  )}
                </div>
                <p className="summary-card-text">
                  {feedbackSummary.completedOrdersCount > 0 ? (
                    <>
                      You have completed <strong>{feedbackSummary.completedOrdersCount}</strong>{' '}
                      {feedbackSummary.completedOrdersCount === 1 ? 'dining visit' : 'dining visits'}. Share feedback to earn loyalty rewards.
                    </>
                  ) : (
                    <>Share your dining feedback after placing an order to earn restaurant loyalty points.</>
                  )}
                </p>
              </div>

              <div className="summary-card-footer">
                <button
                  type="button"
                  className="summary-card-btn primary-action-btn"
                  onClick={() => navigate('/account/feedback')}
                >
                  <span>
                    {feedbackSummary.pendingFeedbackCount > 0
                      ? 'Review Pending Orders'
                      : 'Go to Feedback'}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Card 2: Loyalty Summary */}
            <div className="summary-card loyalty-summary-card">
              <div className="summary-card-top">
                <div className="summary-card-icon loyalty-icon-bg">
                  <Coins size={22} />
                </div>
                <div className="summary-card-meta">
                  <span className="summary-card-label">Loyalty Points</span>
                  <h2 className="summary-card-heading">
                    {totalLoyaltyPoints} <span className="pts-label">pts</span>
                  </h2>
                </div>
              </div>

              <div className="summary-card-body">
                <div className="loyalty-notice-pill">
                  {loyaltyAccounts.length > 0
                    ? `Combined informational total across ${loyaltyAccounts.length} ${
                        loyaltyAccounts.length === 1 ? 'restaurant' : 'restaurants'
                      }`
                    : 'No active loyalty accounts yet'}
                </div>
                <p className="summary-card-text">
                  Points are tracked separately for each venue and cannot be cross-spent. View individual restaurant balances below.
                </p>
              </div>

              <div className="summary-card-footer">
                <button
                  type="button"
                  className="summary-card-btn secondary-action-btn"
                  onClick={() => navigate('/account/loyalty')}
                >
                  <span>View Loyalty Points</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Recent Orders Preview Section (Backed by GET /api/v1/customer/orders) */}
          {recentOrders.length > 0 && (
            <section className="overview-recent-orders-section" aria-label="Recent Orders">
              <div className="section-header-compact">
                <div>
                  <h2 className="section-title-sm">Recent Orders</h2>
                  <p className="section-subtitle-sm">Your latest dining visits and itemized receipts</p>
                </div>
                <button
                  type="button"
                  className="overview-view-all-link-btn"
                  onClick={() => navigate('/account/orders')}
                >
                  <span>View All Orders</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="overview-orders-preview-grid">
                {recentOrders.map((ord) => (
                  <div key={ord.id} className="overview-order-preview-card">
                    <div className="overview-order-top">
                      <div className="overview-order-meta">
                        <span className="overview-order-venue">
                          {ord.restaurant?.name || 'Partner Restaurant'}
                        </span>
                        <span className="overview-order-date">
                          {formatDate(ord.orderedAt)}
                        </span>
                      </div>
                      <span className={`overview-status-pill ${ord.status}`}>
                        {ord.status}
                      </span>
                    </div>

                    <div className="overview-order-body">
                      <div className="overview-order-items-snippet">
                        {ord.itemsSummary.length > 0
                          ? ord.itemsSummary.map((it) => `${it.quantity}× ${it.productName}`).join(', ')
                          : `${ord.itemCount} items ordered`}
                      </div>
                      <div className="overview-order-total">
                        ₹{ord.pricing.totalAmountFormatted}
                      </div>
                    </div>

                    <div className="overview-order-actions">
                      <button
                        type="button"
                        className="overview-order-detail-btn"
                        onClick={() => navigate(`/account/orders/${encodeURIComponent(ord.id)}`)}
                      >
                        <span>View Receipt</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* "Your restaurants" Section */}
          <section className="your-restaurants-section" aria-label="Configured Restaurants">
            <div className="section-header-compact">
              <div>
                <h2 className="section-title-sm">Your restaurants</h2>
                <p className="section-subtitle-sm">
                  Active restaurant memberships and loyalty balances on your profile
                </p>
              </div>
            </div>

            {loyaltyAccounts.length === 0 ? (
              <div className="overview-empty-card">
                <div className="overview-empty-icon-wrap">
                  <ShoppingBag size={24} />
                </div>
                <h3 className="overview-empty-title">No restaurant memberships yet</h3>
                <p className="overview-empty-desc">
                  When you dine at a partner restaurant and place an order using your phone number,
                  your visit history, pending reviews, and separate restaurant loyalty points will appear here.
                </p>
              </div>
            ) : (
              <div className="restaurants-compact-grid">
                {loyaltyAccounts.map((account) => (
                  <div key={account.accountId} className="restaurant-compact-card">
                    <div className="restaurant-compact-header">
                      <div
                        className="restaurant-badge-avatar"
                        style={{ background: '#fef3c7', color: '#b45309' }}
                      >
                        <UtensilsCrossed size={20} />
                      </div>
                      <div className="restaurant-meta-info">
                        <div className="restaurant-name-row">
                          <h3 className="restaurant-compact-name">{account.restaurantName}</h3>
                          <span className="restaurant-tag">{account.tier || 'Member'}</span>
                        </div>
                        <div className="restaurant-full-name">
                          {account.programName || 'Loyalty Rewards'}
                        </div>
                      </div>
                    </div>

                    <div className="restaurant-stats-row">
                      <div className="restaurant-stat-block">
                        <span className="stat-label">Loyalty Balance</span>
                        <span className="stat-value">{account.pointsBalance} pts</span>
                      </div>
                      <div className="restaurant-stat-block">
                        <span className="stat-label">Membership Tier</span>
                        <span className="stat-status-pill clean">
                          <Award size={11} style={{ display: 'inline', marginRight: 4 }} />
                          {account.tier || 'Standard'}
                        </span>
                      </div>
                    </div>

                    <div className="restaurant-compact-actions">
                      <button
                        type="button"
                        className="restaurant-action-btn primary"
                        onClick={() =>
                          navigate(
                            `/account/feedback?restaurant=${encodeURIComponent(account.restaurantId)}`
                          )
                        }
                      >
                        <span>Open Feedback</span>
                        <ArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        className="restaurant-action-btn secondary"
                        onClick={() =>
                          navigate(
                            `/account/loyalty?restaurant=${encodeURIComponent(account.restaurantId)}`
                          )
                        }
                      >
                        <span>View Points</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Points Activity Section (Supported by Backend Endpoint) */}
          {recentPointsActivity.length > 0 && (
            <section className="recent-activity-section" aria-label="Recent Points Activity">
              <div className="section-header-compact">
                <div>
                  <h2 className="section-title-sm">Recent Points Activity</h2>
                  <p className="section-subtitle-sm">
                    Recent points earned and redeemed across your dining visits
                  </p>
                </div>
              </div>

              <div className="activity-list">
                {recentPointsActivity.map((activity) => {
                  const isEarn =
                    activity.isEarned ||
                    activity.action === 'earn' ||
                    (activity.pointsDelta ?? 0) > 0;
                  return (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-left">
                        <div
                          className="activity-icon-badge"
                          style={{
                            background: isEarn ? '#ecfdf5' : '#fef2f2',
                            color: isEarn ? '#059669' : '#dc2626',
                          }}
                        >
                          <TrendingUp size={16} />
                        </div>
                        <div className="activity-details">
                          <div className="activity-title-row">
                            <span className="activity-restaurant-name">
                              {activity.restaurantName}
                            </span>
                            <span className="activity-date">
                              {formatDate(activity.createdAt)}
                            </span>
                          </div>
                          <div className="activity-desc">
                            {activity.description ||
                              (isEarn ? 'Earned from order' : 'Points redeemed')}
                          </div>
                        </div>
                      </div>

                      <div className="activity-right">
                        <span
                          className={`activity-delta ${isEarn ? 'earn' : 'redeem'}`}
                        >
                          {isEarn ? '+' : ''}
                          {activity.pointsDelta ?? activity.points} pts
                        </span>
                        {activity.balanceAfter !== null && (
                          <span className="activity-balance-after">
                            Bal: {activity.balanceAfter} pts
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

