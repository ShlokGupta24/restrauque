import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquareText,
  Coins,
  LogOut,
  ExternalLink,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import { RestrauqueLogo } from '../common/RestrauqueLogo';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { customerDashboardService } from '../../services/CustomerDashboardService';
import './CustomerAccountLayout.css';

export const CustomerAccountLayout: React.FC = () => {
  const { profile, logout } = useCustomerAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Derive metrics for badges
  const metrics = customerDashboardService.getDashboardMetrics();

  const navLinks = [
    {
      to: '/account',
      end: true,
      label: 'Overview',
      icon: <LayoutDashboard size={19} className="nav-icon" />,
    },
    {
      to: '/account/feedback',
      end: false,
      label: 'Feedback',
      icon: <MessageSquareText size={19} className="nav-icon" />,
      badge: metrics.reviewsPending > 0 ? `${metrics.reviewsPending} Pending` : undefined,
      badgeColor: metrics.reviewsPending > 0 ? 'red' : undefined,
    },
    {
      to: '/account/loyalty',
      end: false,
      label: 'Loyalty Points',
      icon: <Coins size={19} className="nav-icon" />,
    },
  ];

  const handleConfirmLogout = () => {
    setSigningOut(true);
    setTimeout(() => {
      logout();
      navigate('/login');
    }, 150);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine active title for mobile top bar
  const getPageTitle = () => {
    if (location.pathname === '/account' || location.pathname === '/account/') return 'Overview';
    if (location.pathname.startsWith('/account/feedback')) return 'Feedback';
    if (location.pathname.startsWith('/account/loyalty')) return 'Loyalty Points';
    return 'Customer Account';
  };

  return (
    <div className="customer-layout-shell">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="customer-sidebar" aria-label="Desktop Primary Sidebar">
        <div className="customer-sidebar-brand">
          <RestrauqueLogo size="md" />
        </div>

        {/* Navigation Section with ONLY 3 items */}
        <div className="customer-nav-section">
          <div className="customer-nav-title">Customer Account</div>
          <nav className="customer-nav-list" aria-label="Main Navigation">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `customer-nav-link ${isActive ? 'active' : ''}`
                }
              >
                {item.icon}
                <span className="customer-nav-label">{item.label}</span>
                {item.badge && (
                  <span
                    className="nav-badge-pill"
                    style={{
                      background: item.badgeColor === 'red' ? '#fee2e2' : 'var(--bg-subtle)',
                      color: item.badgeColor === 'red' ? '#b91c1c' : 'var(--text-secondary)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer: Customer Identity & Logout */}
        <div className="customer-sidebar-footer">
          {/* User Meta Card */}
          <div className="customer-sidebar-user-card">
            <div className="customer-avatar" aria-hidden="true">
              {getInitials(profile.name)}
            </div>
            <div className="customer-user-meta">
              <div className="customer-user-name" title={profile.name}>
                {profile.name}
              </div>
              <div className="customer-user-phone">+91 {profile.phone}</div>
            </div>
          </div>

          {/* Sidebar Actions: theme toggle, ordering menu & Log Out */}
          <div className="customer-sidebar-actions">
            <button
              type="button"
              className="footer-link-btn theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle light and dark mode"
            >
              {theme === 'dark' ? (
                <Sun size={15} className="theme-toggle-icon sun" />
              ) : (
                <Moon size={15} className="theme-toggle-icon moon" />
              )}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <a
              href="http://localhost:4173/nbc-cafe"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link-btn"
              title="Open Dine-in Ordering Interface"
            >
              <ExternalLink size={15} />
              <span>Ordering Menu</span>
            </a>

            <button
              type="button"
              className="footer-link-btn logout-action-btn"
              onClick={() => setShowLogoutModal(true)}
              disabled={signingOut}
              title="Log out of customer account"
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="customer-main-area">
        {/* Mobile Sticky Header with Theme Toggle & Log Out */}
        <header className="customer-mobile-header" aria-label="Mobile Navigation Header">
          <div className="mobile-header-brand">
            <RestrauqueLogo size="sm" />
          </div>
          <div className="mobile-header-title">{getPageTitle()}</div>
          <div className="mobile-header-actions">
            <button
              type="button"
              className="mobile-header-theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="mobile-header-logout-btn"
              onClick={() => setShowLogoutModal(true)}
              title="Log out of customer account"
              aria-label="Log Out"
            >
              <LogOut size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="customer-content">
          <Outlet context={{ openLogoutModal: () => setShowLogoutModal(true) }} />
        </main>

        {/* Mobile Sticky Bottom Navigation Bar — Exactly 3 items */}
        <nav
          className="customer-mobile-bottom-bar"
          aria-label="Mobile Bottom Navigation (Overview, Feedback, Loyalty)"
        >
          <NavLink
            to="/account"
            end
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/account/feedback"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="bottom-nav-icon-wrap">
              <MessageSquareText size={20} />
              {metrics.reviewsPending > 0 && (
                <span
                  className="bottom-nav-badge"
                  title={`${metrics.reviewsPending} reviews pending`}
                >
                  {metrics.reviewsPending}
                </span>
              )}
            </div>
            <span>Feedback</span>
          </NavLink>

          <NavLink
            to="/account/loyalty"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Coins size={20} />
            <span>Loyalty Points</span>
          </NavLink>
        </nav>
      </div>

      {/* ================= LOG OUT CONFIRMATION MODAL ================= */}
      {showLogoutModal && (
        <div
          className="logout-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !signingOut) setShowLogoutModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div className="logout-modal-card">
            <div className="logout-modal-icon-wrap">
              <AlertTriangle size={24} />
            </div>
            <h2 id="logout-dialog-title" className="logout-modal-title">
              Log out of Restrauque?
            </h2>
            <p className="logout-modal-desc">
              You are signed in as <strong>{profile.name}</strong> (+91 {profile.phone}). Are you sure you want to log out of your customer account?
            </p>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-btn-cancel"
                onClick={() => setShowLogoutModal(false)}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-btn-confirm"
                onClick={handleConfirmLogout}
                disabled={signingOut}
              >
                <LogOut size={15} />
                <span>{signingOut ? 'Logging out...' : 'Log Out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
