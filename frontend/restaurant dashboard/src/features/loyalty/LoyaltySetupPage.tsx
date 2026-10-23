import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  loyaltyService,
  EarningMode,
} from '../../services/loyaltyService';
import {
  DEFAULT_LOYALTY_PROGRAM,
  LoyaltyTier,
} from '../../services/loyaltyData';
import './LoyaltySetupPage.css';

export const LoyaltySetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { restaurant } = useRestaurant();

  // Loading & submission state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Persisted Form States (Supported by PUT /api/v1/owner/loyalty/rules)
  const [programName, setProgramName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [earningMode, setEarningMode] = useState<EarningMode>('visit_and_review');
  const [starsPerVisit, setStarsPerVisit] = useState<string>('5');
  const [starsPerReview, setStarsPerReview] = useState<string>('10');
  const [redemptionRate, setRedemptionRate] = useState<string>('1.00');

  // Preview-Only Form States (Preserved in client preview, clearly labelled)
  const [starsPerSpend] = useState<string>('1 point per ₹50');
  const [minOrderAmount, setMinOrderAmount] = useState<string>('200');
  const [expiryWindow, setExpiryWindow] = useState<string>('12 Months');
  const [tiers, setTiers] = useState<LoyaltyTier[]>(DEFAULT_LOYALTY_PROGRAM.tiers);

  const loadRules = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const res = await loyaltyService.getLoyaltyRules({
        restaurantId: restaurant?.id,
        signal,
      });

      const prog = res.loyaltyProgram;
      setProgramName(prog.name);
      setDescription(prog.description || '');
      setIsActive(prog.isActive);

      if (
        prog.earningMode === 'visit_and_review' ||
        prog.earningMode === 'visit_only' ||
        prog.earningMode === 'review_only'
      ) {
        setEarningMode(prog.earningMode);
      } else {
        setEarningMode('visit_and_review');
      }

      setStarsPerVisit(String(prog.starsPerVisit));
      setStarsPerReview(String(prog.starsPerReview));
      setRedemptionRate(Number(prog.redemptionRate).toFixed(2));
      setFetchError(null);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const message =
        err instanceof Error ? err.message : 'Unable to load existing loyalty rules from server';
      setFetchError(message);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [restaurant?.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadRules(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadRules]);

  const updateTier = (index: number, field: keyof LoyaltyTier, val: any) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: val };
    setTiers(updated);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = programName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.programName = 'Program name must be at least 2 characters long.';
    } else if (trimmedName.length > 150) {
      errors.programName = 'Program name cannot exceed 150 characters.';
    }

    if (description && description.trim().length > 500) {
      errors.description = 'Description cannot exceed 500 characters.';
    }

    const visitVal = parseInt(starsPerVisit, 10);
    if (isNaN(visitVal) || visitVal < 0 || visitVal > 500 || String(visitVal) !== starsPerVisit.trim()) {
      errors.starsPerVisit = 'Stars per visit must be an integer between 0 and 500.';
    }

    const reviewVal = parseInt(starsPerReview, 10);
    if (isNaN(reviewVal) || reviewVal < 0 || reviewVal > 500 || String(reviewVal) !== starsPerReview.trim()) {
      errors.starsPerReview = 'Stars per review must be an integer between 0 and 500.';
    }

    const rateVal = parseFloat(redemptionRate);
    if (isNaN(rateVal) || rateVal <= 0 || rateVal > 100) {
      errors.redemptionRate = 'Redemption rate must be a positive number up to 100 (e.g. 1.00 for ₹1/pt).';
    } else if (Number(rateVal.toFixed(2)) !== rateVal) {
      errors.redemptionRate = 'Redemption rate cannot have more than 2 decimal places.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (isSaving || isLoading) return;

    if (!validateForm()) {
      setSaveError('Please review and correct the errors below.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const res = await loyaltyService.updateLoyaltyRules(
        {
          name: programName.trim(),
          description: description.trim() || null,
          isActive,
          earningMode,
          starsPerVisit: parseInt(starsPerVisit, 10),
          starsPerReview: parseInt(starsPerReview, 10),
          redemptionRate: parseFloat(redemptionRate),
        },
        { restaurantId: restaurant?.id }
      );

      const updated = res.loyaltyProgram;
      setProgramName(updated.name);
      setDescription(updated.description || '');
      setIsActive(updated.isActive);
      setRedemptionRate(Number(updated.redemptionRate).toFixed(2));

      setToastMessage('Authoritative loyalty rules saved to database!');
      setTimeout(() => {
        navigate('/dashboard/loyalty');
      }, 700);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Server error occurred while saving loyalty rules.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="loyalty-setup-page">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#065F46',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            fontSize: '13.5px',
            fontWeight: 600,
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

      {/* Integration Notice Banner */}
      <div
        style={{
          padding: '12px 18px',
          borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#065f46',
          fontSize: '13px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span>🟢</span>
        <span>
          <strong>AUTHORITATIVE BACKEND INTEGRATION:</strong> Program Name, Description, Active Status, Earning Mode, Stars per Visit/Review, and Redemption Rate are persisted via <code>PUT /api/v1/owner/loyalty/rules</code>. Tier thresholds below remain client previews until reward tier endpoints are deployed.
        </span>
      </div>

      {/* Save Error Notice */}
      {saveError && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: '13px',
            marginBottom: '20px',
            fontWeight: 500,
          }}
        >
          ⚠️ {saveError}
        </div>
      )}

      {/* Fetch Error Notice */}
      {fetchError && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠️ {fetchError}</span>
          <button
            type="button"
            className="btn-setup-save"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => loadRules()}
          >
            Retry Loading
          </button>
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
          Loyalty / Program Setup & Configuration · Live Server Synchronization
        </p>
        <div className="setup-title-row">
          <h1>Configure Loyalty Program Rules</h1>
          <button
            className="btn-setup-save"
            id="btn-header-save-program"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            style={{ opacity: isSaving || isLoading ? 0.6 : 1 }}
          >
            {isSaving ? 'Saving to Database...' : 'Save Program Rules'}
          </button>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="setup-grid">
        {/* Left Column (Forms) */}
        <div className="setup-left-col">
          {/* Card 1: Program Identity (Live Persisted) */}
          <div className="setup-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 className="setup-card-title" style={{ margin: 0 }}>1. Program Identity</h2>
              <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                Live Persisted
              </span>
            </div>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="input-setup-prog-name">
                Program Name *
              </label>
              <input
                id="input-setup-prog-name"
                className="setup-input"
                type="text"
                placeholder="e.g. Basil & Brick VIP Club"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                disabled={isLoading || isSaving}
              />
              {fieldErrors.programName && (
                <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  {fieldErrors.programName}
                </span>
              )}
              <span className="setup-hint">
                Required (2-150 characters). Displayed to customers on digital menus and account passes.
              </span>
            </div>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="input-setup-desc">
                Program Description
              </label>
              <textarea
                id="input-setup-desc"
                className="setup-textarea"
                placeholder="e.g. Earn stars on completed visits and dining reviews to unlock rewards."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading || isSaving}
              />
              {fieldErrors.description && (
                <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  {fieldErrors.description}
                </span>
              )}
              <span className="setup-hint">
                Optional (max 500 characters). Explains the rewards program to enrolled diners.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
              <label className="coupon-switch" id="toggle-program-active">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isLoading || isSaving}
                />
                <span className="coupon-slider"></span>
              </label>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
                Program Status · {isActive ? 'Active & Rewarding Diners' : 'Inactive (Paused)'}
              </span>
            </div>
          </div>

          {/* Card 2: Earning Rules (Live Persisted) */}
          <div className="setup-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 className="setup-card-title" style={{ margin: 0 }}>2. Earning Rules</h2>
              <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                Live Persisted
              </span>
            </div>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="select-earning-mode">
                Primary Earning Mode
              </label>
              <select
                id="select-earning-mode"
                className="setup-select"
                value={earningMode}
                onChange={(e) => setEarningMode(e.target.value as EarningMode)}
                disabled={isLoading || isSaving}
              >
                <option value="visit_and_review">Hybrid: Visit + Review (visit_and_review)</option>
                <option value="visit_only">Visit Only (visit_only)</option>
                <option value="review_only">Review Only (review_only)</option>
              </select>
              <span className="setup-hint">
                Authoritative backend enum. Determines how customers accrue points on orders and reviews.
              </span>
            </div>

            <div className="setup-form-row">
              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-stars-visit">
                  Stars per Visit (Integer) *
                </label>
                <input
                  id="input-stars-visit"
                  className="setup-input"
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={starsPerVisit}
                  onChange={(e) => setStarsPerVisit(e.target.value)}
                  disabled={isLoading || isSaving}
                />
                {fieldErrors.starsPerVisit && (
                  <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    {fieldErrors.starsPerVisit}
                  </span>
                )}
                <span className="setup-hint">Points awarded per completed dine-in order (0–500).</span>
              </div>

              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-stars-review">
                  Stars per Review (Integer) *
                </label>
                <input
                  id="input-stars-review"
                  className="setup-input"
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={starsPerReview}
                  onChange={(e) => setStarsPerReview(e.target.value)}
                  disabled={isLoading || isSaving}
                />
                {fieldErrors.starsPerReview && (
                  <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    {fieldErrors.starsPerReview}
                  </span>
                )}
                <span className="setup-hint">Points awarded per verified review (0–500).</span>
              </div>
            </div>

            <div className="setup-form-row" style={{ marginTop: '12px', opacity: 0.75 }}>
              <div className="setup-form-group">
                <label className="setup-label">
                  Spend Earning Rate · Fixed Policy
                </label>
                <input
                  className="setup-input"
                  type="text"
                  value={starsPerSpend}
                  readOnly
                  style={{ backgroundColor: '#f9fafb', cursor: 'default' }}
                />
                <span className="setup-hint">Central backend business rule (1 point per ₹50 net spend).</span>
              </div>

              <div className="setup-form-group">
                <label className="setup-label" htmlFor="input-min-order">
                  Min Order Amount (Preview Only)
                </label>
                <input
                  id="input-min-order"
                  className="setup-input"
                  type="number"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  style={{ backgroundColor: '#f9fafb' }}
                />
                <span className="setup-hint">Demonstration threshold (not stored in loyalty_programs).</span>
              </div>
            </div>
          </div>

          {/* Card 3: Membership Tiers (Preview Only) */}
          <div className="setup-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 className="setup-card-title" style={{ margin: 0 }}>3. Membership Tiers</h2>
              <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '10px' }}>
                Preview Only · Tiers API Upcoming
              </span>
            </div>

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
          {/* Card 1: Redemption Rate (Live Persisted) */}
          <div className="setup-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 className="setup-card-title" style={{ margin: 0 }}>Redemption Conversion</h2>
              <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                Live Persisted
              </span>
            </div>

            <div className="setup-form-group">
              <label className="setup-label" htmlFor="input-redemption-rate">
                Rupees Per Star Value (₹/point) *
              </label>
              <input
                id="input-redemption-rate"
                className="setup-input"
                type="number"
                step="0.05"
                min="0.01"
                max="100.00"
                placeholder="1.00"
                value={redemptionRate}
                onChange={(e) => setRedemptionRate(e.target.value)}
                disabled={isLoading || isSaving}
              />
              {fieldErrors.redemptionRate && (
                <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  {fieldErrors.redemptionRate}
                </span>
              )}
              <span className="setup-hint">
                Stored as <code>Decimal(10,2)</code>. E.g. <code>1.00</code> = 1 Star funds ₹1.00 bill deduction. Max 50% order discount cap enforced at checkout.
              </span>
            </div>

            <div className="setup-form-group" style={{ opacity: 0.8, marginTop: '12px' }}>
              <label className="setup-label" htmlFor="select-expiry">
                Points Expiry Window (Preview Policy)
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
              <span className="setup-hint">Points ledger records timestamps per transaction.</span>
            </div>
          </div>

          {/* Card 2: Phone Card Live Preview */}
          <div className="setup-card">
            <h2 className="setup-card-title">Customer Pass Preview</h2>
            <div className="phone-preview-card">
              <div className="preview-chip">Restrauque Diner Pass</div>
              <div className="preview-club-name">{programName || 'VIP Club'}</div>
              <div className="preview-club-tagline">
                {description || 'Earn stars on every meal and unlock seasonal perks.'}
              </div>

              <div className="preview-balance-row">
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>
                    Sample Balance
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
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="setup-bottom-bar">
        <div className="setup-bottom-left">
          Connected to <code>PUT /api/v1/owner/loyalty/rules</code>. Changes persist to PostgreSQL on save.
        </div>
        <div className="setup-bottom-actions">
          <button
            className="btn-setup-cancel"
            id="btn-bottom-cancel-setup"
            onClick={() => navigate('/dashboard/loyalty')}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="btn-setup-save"
            id="btn-bottom-save-program"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            style={{ opacity: isSaving || isLoading ? 0.6 : 1 }}
          >
            {isSaving ? 'Saving to Database...' : 'Save Program Rules'}
          </button>
        </div>
      </div>
    </div>
  );
};
