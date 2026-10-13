import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  FileText,
  Menu as MenuIcon,
  Grid,
  Tag,
  MessageSquare,
  TrendingUp,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { useEntitlements } from '../../context/EntitlementContext';
import './Sidebar.css';

interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number | string;
  hasSparkle?: boolean;
}

export const Sidebar: React.FC = () => {
  const { restaurant } = useRestaurant();
  const { hasAccess } = useEntitlements();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItemConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      path: '/dashboard/overview',
      icon: <Home size={18} strokeWidth={1.8} />,
    },
    {
      id: 'orders',
      label: 'Orders',
      path: '/dashboard/orders',
      icon: <FileText size={18} strokeWidth={1.8} />,
      badge: 7,
    },
    {
      id: 'menu_products',
      label: 'Menu & Products',
      path: '/dashboard/menu',
      icon: <MenuIcon size={18} strokeWidth={1.8} />,
    },
    {
      id: 'tables_qr',
      label: 'Tables & QR',
      path: '/dashboard/tables',
      icon: <Grid size={18} strokeWidth={1.8} />,
    },
    {
      id: 'coupons',
      label: 'Coupons & Loyalty',
      path: '/dashboard/coupons',
      icon: <Tag size={18} strokeWidth={1.8} />,
    },
    {
      id: 'feedback',
      label: 'Feedback',
      path: '/dashboard/feedback',
      icon: <MessageSquare size={18} strokeWidth={1.8} />,
    },
    {
      id: 'analytics',
      label: 'Analytics & Reports',
      path: '/dashboard/analytics',
      icon: <TrendingUp size={18} strokeWidth={1.8} />,
    },
    {
      id: 'ai_insights',
      label: 'AI Insights',
      path: '/dashboard/ai-insights',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/dashboard/settings',
      icon: <SettingsIcon size={18} strokeWidth={1.8} />,
    },
  ];

  return (
    <aside className="sidebar-container">
      {/* Brand Logo Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-mark">R</div>
        <div className="brand-titles">
          <span className="brand-name">restrauque</span>
          <span className="brand-subtext">RESTAURANT OS</span>
        </div>
      </div>

      {/* Workspace Context Card */}
      <div className="sidebar-workspace-card">
        <div className="workspace-avatar">BB</div>
        <div className="workspace-info">
          <div className="workspace-name">{restaurant.name}</div>
          <div className="workspace-branch">Lucknow · Hazratganj</div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="sidebar-nav-section">
        <div className="nav-section-title">MANAGE</div>
        <nav className="sidebar-nav-list">
          {navItems.map((item) => {
            const isEnabled = hasAccess(item.id as any);
            const isCouponsOrLoyaltyActive =
              item.id === 'coupons' &&
              (location.pathname.startsWith('/dashboard/coupons') ||
                location.pathname.startsWith('/dashboard/loyalty'));

            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => {
                  const active = isCouponsOrLoyaltyActive || isActive;
                  return `sidebar-nav-item ${active ? 'active' : ''} ${!isEnabled ? 'item-disabled' : ''}`;
                }}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>

                {item.badge !== undefined && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}

                {item.hasSparkle && (
                  <span className="nav-item-sparkle">✦</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Feature Preview Card */}
      <div className="sidebar-feature-card">
        <div className="feature-card-header">
          <span className="feature-card-title">FEATURE PREVIEW</span>
          <span className="feature-card-tag">PREVIEW</span>
        </div>
        <div className="feature-card-heading">Feature access</div>
        <p className="feature-card-desc">
          Concept only · backend entitlements pending.
        </p>
        <button
          type="button"
          className="feature-card-btn"
          onClick={() => navigate('/dashboard/settings?tab=subscription')}
        >
          Manage access
        </button>
      </div>

      {/* User Account Footer */}
      <div className="sidebar-user-footer">
        <div className="user-avatar-circle">AK</div>
        <div className="user-details">
          <div className="user-name">{restaurant.ownerName}</div>
          <div className="user-role">Restaurant owner</div>
        </div>
      </div>
    </aside>
  );
};
