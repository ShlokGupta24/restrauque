import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Clock, LogOut, AlertCircle, ChevronRight, User, UtensilsCrossed, Sparkles } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { MAIN_RESTRAUQUE_WEBSITE_URL } from '../../config/restaurantTheme';
import { RestrauqueLogo } from '../../components/RestrauqueLogo';
import { fetchCustomerLoyalty, isValidUuid, CustomerLoyaltySummary } from '../../services/loyaltyService';
import './CustomerHamburgerNav.css';

/**
 * Shared 3-horizontal-line Hamburger Navigation Drawer.
 * Requirement: Exactly two options:
 * 1. Profile: opens the main Restrauque website configured in the app (or clearly indicates unconfigured state; no invented fallback).
 * 2. Order History: navigates to the customer's order history screen.
 * Accessible across authenticated screens; closes on backdrop tap, close button, or Escape key.
 */
export const CustomerHamburgerNav: React.FC = () => {
  const {
    isNavOpen,
    openNav,
    closeNav,
    navigateTo,
    currentScreen,
    auth,
    restaurant,
    logout,
  } = useApp();

  const [showUnconfiguredModal, setShowUnconfiguredModal] = useState<boolean>(false);
  const [loyalty, setLoyalty] = useState<CustomerLoyaltySummary | null>(null);

  // Fetch server-authoritative customer loyalty summary for current restaurant when drawer opens
  useEffect(() => {
    if (!isNavOpen || !auth.isAuthenticated || !restaurant?.id || !isValidUuid(restaurant.id)) {
      setLoyalty(null);
      return;
    }

    const controller = new AbortController();
    fetchCustomerLoyalty(restaurant.id, controller.signal)
      .then((data) => setLoyalty(data))
      .catch(() => {
        // Unauthenticated or network drop: do not display fabricated loyalty info
        setLoyalty(null);
      });

    return () => controller.abort();
  }, [isNavOpen, auth.isAuthenticated, restaurant?.id]);

  // Listen to fallback window event if triggered from any component
  useEffect(() => {
    const handleOpenEvent = () => openNav();
    window.addEventListener('open-hamburger-nav', handleOpenEvent);
    return () => window.removeEventListener('open-hamburger-nav', handleOpenEvent);
  }, [openNav]);

  // Handle Escape key to close navigation drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNavOpen) {
        closeNav();
        setShowUnconfiguredModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen, closeNav]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setShowUnconfiguredModal(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isNavOpen]);

  // Do not render navigation drawer on unauthenticated login/OTP screens or QR error screens
  if (currentScreen === 'auth-login' || currentScreen === 'auth-otp' || currentScreen === 'qr-error') {
    return null;
  }

  const handleProfileClick = () => {
    if (MAIN_RESTRAUQUE_WEBSITE_URL && MAIN_RESTRAUQUE_WEBSITE_URL.trim() !== '') {
      // Securely open main platform website in a new tab without passing auth credentials
      window.open(MAIN_RESTRAUQUE_WEBSITE_URL, '_blank', 'noopener,noreferrer');
      closeNav();
    } else {
      // Per brief: The owner will supply the URL. Do not invent it. Clearly indicate unconfigured state.
      setShowUnconfiguredModal(true);
    }
  };

  const handleOrderHistoryClick = () => {
    navigateTo('order-history');
    closeNav();
  };

  const handleLogoutClick = async () => {
    closeNav();
    try {
      await logout();
    } catch (e) {
      console.warn('Logout network notice:', e);
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`hamburger-backdrop ${isNavOpen ? 'visible' : ''}`}
        onClick={closeNav}
        aria-hidden={!isNavOpen}
      />

      {/* Mobile App Popup Bottom Sheet */}
      <aside
        className={`hamburger-drawer ${isNavOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Navigation Menu"
        aria-modal="true"
      >
        {/* Mobile drag handle indicator */}
        <div className="drawer-handle-bar" aria-hidden="true">
          <span className="drawer-handle-pill" />
        </div>

        {/* Header with Restrauque branding and Close button */}
        <div className="hamburger-drawer-header">
          <div className="drawer-brand-wrap">
            <RestrauqueLogo size="sm" showText={true} />
          </div>
          <button
            className="drawer-close-btn"
            onClick={closeNav}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Customer & Current Table Session Card */}
        <div className="drawer-session-card">
          <div className="drawer-avatar">
            <User size={22} className="avatar-icon" />
          </div>
          <div className="drawer-user-info">
            <div className="drawer-user-phone">
              {auth.customerName || (auth.phone ? `+91 ${auth.phone}` : 'Guest Diner')}
            </div>
            <div className="drawer-table-badge">
              <UtensilsCrossed size={12} className="table-badge-icon" />
              <span>{restaurant?.name || 'Restrauque'} • {restaurant?.tableLabel || 'Table'}</span>
            </div>
            {loyalty && (
              <div className="drawer-loyalty-chip" title={`${loyalty.programName} (${loyalty.tier} tier)`}>
                <Sparkles size={11} className="loyalty-chip-icon" />
                <span>{loyalty.starsBalance} Stars ({loyalty.programName})</span>
              </div>
            )}
          </div>
          <div className="session-active-dot" title="Active Dine-in Session" />
        </div>

        {/* Navigation Options — Exactly 2 items */}
        <nav className="hamburger-nav-list" aria-label="Main Menu">
          {/* Option 1: Profile */}
          <button
            className="hamburger-nav-item profile-item"
            onClick={handleProfileClick}
            type="button"
          >
            <div className="nav-item-icon-box">
              <User size={20} className="nav-icon" />
            </div>
            <div className="nav-item-text">
              <span className="nav-item-title">Profile</span>
              <span className="nav-item-subtitle">Main Restrauque website</span>
            </div>
            <ExternalLink size={16} className="nav-item-arrow" />
          </button>

          {/* Option 2: Order History */}
          <button
            className={`hamburger-nav-item history-item ${currentScreen === 'order-history' ? 'active' : ''}`}
            onClick={handleOrderHistoryClick}
            type="button"
          >
            <div className="nav-item-icon-box">
              <Clock size={20} className="nav-icon" />
            </div>
            <div className="nav-item-text">
              <span className="nav-item-title">Order History</span>
              <span className="nav-item-subtitle">Your orders at this restaurant</span>
            </div>
            <ChevronRight size={18} className="nav-item-arrow" />
          </button>
        </nav>

        {/* Drawer Footer with Logout & Version */}
        <div className="hamburger-drawer-footer">
          <button
            className="drawer-logout-btn"
            onClick={handleLogoutClick}
            type="button"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <div className="drawer-version-tag">
            Restrauque Dine-in Experience v1.0
          </div>
        </div>

        {/* Unconfigured Website Notice Modal */}
        {showUnconfiguredModal && (
          <div className="unconfigured-modal-overlay">
            <div className="unconfigured-modal-card">
              <div className="modal-icon-header">
                <AlertCircle size={28} className="modal-alert-icon" />
                <h3 className="modal-alert-title">Platform Website Unconfigured</h3>
              </div>
              <p className="modal-alert-body">
                The main Restrauque website URL will be supplied by the platform owner.
                In production, this option opens the customer&apos;s central Restrauque profile.
              </p>
              <div className="modal-env-hint">
                <code>VITE_MAIN_WEBSITE_URL</code> is currently unset.
              </div>
              <button
                className="modal-dismiss-btn"
                onClick={() => setShowUnconfiguredModal(false)}
                type="button"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
