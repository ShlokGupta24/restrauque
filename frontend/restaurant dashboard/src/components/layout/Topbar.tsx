import React from 'react';
import { Search, Printer, LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

interface TopbarProps {
  title?: string;
  breadcrumbs?: string[];
}

export const Topbar: React.FC<TopbarProps> = ({ title, breadcrumbs }) => {
  const { restaurant } = useRestaurant();
  const { user, logout } = useAuth();
  const location = useLocation();

  // Generate dynamic breadcrumb fallback if not provided
  const getBreadcrumbs = (): string[] => {
    if (breadcrumbs && breadcrumbs.length > 0) return breadcrumbs;
    const path = location.pathname;
    const restName = (restaurant?.name || 'RESTRAUQUE').toUpperCase();
    if (path.includes('overview')) return [restName, 'OWNER', 'OVERVIEW'];
    if (path.includes('orders')) return [restName, 'DASHBOARD'];
    if (path.includes('menu')) return [restName, 'DASHBOARD'];
    if (path.includes('tables')) return [restName, 'DASHBOARD'];
    if (path.includes('coupons')) return [restName, 'DASHBOARD'];
    if (path.includes('loyalty')) return [restName, 'OWNER', 'LOYALTY'];
    if (path.includes('analytics')) return [restName, 'DASHBOARD'];
    if (path.includes('ai-insights')) return [restName, 'DASHBOARD'];
    if (path.includes('feedback')) return [restName, 'OWNER', 'FEEDBACK'];
    if (path.includes('settings')) return [restName, 'SETTINGS'];
    return [restName, 'DASHBOARD'];
  };

  const getPageTitle = (): string => {
    if (title) return title;
    const path = location.pathname;
    if (path.includes('overview')) return 'Overview';
    if (path.includes('orders')) return 'Orders';
    if (path.includes('menu')) return 'Menu & Products';
    if (path.includes('tables')) return 'Tables & QR';
    if (path.includes('coupons')) return 'Coupons';
    if (path.includes('loyalty')) return 'Loyalty';
    if (path.includes('analytics')) return 'Analytics & Reports';
    if (path.includes('ai-insights')) return 'AI Insights';
    if (path.includes('feedback')) return 'Feedback';
    if (path.includes('settings')) return 'Restaurant & Branch';
    return 'Dashboard';
  };

  const currentBreadcrumbs = getBreadcrumbs();
  const currentTitle = getPageTitle();

  const displayName = user?.name || restaurant?.ownerName || 'Restaurant Owner';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="topbar-container">
      {/* Left: Breadcrumbs + Main Title */}
      <div className="topbar-left">
        <div className="topbar-breadcrumbs">
          {currentBreadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb}>
              <span className="breadcrumb-item">{crumb}</span>
              {idx < currentBreadcrumbs.length - 1 && <span className="breadcrumb-separator">/</span>}
            </React.Fragment>
          ))}
        </div>
        <h1 className="topbar-page-title">{currentTitle}</h1>
      </div>

      {/* Right: Controls & Profile */}
      <div className="topbar-right">
        {location.pathname.includes('feedback') ? (
          <div className="topbar-demo-pill future-ready">
            <span className="future-ready-dot">●</span> FUTURE READY
          </div>
        ) : (
          <div className="topbar-demo-pill">VERIFIED SESSION</div>
        )}

        <button type="button" className="topbar-icon-btn" aria-label="Search">
          <Search size={16} strokeWidth={2} />
        </button>

        <button type="button" className="topbar-icon-btn" aria-label="Print or Action">
          <Printer size={16} strokeWidth={2} />
          <span className="topbar-notification-dot" />
        </button>

        <div className="topbar-user-profile" title={user?.email || ''}>
          <div className="topbar-avatar">{initials}</div>
          <div className="topbar-user-meta">
            <span className="topbar-username">{displayName}</span>
            <span className="topbar-userrole">{user?.email || 'Owner account'}</span>
          </div>
        </div>

        <button
          type="button"
          className="topbar-icon-btn"
          aria-label="Sign out"
          title="Sign out of owner account"
          onClick={() => logout()}
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
};
