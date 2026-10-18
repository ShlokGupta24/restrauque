import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  MessageSquareText,
  Coins,
  ArrowRight,
  Clock,
  CheckCircle2,
  Coffee,
  UtensilsCrossed,
  Sparkles,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { customerDashboardService } from '../../services/CustomerDashboardService';
import { DemoNoticeBanner } from '../../components/common/DemoNoticeBanner';
import './OverviewPage.css';

interface LayoutOutletContext {
  openLogoutModal: () => void;
}

export const OverviewPage: React.FC = () => {
  const { profile, logout } = useCustomerAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const outletCtx = useOutletContext<LayoutOutletContext | undefined>();

  // Metrics from centralized single source of truth
  const metrics = customerDashboardService.getDashboardMetrics();
  const nbcSummary = customerDashboardService.getRestaurantSummary('res_nbc');
  const bhojSummary = customerDashboardService.getRestaurantSummary('res_bhoj');

  const firstName = profile.name.split(' ')[0] || profile.name;

  const handleLogout = () => {
    if (outletCtx?.openLogoutModal) {
      outletCtx.openLogoutModal();
    } else {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="overview-container">
      <DemoNoticeBanner />

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
            <span className="overview-verified-phone">+91 {profile.phone}</span>
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
                {metrics.reviewsCompleted} Submitted
              </h2>
            </div>
          </div>

          <div className="summary-card-body">
            <div className="feedback-status-pill">
              {metrics.reviewsPending > 0 ? (
                <>
                  <Clock size={14} className="text-amber" />
                  <span>
                    <strong>{metrics.reviewsPending}</strong> completed {metrics.reviewsPending === 1 ? 'order' : 'orders'} awaiting review
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
              Share your dining feedback to earn <strong>+50 loyalty points</strong> per eligible order.
            </p>
          </div>

          <div className="summary-card-footer">
            <button
              type="button"
              className="summary-card-btn primary-action-btn"
              onClick={() => navigate('/account/feedback')}
            >
              <span>{metrics.reviewsPending > 0 ? 'Review Pending Orders' : 'Go to Feedback'}</span>
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
                {metrics.totalLoyaltyPoints} <span className="pts-label">pts</span>
              </h2>
            </div>
          </div>

          <div className="summary-card-body">
            <div className="loyalty-notice-pill">
              Combined informational total across 2 restaurants
            </div>
            <p className="summary-card-text">
              Points are tracked separately for each venue and cannot be cross-spent. View your individual balances below.
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

      {/* Compact "Your restaurants" Section */}
      <section className="your-restaurants-section" aria-label="Configured Restaurants">
        <div className="section-header-compact">
          <div>
            <h2 className="section-title-sm">Your restaurants</h2>
            <p className="section-subtitle-sm">
              Current dining destinations on your Restrauque profile
            </p>
          </div>
        </div>

        <div className="restaurants-compact-grid">
          {/* NBC Cafe Card */}
          <div className="restaurant-compact-card">
            <div className="restaurant-compact-header">
              <div
                className="restaurant-badge-avatar"
                style={{ background: '#e0f2fe', color: '#0369a1' }}
              >
                <Coffee size={20} />
              </div>
              <div className="restaurant-meta-info">
                <div className="restaurant-name-row">
                  <h3 className="restaurant-compact-name">NBC Cafe</h3>
                  <span className="restaurant-tag">Campus Hub</span>
                </div>
                <div className="restaurant-full-name">NBC - Engineering College</div>
              </div>
            </div>

            <div className="restaurant-stats-row">
              <div className="restaurant-stat-block">
                <span className="stat-label">Loyalty Balance</span>
                <span className="stat-value">{nbcSummary.points} pts</span>
              </div>
              <div className="restaurant-stat-block">
                <span className="stat-label">Review Status</span>
                {nbcSummary.pendingReviewsCount > 0 ? (
                  <span className="stat-status-pill pending">
                    {nbcSummary.pendingReviewsCount} awaiting review
                  </span>
                ) : (
                  <span className="stat-status-pill clean">
                    All caught up
                  </span>
                )}
              </div>
            </div>

            <div className="restaurant-compact-actions">
              <button
                type="button"
                className="restaurant-action-btn primary"
                onClick={() => navigate('/account/feedback?restaurant=res_nbc')}
              >
                <span>Open Feedback</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                className="restaurant-action-btn secondary"
                onClick={() => navigate('/account/loyalty?restaurant=res_nbc')}
              >
                <span>View Points</span>
              </button>
            </div>
          </div>

          {/* The Bhoj Family Restaurant Card */}
          <div className="restaurant-compact-card">
            <div className="restaurant-compact-header">
              <div
                className="restaurant-badge-avatar"
                style={{ background: '#fef3c7', color: '#92400e' }}
              >
                <UtensilsCrossed size={20} />
              </div>
              <div className="restaurant-meta-info">
                <div className="restaurant-name-row">
                  <h3 className="restaurant-compact-name">The Bhoj Family Restaurant</h3>
                  <span className="restaurant-tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                    Family Dining
                  </span>
                </div>
                <div className="restaurant-full-name">Authentic North Indian & Chinese</div>
              </div>
            </div>

            <div className="restaurant-stats-row">
              <div className="restaurant-stat-block">
                <span className="stat-label">Loyalty Balance</span>
                <span className="stat-value">{bhojSummary.points} pts</span>
              </div>
              <div className="restaurant-stat-block">
                <span className="stat-label">Review Status</span>
                {bhojSummary.pendingReviewsCount > 0 ? (
                  <span className="stat-status-pill pending">
                    {bhojSummary.pendingReviewsCount} awaiting review
                  </span>
                ) : (
                  <span className="stat-status-pill clean">
                    All caught up
                  </span>
                )}
              </div>
            </div>

            <div className="restaurant-compact-actions">
              <button
                type="button"
                className="restaurant-action-btn primary"
                onClick={() => navigate('/account/feedback?restaurant=res_bhoj')}
              >
                <span>Open Feedback</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                className="restaurant-action-btn secondary"
                onClick={() => navigate('/account/loyalty?restaurant=res_bhoj')}
              >
                <span>View Points</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
