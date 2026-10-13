import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLoyaltyProgram,
  saveLoyaltyProgram,
  LoyaltyTier,
} from '../../services/loyaltyData';
import './LoyaltySetupPage.css';

export const LoyaltySetupPage: React.FC = () => {
  const navigate = useNavigate();
  const currentConfig = getLoyaltyProgram();

  // Form states
  const [programName, setProgramName] = useState(currentConfig.programName);
  const [tagline, setTagline] = useState(currentConfig.tagline);
  const [isActive, setIsActive] = useState(currentConfig.isActive);
  const [earningMode, setEarningMode] = useState(currentConfig.earningMode);
  const [starsPerSpend, setStarsPerSpend] = useState(currentConfig.starsPerSpend.toString());
  const [starsPerVisit, setStarsPerVisit] = useState(currentConfig.starsPerVisit.toString());
  const [starsPerReview, setStarsPerReview] = useState(currentConfig.starsPerReview.toString());
  const [minOrderAmount, setMinOrderAmount] = useState(currentConfig.minOrderAmount.toString());
  const [redemptionRate, setRedemptionRate] = useState(currentConfig.redemptionRate);
  const [expiryWindow, setExpiryWindow] = useState(currentConfig.expiryWindow);

  // Tiers state
  const [tiers, setTiers] = useState<LoyaltyTier[]>(currentConfig.tiers);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const updateTier = (index: number, field: keyof LoyaltyTier, val: any) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: val };
    setTiers(updated);
  };

  const handleSave = () => {
    const saved = saveLoyaltyProgram({
      programName: programName.trim() || 'Basil & Brick VIP Club',
      tagline: tagline.trim(),
      isActive,
      earningMode,
      starsPerSpend: parseInt(starsPerSpend, 10) || 5,
      starsPerVisit: parseInt(starsPerVisit, 10) || 10,
      starsPerReview: parseInt(starsPerReview, 10) || 25,
      minOrderAmount: parseInt(minOrderAmount, 10) || 200,
      redemptionRate: redemptionRate.trim(),
      expiryWindow,
      tiers,
    });

    setToastMessage(`Loyalty program "${saved.programName}" saved and activated!`);
    setTimeout(() => {
      navigate('/dashboard/loyalty');
    }, 600);
  };

  return (
    <div className="loyalty-setup-page">
      {/* Toast */}
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
          }}
        >
          ✓ {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="setup-header-section">
        <button
          className="btn-back-loyalty"
          id="btn-back-loyalty"
          onClick={() => navigate('/dashboard/loyalty')}
        >
          ← Back to loyalty
        </button>
        <p className="setup-breadcrumb">
          Loyalty / Program Setup & Configuration · Configure earning rates, tiers and member perks
        </p>
        <div className="setup-title-row">
          <h1>Start / Configure Loyalty Program</h1>
          <button
            className="btn-setup-save"
            id="btn-header-save-program"
            onClick={handleSave}
          >
            Save & Activate Program
          </button>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="setup-grid">
        {/* Left Column (Forms) */}
        <div className="setup-left-col">
          {/* Card 1: Program Identity */}
          <div className="setup-card">
            <h2 className="setup-card-title">1. Program Identity</h2>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="input-setup-prog-name">
                Program Name
              </label>
              <input
                id="input-setup-prog-name"
                className="setup-input"
                type="text"
                placeholder="e.g. Basil & Brick VIP Club"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
              />
              <span className="setup-hint">
                Displayed to customers on QR menus and loyalty digital passes.
              </span>
            </div>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="input-setup-tagline">
                Customer Tagline / Description
              </label>
              <textarea
                id="input-setup-tagline"
                className="setup-textarea"
                placeholder="e.g. Earn stars on every meal and unlock seasonal culinary perks."
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
              <label className="coupon-switch" id="toggle-program-active">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="coupon-slider"></span>
              </label>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
                Program Status · {isActive ? 'Active & Live' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Card 2: Earning Rules */}
          <div className="setup-card">
            <h2 className="setup-card-title">2. Earning Rules & Multipliers</h2>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="select-earning-mode">
                Primary Earning Mode
              </label>
              <select
                id="select-earning-mode"
                className="setup-select"
                value={earningMode}
                onChange={(e) => setEarningMode(e.target.value)}
              >
                <option value="Hybrid (Spend + Visit)">Hybrid (Spend + Visit bonuses)</option>
                <option value="Spend-based (Stars per ₹ spent)">Spend-based (Stars per ₹ spent)</option>
                <option value="Visit-based (Stars per dine-in)">Visit-based (Stars per dine-in)</option>
              </select>
            </div>

            <div className="setup-form-row">
              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-stars-spend">
                  Stars per ₹100 Spent
                </label>
                <input
                  id="input-stars-spend"
                  className="setup-input"
                  type="number"
                  value={starsPerSpend}
                  onChange={(e) => setStarsPerSpend(e.target.value)}
                />
              </div>

              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-min-order">
                  Min Order Amount (₹)
                </label>
                <input
                  id="input-min-order"
                  className="setup-input"
                  type="number"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="setup-form-row">
              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-stars-visit">
                  Bonus Stars per Visit
                </label>
                <input
                  id="input-stars-visit"
                  className="setup-input"
                  type="number"
                  value={starsPerVisit}
                  onChange={(e) => setStarsPerVisit(e.target.value)}
                />
              </div>

              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-stars-review">
                  Bonus Stars for Review
                </label>
                <input
                  id="input-stars-review"
                  className="setup-input"
                  type="number"
                  value={starsPerReview}
                  onChange={(e) => setStarsPerReview(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Reward Tiers */}
          <div className="setup-card">
            <h2 className="setup-card-title">3. Membership Tiers & Benefits</h2>

            {tiers.map((tier, idx) => (
              <div key={tier.id} className="setup-tier-card">
                <div className="setup-tier-header">
                  <span className="setup-tier-badge">
                    {idx === 0 ? '🥉 Tier 1: Bronze' : idx === 1 ? '🥈 Tier 2: Silver' : '🥇 Tier 3: Gold VIP'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#E53935', fontWeight: 600 }}>
                    {tier.multiplier} Earning Multiplier
                  </span>
                </div>

                <div className="setup-form-row">
                  <div className="setup-form-group">
                    <label className="setup-label">Tier Name</label>
                    <input
                      className="setup-input"
                      type="text"
                      value={tier.name}
                      onChange={(e) => updateTier(idx, 'name', e.target.value)}
                    />
                  </div>

                  <div className="setup-form-group">
                    <label className="setup-label">Threshold (Min Stars)</label>
                    <input
                      className="setup-input"
                      type="number"
                      value={tier.minStars}
                      onChange={(e) => updateTier(idx, 'minStars', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                </div>

                <div className="setup-form-group">
                  <label className="setup-label">Exclusive Perks & Privileges</label>
                  <input
                    className="setup-input"
                    type="text"
                    value={tier.perks}
                    onChange={(e) => updateTier(idx, 'perks', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (Live Previews & Policies) */}
        <div className="setup-right-col">
          {/* Card 1: Phone Card Live Preview */}
          <div className="setup-card">
            <h2 className="setup-card-title">Customer Pass Preview</h2>
            <div className="phone-preview-card">
              <div className="preview-chip">Restrauque Diner Pass</div>
              <div className="preview-club-name">{programName || 'VIP Club'}</div>
              <div className="preview-club-tagline">
                {tagline || 'Earn stars on every meal and unlock seasonal perks.'}
              </div>

              <div className="preview-balance-row">
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Member Stars
                  </div>
                  <div className="preview-stars-count">340 ★</div>
                </div>
                <div className="preview-tier-tag">Silver Tier</div>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '12px', lineHeight: 1.45 }}>
              Customers see this card instantly in their mobile browser after scanning the table QR code.
            </p>
          </div>

          {/* Card 2: Redemption & Expiry Policies */}
          <div className="setup-card">
            <h2 className="setup-card-title">Redemption & Expiry</h2>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="input-redemption-rate">
                Star Redemption Formula
              </label>
              <input
                id="input-redemption-rate"
                className="setup-input"
                type="text"
                value={redemptionRate}
                onChange={(e) => setRedemptionRate(e.target.value)}
              />
              <span className="setup-hint">e.g. 100 stars = ₹50 bill deduction</span>
            </div>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="select-expiry">
                Points Expiry Window
              </label>
              <select
                id="select-expiry"
                className="setup-select"
                value={expiryWindow}
                onChange={(e) => setExpiryWindow(e.target.value)}
              >
                <option value="12 Months">12 Months from earning date</option>
                <option value="6 Months">6 Months from earning date</option>
                <option value="24 Months">24 Months</option>
                <option value="Never expires">Never expires</option>
              </select>
            </div>
          </div>

          {/* Card 3: Notice */}
          <div className="setup-card" style={{ backgroundColor: '#F9FAFB' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px 0', color: '#111827' }}>
              ✦ Live Synchronization
            </h3>
            <p style={{ fontSize: '12.5px', color: '#4B5563', lineHeight: 1.5, margin: 0 }}>
              Saving this program will immediately populate the Loyalty Dashboard with configured rules, active reward cards, and sample customer accounts.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="setup-bottom-bar">
        <div className="setup-bottom-left">
          Changes will take effect immediately across all digital menus for Hazratganj branch.
        </div>
        <div className="setup-bottom-actions">
          <button
            className="btn-setup-cancel"
            id="btn-bottom-cancel-setup"
            onClick={() => navigate('/dashboard/loyalty')}
          >
            Cancel
          </button>
          <button
            className="btn-setup-save"
            id="btn-bottom-save-program"
            onClick={handleSave}
          >
            Save & Activate Program
          </button>
        </div>
      </div>
    </div>
  );
};
