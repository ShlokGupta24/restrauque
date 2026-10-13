import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getCouponById,
  updateCouponInStore,
  createCouponInStore,
} from '../../services/couponData';
import './EditCouponPage.css';

export const EditCouponPage: React.FC = () => {
  const { couponId } = useParams<{ couponId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isCreateRoute = location.pathname.includes('/create');
  const [isCreateMode, setIsCreateMode] = useState<boolean>(isCreateRoute);

  // Form state
  const [code, setCode] = useState('WELCOME10');
  const [name, setName] = useState('Welcome offer - DEMO');
  const [description, setDescription] = useState('Welcome offer description - DEMO');
  const [discountType, setDiscountType] = useState('Not available');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [minOrderAmount, setMinOrderAmount] = useState('Not available');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('Not available');
  const [validFrom, setValidFrom] = useState('01 Oct 2026 - 12:00 AM');
  const [validUntil, setValidUntil] = useState('31 Oct 2026 - 11:59 PM');
  const [isActive, setIsActive] = useState(true);
  const [usageLimit, setUsageLimit] = useState('300');
  const [usageCount, setUsageCount] = useState('128 - DEMO');
  const [activeCouponId, setActiveCouponId] = useState<string>('c-welcome10');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateRoute) {
      setIsCreateMode(true);
      setCode('');
      setName('');
      setDescription('');
      setDiscountType('Not available');
      setDiscountValue('10');
      setMinOrderAmount('Not available');
      setMaxDiscountAmount('Not available');
      setValidFrom('01 Oct 2026 - 12:00 AM');
      setValidUntil('31 Oct 2026 - 11:59 PM');
      setIsActive(true);
      setUsageLimit('100');
      setUsageCount('Omitted until record returned');
    } else {
      const targetId = couponId || 'c-welcome10';
      const existing = getCouponById(targetId) || getCouponById('WELCOME10');
      if (existing) {
        setActiveCouponId(existing.id);
        setCode(existing.code);
        setName(existing.name.endsWith('- DEMO') ? existing.name : `${existing.name} - DEMO`);
        const descText = existing.description || existing.name;
        setDescription(descText.endsWith('- DEMO') ? descText : `${descText} - DEMO`);
        setDiscountType('Not available');
        setDiscountValue(existing.discountValue.toString());
        setMinOrderAmount('Not available');
        setMaxDiscountAmount('Not available');
        setValidFrom(existing.validFrom);
        setValidUntil(existing.validUntil);
        setIsActive(existing.isActive);
        setUsageLimit(existing.usageLimit.toString());
        setUsageCount(existing.usageCount.toString().includes('DEMO') ? `${existing.usageCount}` : `${existing.usageCount} - DEMO`);
        setIsCreateMode(false);
      }
    }
  }, [couponId, isCreateRoute]);

  const handleToggleMode = () => {
    if (!isCreateMode) {
      setIsCreateMode(true);
      setCode('');
      setName('');
      setDescription('');
      setUsageCount('Omitted until record returned');
    } else {
      setIsCreateMode(false);
      const existing = getCouponById(activeCouponId) || getCouponById('WELCOME10');
      if (existing) {
        setCode(existing.code);
        setName(existing.name.endsWith('- DEMO') ? existing.name : `${existing.name} - DEMO`);
        const descText = existing.description || existing.name;
        setDescription(descText.endsWith('- DEMO') ? descText : `${descText} - DEMO`);
        setUsageCount(existing.usageCount.toString().includes('DEMO') ? `${existing.usageCount}` : `${existing.usageCount} - DEMO`);
        setIsActive(existing.isActive);
        setUsageLimit(existing.usageLimit.toString());
      }
    }
  };

  const handleSave = () => {
    if (isCreateMode) {
      const finalCode = (code.trim() || 'COUPON' + Math.floor(100 + Math.random() * 900)).toUpperCase();
      const finalName = name.trim() || 'Special Promo Offer';
      const limitVal = parseInt(usageLimit, 10) || 100;
      const discVal = parseFloat(discountValue) || 10;
      
      const created = createCouponInStore({
        code: finalCode,
        name: finalName,
        description: description.trim() || `${finalName} promotion`,
        discountType: 'percentage',
        discountValue: discVal,
        discountLabel: `${discVal}% off`,
        usageLimit: limitVal,
        validFrom,
        validUntil,
        validityRangeLabel: '01 Oct 2026 - 31 Oct 2026',
        isActive,
      });

      setToastMessage(`Coupon ${created.code} created successfully`);
    } else {
      const discVal = parseFloat(discountValue) || 10;
      const limitVal = parseInt(usageLimit, 10) || 300;
      
      updateCouponInStore({
        id: activeCouponId,
        code: code.trim(),
        name: name.replace(/ - DEMO$/, '').trim(),
        description: description.replace(/ - DEMO$/, '').trim(),
        discountValue: discVal,
        discountLabel: `${discVal}% off`,
        usageLimit: limitVal,
        validFrom,
        validUntil,
        isActive,
      });

      setToastMessage(`Coupon ${code} updated successfully`);
    }

    setTimeout(() => {
      navigate('/dashboard/coupons');
    }, 700);
  };

  return (
    <div className="edit-coupon-page">
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

      {/* Header Section */}
      <div className="edit-coupon-header-section">
        <div>
          <p className="edit-coupon-breadcrumb">
            Coupons / Create & Edit / Demo · Schema-aligned shared form · No live eligibility check.
          </p>
          <h1 className="edit-coupon-title" id="page-title">
            {isCreateMode
              ? 'Create coupon - DEMO'
              : `Edit coupon - ${code || 'WELCOME10'} - DEMO`}
          </h1>
        </div>
        <button
          className="btn-toggle-mode"
          id="btn-toggle-coupon-mode"
          onClick={handleToggleMode}
        >
          {isCreateMode ? 'Edit mode' : 'Create mode'}
        </button>
      </div>

      {/* Two Column Grid */}
      <div className="edit-coupon-grid">
        {/* Left Column */}
        <div className="edit-coupon-left-col">
          {/* Card 1: Coupon identity */}
          <div className="coupon-editor-card">
            <h2 className="editor-card-title">Coupon identity</h2>
            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label" htmlFor="coupon-code-input">
                  CODE
                </label>
                <input
                  id="coupon-code-input"
                  className="form-input"
                  type="text"
                  value={code}
                  placeholder="e.g. WELCOME10"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="coupon-name-input">
                  NAME
                </label>
                <input
                  id="coupon-name-input"
                  className="form-input"
                  type="text"
                  value={name}
                  placeholder="e.g. Welcome offer - DEMO"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="coupon-desc-input">
                DESCRIPTION
              </label>
              <input
                id="coupon-desc-input"
                className="form-input"
                type="text"
                value={description}
                placeholder="e.g. Welcome offer description - DEMO"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Card 2: Discount definition */}
          <div className="coupon-editor-card">
            <h2 className="editor-card-title">Discount definition</h2>
            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label" htmlFor="discount-type-input">
                  DISCOUNT TYPE
                </label>
                <input
                  id="discount-type-input"
                  className="form-input"
                  type="text"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                />
                <span className="form-input-hint">
                  Confirm with backend · enum options not supplied.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="discount-value-input">
                  DISCOUNT VALUE
                </label>
                <input
                  id="discount-value-input"
                  className="form-input"
                  type="text"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <span className="form-input-hint">
                  DEMO · interpretation depends on confirmed type.
                </span>
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label" htmlFor="min-order-input">
                  MINIMUM ORDER AMOUNT
                </label>
                <input
                  id="min-order-input"
                  className="form-input"
                  type="text"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="max-discount-input">
                  MAXIMUM DISCOUNT AMOUNT
                </label>
                <input
                  id="max-discount-input"
                  className="form-input"
                  type="text"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="card-footer-notice">
              Exact type-dependent policy: Confirm with backend. Server validates constraints; no percentage or amount interpretation is assumed.
            </div>
          </div>

          {/* Card 3: Validity window */}
          <div className="coupon-editor-card">
            <h2 className="editor-card-title">Validity window</h2>
            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label" htmlFor="valid-from-input">
                  VALID FROM
                </label>
                <input
                  id="valid-from-input"
                  className="form-input"
                  type="text"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="valid-until-input">
                  VALID UNTIL
                </label>
                <input
                  id="valid-until-input"
                  className="form-input"
                  type="text"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="card-footer-notice">
              DEMO · en-IN / Asia/Kolkata. Use selected locale and timezone; final validation belongs to the backend.
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="edit-coupon-right-col">
          {/* Card 1: Activation */}
          <div className="coupon-editor-card">
            <h2 className="editor-card-title">Activation</h2>
            <div className="activation-toggle-group">
              <label className="coupon-switch" id="toggle-coupon-activation">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="coupon-slider"></span>
              </label>
              <span className="activation-label-status">
                Active · {isActive ? 'On' : 'Off'}
              </span>
            </div>
            <div className="activation-subtext">
              is_active · independent of dates
            </div>

            <div className="validity-summary-box">
              <div className="validity-summary-label">VALIDITY SUMMARY</div>
              <div className="validity-summary-date">
                01-31 Oct 2026 · DEMO
              </div>
              <div className="validity-summary-desc">
                The date range is a configured window, not a live eligibility check. Active does not override validity.
              </div>
            </div>
          </div>

          {/* Card 2: Global usage */}
          <div className="coupon-editor-card">
            <h2 className="editor-card-title">Global usage</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="global-usage-limit-input">
                GLOBAL USAGE LIMIT
              </label>
              <input
                id="global-usage-limit-input"
                className="form-input"
                type="text"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
              <span className="form-input-hint">DEMO · usage_limit</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="usage-count-readonly-input">
                USAGE COUNT · READ ONLY
              </label>
              <input
                id="usage-count-readonly-input"
                className="form-input readonly"
                type="text"
                value={usageCount}
                disabled
                readOnly
              />
              <span className="form-input-hint">
                Edit only · returned by backend, never user-entered.
              </span>
            </div>
          </div>

          {/* Card 3: Create & edit Informational card */}
          <div className="info-card">
            <h3>Create & edit</h3>
            <p>
              Create uses blank input and "Create coupon". Usage count is omitted until a record is returned. Edit uses "Save changes".
            </p>
            <p>
              No audience restrictions, per-customer caps, stacking or claim history are implied.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="edit-coupon-bottom-bar">
        <div className="bottom-bar-left-notice">
          <div className="notice-bold">Static form · No changes are submitted</div>
          <div className="notice-muted">
            Design only · No live data connection. Backend owns validation, authorization and transactions.
          </div>
        </div>

        <div className="bottom-bar-right-actions">
          <button
            className="btn-cancel"
            id="btn-cancel-coupon"
            onClick={() => navigate('/dashboard/coupons')}
          >
            Cancel
          </button>
          <button
            className="btn-save-changes"
            id="btn-save-coupon"
            onClick={handleSave}
          >
            {isCreateMode ? 'Create coupon' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
