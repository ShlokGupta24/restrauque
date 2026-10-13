import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './DashboardLayout.css';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnInsights = location.pathname.startsWith('/dashboard/ai-insights');

  return (
    <div className="dashboard-shell">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="dashboard-main">
        <Topbar />
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Preview Button (observed in all PNG references) */}
      <button
        type="button"
        className={`floating-ai-cta ${isOnInsights ? 'is-on-insights' : ''}`}
        onClick={() => navigate('/dashboard/ai-insights')}
      >
        <span className="floating-ai-icon">✦</span>
        <span>AI preview · not connected</span>
      </button>
    </div>
  );
};
