import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CouponsView } from './CouponsView';
import { LoyaltyView } from '../loyalty/LoyaltyView';
import './CouponsPage.css';

export const CouponsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from URL: either 'coupons' or 'loyalty'
  const isLoyaltyRoute = location.pathname.includes('/loyalty');
  const [activeTab, setActiveTab] = useState<'coupons' | 'loyalty'>(
    isLoyaltyRoute ? 'loyalty' : 'coupons'
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(location.pathname.includes('/loyalty') ? 'loyalty' : 'coupons');
  }, [location.pathname]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTabSelect = (tab: 'coupons' | 'loyalty') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'coupons') {
      navigate('/dashboard/coupons');
    } else {
      navigate('/dashboard/loyalty');
    }
  };

  return (
    <div className="coupons-page">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#1F2937',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '13.5px',
            fontWeight: 500,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with smooth cross-fading title and actions */}
      <div className="coupons-header">
        <div className="coupons-title-group" key={activeTab}>
          <h1 className="title-fade-enter">
            {activeTab === 'coupons' ? 'Coupons' : 'Loyalty'}
          </h1>
          <p className="coupons-subtitle title-fade-enter">
            {activeTab === 'coupons'
              ? 'Coupon definitions and global usage · Active is separate from validity.'
              : 'Loyalty / Program & Accounts / Future Ready · No program, account or reward records supplied.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'coupons' ? (
            <button
              className="btn-create-coupon title-fade-enter"
              id="btn-create-coupon-top"
              onClick={() => navigate('/dashboard/coupons/create')}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
              <span>Create coupon</span>
            </button>
          ) : (
            <span className="badge-future-ready title-fade-enter" id="badge-future-ready">
              FUTURE READY
            </span>
          )}
        </div>
      </div>

      {/* Navigation tabs with gliding background pill */}
      <div className="coupons-nav-bar">
        <div className="sliding-tabs-nav">
          <div
            className="sliding-tab-pill-bg"
            style={{
              transform: activeTab === 'coupons' ? 'translateX(0px)' : 'translateX(130px)',
              width: activeTab === 'coupons' ? '126px' : '182px',
            }}
          />
          <button
            className={`sliding-tab-btn ${activeTab === 'coupons' ? 'active' : ''}`}
            id="tab-coupons-active"
            onClick={() => handleTabSelect('coupons')}
            type="button"
          >
            <span>🏷 Coupons</span>
            <span className="tab-badge">5</span>
          </button>
          <button
            className={`sliding-tab-btn ${activeTab === 'loyalty' ? 'active' : ''}`}
            id="tab-loyalty-rewards"
            onClick={() => handleTabSelect('loyalty')}
            type="button"
          >
            <span>☆ Loyalty & Rewards</span>
            <span className="tab-badge amber">3 Tiers</span>
          </button>
        </div>
      </div>

      {/* Smooth Horizontal Slide Viewport Container */}
      <div className="smooth-shift-viewport">
        <div
          className={`smooth-shift-track ${activeTab === 'loyalty' ? 'loyalty-active' : ''}`}
        >
          {/* Coupons Panel */}
          <div
            className={`smooth-shift-panel ${activeTab !== 'coupons' ? 'panel-inactive' : ''}`}
            id="panel-coupons-view"
          >
            <CouponsView onNotify={showToast} />
          </div>

          {/* Loyalty Panel */}
          <div
            className={`smooth-shift-panel ${activeTab !== 'loyalty' ? 'panel-inactive' : ''}`}
            id="panel-loyalty-view"
          >
            <LoyaltyView />
          </div>
        </div>
      </div>
    </div>
  );
};
