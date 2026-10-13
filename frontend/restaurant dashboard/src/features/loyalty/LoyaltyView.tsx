import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLoyaltyProgram,
  LoyaltyProgramConfig,
} from '../../services/loyaltyData';
import './LoyaltyView.css';

interface LoyaltyViewProps {
  onConfigureReward?: () => void;
}

export const LoyaltyView: React.FC<LoyaltyViewProps> = () => {
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState('Hazratganj - DEMO');
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [program] = useState<LoyaltyProgramConfig>(() => getLoyaltyProgram());

  return (
    <div className="loyalty-view">
      {/* Top Banner showing Active Program with button to Edit / Start */}
      <div className="loyalty-hero-banner" id="loyalty-hero-banner">
        <div>
          <div className="loyalty-hero-title">
            <span>✦</span>
            <span>
              {program.isConfigured
                ? `Active Loyalty Program: ${program.programName}`
                : 'No Loyalty Program Initialized'}
            </span>
          </div>
          <div className="loyalty-hero-desc">
            {program.isConfigured
              ? `${program.tagline} · ${program.earningMode} · ${program.tiers.length} Tiers configured`
              : 'Configure earning rates, tiers and start rewarding your restaurant diners.'}
          </div>
        </div>

        <button
          className="btn-hero-configure"
          id="btn-open-loyalty-setup"
          onClick={() => navigate('/dashboard/loyalty/setup')}
        >
          {program.isConfigured ? '⚙ Edit Program Details' : '+ Start Loyalty Program'}
        </button>
      </div>

      {/* Branch selector right control */}
      <div className="loyalty-controls-row">
        <select
          className="loyalty-branch-select"
          id="select-loyalty-branch"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="Hazratganj - DEMO">Hazratganj - DEMO</option>
          <option value="Gomti Nagar - DEMO">Gomti Nagar - DEMO</option>
        </select>
      </div>

      {/* Top 2 Columns Grid */}
      <div className="loyalty-top-grid">
        {/* Left Column: Program configuration */}
        <div className="loyalty-card" id="card-program-configuration">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 className="loyalty-card-title" style={{ margin: 0 }}>Program configuration</h2>
            <button
              className="btn-edit-program-link"
              id="btn-edit-program-config"
              onClick={() => navigate('/dashboard/loyalty/setup')}
            >
              <span>Edit program</span>
              <span>↗</span>
            </button>
          </div>

          <div className="loyalty-form-group">
            <label className="loyalty-label" htmlFor="input-program-name">
              Program name · Read only
            </label>
            <input
              id="input-program-name"
              className="loyalty-input-readonly"
              type="text"
              value={program.isConfigured ? program.programName : 'Not available'}
              readOnly
            />
          </div>

          <div className="loyalty-form-row">
            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-earning-mode">
                Earning mode · Read only
              </label>
              <input
                id="input-earning-mode"
                className="loyalty-input-readonly"
                type="text"
                value={program.isConfigured ? program.earningMode : 'Not available'}
                readOnly
              />
              <span className="loyalty-hint">
                {program.isConfigured
                  ? `${program.starsPerSpend} stars per ₹100 spent (Min order ₹${program.minOrderAmount})`
                  : 'Confirm with backend · enum options supplied.'}
              </span>
            </div>

            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-active-status">
                Active · is_active · Read only
              </label>
              <input
                id="input-active-status"
                className="loyalty-input-readonly"
                type="text"
                value={program.isConfigured ? (program.isActive ? 'Active · On' : 'Inactive') : 'Not available'}
                readOnly
              />
              <span className="loyalty-hint">
                {program.isConfigured ? 'Live and rewarding enrolled customers' : 'No stored value supplied.'}
              </span>
            </div>
          </div>

          <div className="loyalty-form-row">
            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-stars-visit">
                Stars per visit · Read only
              </label>
              <input
                id="input-stars-visit"
                className="loyalty-input-readonly"
                type="text"
                value={program.isConfigured ? `${program.starsPerVisit} stars` : 'Not available'}
                readOnly
              />
            </div>

            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-stars-review">
                Stars per review · Read only
              </label>
              <input
                id="input-stars-review"
                className="loyalty-input-readonly"
                type="text"
                value={program.isConfigured ? `${program.starsPerReview} stars` : 'Not available'}
                readOnly
              />
            </div>
          </div>

          <button
            className="btn-configure-reward"
            id="btn-setup-program-btn"
            style={{ width: 'fit-content' }}
            onClick={() => navigate('/dashboard/loyalty/setup')}
          >
            Configure program rules
          </button>

          <div className="loyalty-schema-notice">
            {program.isConfigured
              ? `Redemption: ${program.redemptionRate} · Points expiry: ${program.expiryWindow}.`
              : 'Schema preview only. Earning rules and API contracts must be confirmed; stars are not converted to money.'}
          </div>
        </div>

        {/* Right Column Stack */}
        <div className="loyalty-right-stack">
          {/* Card 1: Account detail preview */}
          <div className="loyalty-card" id="card-account-preview">
            <h2 className="loyalty-card-title">Account detail preview</h2>
            <div className="account-preview-list">
              <div className="account-preview-item">
                <span className="account-preview-label">Stars balance</span>
                <span className="account-preview-val">
                  {program.isConfigured ? '420 Stars' : 'Not available'}
                </span>
              </div>

              <div className="account-preview-item">
                <span className="account-preview-label">Lifetime stars earned</span>
                <span className="account-preview-val">
                  {program.isConfigured ? '620 Stars' : 'Not available'}
                </span>
              </div>

              <div className="account-preview-item">
                <span className="account-preview-label">Lifetime stars redeemed</span>
                <span className="account-preview-val">
                  {program.isConfigured ? '200 Stars' : 'Not available'}
                </span>
              </div>

              <div className="account-preview-item">
                <span className="account-preview-label">Tier</span>
                <span className="account-preview-val">
                  {program.isConfigured ? 'Gold VIP (1.5x)' : 'Not available'}
                </span>
              </div>

              <div className="account-preview-item">
                <span className="account-preview-label">Status</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {program.isConfigured ? (
                    <span className="status-pill active">Active</span>
                  ) : (
                    <span className="badge-not-available">Not available</span>
                  )}
                  <span className="status-hint">
                    {program.isConfigured ? 'Confirmed via program rules' : 'Confirm with backend'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Rewards */}
          <div className="loyalty-card" id="card-rewards">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 className="loyalty-card-title" style={{ margin: 0 }}>Rewards</h2>
              <button
                className="btn-edit-program-link"
                id="btn-manage-tiers"
                onClick={() => setShowRewardModal(true)}
              >
                <span>Tiers modal</span>
              </button>
            </div>

            {program.isConfigured ? (
              <div className="rewards-active-list">
                {program.tiers.map((tier) => (
                  <div key={tier.id} className="reward-card-row">
                    <div className="reward-card-info">
                      <h4>{tier.name}</h4>
                      <p>{tier.perks}</p>
                    </div>
                    <div className="reward-card-stars">
                      {tier.minStars > 0 ? `${tier.minStars}+ Stars` : 'Entry Level'}
                    </div>
                  </div>
                ))}
                <button
                  className="btn-configure-reward"
                  style={{ marginTop: '8px' }}
                  onClick={() => navigate('/dashboard/loyalty/setup')}
                >
                  Configure reward tiers
                </button>
              </div>
            ) : (
              <div className="rewards-empty-box">
                <div className="rewards-empty-title">No rewards yet</div>
                <p className="rewards-empty-desc">
                  Reward thresholds, types, discounts and counts appear only after the backend confirms fields and supplies records.
                </p>
                <button
                  className="btn-configure-reward"
                  id="btn-configure-reward"
                  onClick={() => setShowRewardModal(true)}
                >
                  Configure reward
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Card: Accounts */}
      <div className="loyalty-accounts-card" id="card-accounts-table">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 className="loyalty-card-title" style={{ margin: 0 }}>
            Enrolled Customer Accounts ({program.sampleAccounts.length})
          </h2>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Live records updated via table QR check-ins
          </span>
        </div>

        <div className="accounts-table-header">
          <span className="accounts-header-col">CUSTOMER · PHONE</span>
          <span className="accounts-header-col">STARS BALANCE</span>
          <span className="accounts-header-col">LIFETIME EARNED</span>
          <span className="accounts-header-col">TIER</span>
          <span className="accounts-header-col">STATUS</span>
        </div>

        {program.sampleAccounts.length > 0 ? (
          <div>
            {program.sampleAccounts.map((acc) => (
              <div key={acc.id} className="accounts-data-row" id={`account-row-${acc.id}`}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{acc.customerName}</div>
                  <div style={{ fontSize: '11.5px', color: '#6B7280' }}>{acc.phone}</div>
                </div>

                <div style={{ fontWeight: 700, color: '#D97706' }}>
                  {acc.starsBalance} ★
                </div>

                <div style={{ color: '#4B5563' }}>
                  {acc.lifetimeEarned} earned · {acc.lifetimeRedeemed} spent
                </div>

                <div>
                  <span
                    className={`tier-badge-pill ${
                      acc.tier.includes('Gold')
                        ? 'gold'
                        : acc.tier.includes('Silver')
                        ? 'silver'
                        : 'bronze'
                    }`}
                  >
                    {acc.tier}
                  </span>
                </div>

                <div>
                  <span className="status-pill active">{acc.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="accounts-empty-state">
            <div className="accounts-empty-title">No accounts yet</div>
            <div className="accounts-empty-desc">
              Only backend-returned account rows will be shown. No customer balances are invented.
            </div>
          </div>
        )}
      </div>

      {/* Interactive Configure Reward Modal */}
      {showRewardModal && (
        <div className="reward-modal-backdrop" onClick={() => setShowRewardModal(false)}>
          <div className="reward-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="reward-modal-header">
              <h3>Configured Reward Tiers</h3>
              <button
                className="reward-modal-close-btn"
                onClick={() => setShowRewardModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="reward-modal-body">
              <p>
                {program.programName} customer rewards are structured into progressive tiers:
              </p>

              <div className="reward-tier-preview-list">
                {program.tiers.map((t) => (
                  <div key={t.id} className="reward-tier-item">
                    <div>
                      <div className="tier-name">{t.name} ({t.multiplier})</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{t.perks}</div>
                    </div>
                    <div className="tier-points">
                      {t.minStars > 0 ? `${t.minStars} Stars` : 'Entry'}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>
                Note: Redemptions deduct stars automatically at billing ({program.redemptionRate}).
              </div>
            </div>
            <div className="reward-modal-footer">
              <button
                className="btn-configure-reward"
                style={{ backgroundColor: '#E53935', color: '#ffffff', border: 'none' }}
                onClick={() => {
                  setShowRewardModal(false);
                  navigate('/dashboard/loyalty/setup');
                }}
              >
                Edit Tier Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
