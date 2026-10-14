import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  couponService,
  CouponDiscountType,
  CreateCouponInput,
  UpdateCouponInput,
} from '../../services/couponService';
import { ApiClientError } from '../../services/apiClient';
import './EditCouponPage.css';

function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  const localTime = new Date(d.getTime() - offset);
  return localTime.toISOString().slice(0, 16);
}

export const EditCouponPage: React.FC = () => {
  const { couponId } = useParams<{ couponId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isCreateRoute = location.pathname.includes('/create') || !couponId;
  const [isCreateMode, setIsCreateMode] = useState<boolean>(isCreateRoute);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<CouponDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [minOrderAmount, setMinOrderAmount] = useState<string>('0');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>('');
  const [validFrom, setValidFrom] = useState<string>(() =>
    toDateTimeLocal(new Date().toISOString())
  );
  const [validUntil, setValidUntil] = useState<string>(() =>
    toDateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
  );
  const [isActive, setIsActive] = useState<boolean>(true);
  const [usageLimit, setUsageLimit] = useState<string>('100');
  const [usageCount, setUsageCount] = useState<number>(0);
  const [activeCouponId, setActiveCouponId] = useState<string>('');

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load existing coupon if editing
  useEffect(() => {
    if (isCreateRoute) {
      setIsCreateMode(true);
      setCode('');
      setName('');
      setDescription('');
      setDiscountType('percentage');
      setDiscountValue('10');
      setMinOrderAmount('0');
      setMaxDiscountAmount('');
      setValidFrom(toDateTimeLocal(new Date().toISOString()));
      setValidUntil(toDateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()));
      setIsActive(true);
      setUsageLimit('100');
      setUsageCount(0);
      setActiveCouponId('');
      setErrorMessage(null);
    } else if (couponId) {
      setIsCreateMode(false);
      setIsLoading(true);
      setErrorMessage(null);

      couponService
        .getCoupon(couponId)
        .then((res) => {
          const c = res.coupon;
          setActiveCouponId(c.id);
          setCode(c.code);
          setName(c.name);
          setDescription(c.description || '');
          setDiscountType(c.discountType);
          setDiscountValue(String(c.discountValue));
          setMinOrderAmount(String(c.minimumOrderAmount));
          setMaxDiscountAmount(c.maximumDiscountAmount !== null ? String(c.maximumDiscountAmount) : '');
          setValidFrom(toDateTimeLocal(c.validFrom));
          setValidUntil(c.validUntil ? toDateTimeLocal(c.validUntil) : '');
          setIsActive(c.isActive);
          setUsageLimit(c.usageLimit !== null ? String(c.usageLimit) : '');
          setUsageCount(c.usageCount);
        })
        .catch((err: unknown) => {
          const msg =
            err instanceof ApiClientError
              ? err.message
              : 'Failed to load coupon details from server.';
          setErrorMessage(msg);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [couponId, isCreateRoute]);

  const handleToggleMode = () => {
    if (!isCreateMode) {
      setIsCreateMode(true);
      setCode('');
      setName('');
      setDescription('');
      setDiscountType('percentage');
      setDiscountValue('10');
      setMinOrderAmount('0');
      setMaxDiscountAmount('');
      setValidFrom(toDateTimeLocal(new Date().toISOString()));
      setValidUntil(toDateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()));
      setIsActive(true);
      setUsageLimit('100');
      setUsageCount(0);
      setErrorMessage(null);
    } else {
      if (activeCouponId) {
        setIsCreateMode(false);
        setErrorMessage(null);
      } else {
        navigate('/dashboard/coupons');
      }
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Client-side validations
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 2) {
      setErrorMessage('Coupon code must be at least 2 characters long.');
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      setErrorMessage('Coupon code can only contain letters, numbers, hyphens, and underscores.');
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Coupon name cannot be empty.');
      return;
    }

    const numDisc = parseFloat(discountValue);
    if (isNaN(numDisc) || numDisc <= 0) {
      setErrorMessage('Discount value must be a valid positive number.');
      return;
    }

    if (discountType === 'percentage' && numDisc > 100) {
      setErrorMessage('Percentage discount cannot exceed 100%.');
      return;
    }

    const numMinOrder = minOrderAmount.trim() ? parseFloat(minOrderAmount) : 0;
    if (isNaN(numMinOrder) || numMinOrder < 0) {
      setErrorMessage('Minimum order amount cannot be negative.');
      return;
    }

    let numMaxDiscount: number | null = null;
    if (discountType === 'percentage' && maxDiscountAmount.trim()) {
      const parsed = parseFloat(maxDiscountAmount);
      if (isNaN(parsed) || parsed <= 0) {
        setErrorMessage('Maximum discount amount must be a positive number.');
        return;
      }
      numMaxDiscount = parsed;
    }

    let numUsageLimit: number | null = null;
    if (usageLimit.trim()) {
      const parsed = parseInt(usageLimit, 10);
      if (isNaN(parsed) || parsed < 1) {
        setErrorMessage('Usage limit must be an integer of at least 1.');
        return;
      }
      numUsageLimit = parsed;
    }

    let isoFrom: string | undefined = undefined;
    if (validFrom) {
      const parsedDate = new Date(validFrom);
      if (isNaN(parsedDate.getTime())) {
        setErrorMessage('Valid From must be a valid date.');
        return;
      }
      isoFrom = parsedDate.toISOString();
    }

    let isoUntil: string | null = null;
    if (validUntil) {
      const parsedDate = new Date(validUntil);
      if (isNaN(parsedDate.getTime())) {
        setErrorMessage('Valid Until must be a valid date.');
        return;
      }
      if (isoFrom && parsedDate.getTime() <= new Date(isoFrom).getTime()) {
        setErrorMessage('Valid Until must be later than Valid From.');
        return;
      }
      isoUntil = parsedDate.toISOString();
    }

    setIsSubmitting(true);

    try {
      if (isCreateMode) {
        const payload: CreateCouponInput = {
          code: cleanCode,
          name: cleanName,
          description: description.trim() || null,
          discountType,
          discountValue: numDisc,
          minimumOrderAmount: numMinOrder,
          maximumDiscountAmount: numMaxDiscount,
          usageLimit: numUsageLimit,
          validFrom: isoFrom,
          validUntil: isoUntil,
          isActive,
        };

        const res = await couponService.createCoupon(payload);
        setToastMessage(`Coupon ${res.coupon.code} created successfully`);

        setTimeout(() => {
          navigate('/dashboard/coupons');
        }, 700);
      } else {
        const payload: UpdateCouponInput = {
          code: cleanCode,
          name: cleanName,
          description: description.trim() || null,
          discountType,
          discountValue: numDisc,
          minimumOrderAmount: numMinOrder,
          maximumDiscountAmount: numMaxDiscount,
          usageLimit: numUsageLimit,
          validFrom: isoFrom,
          validUntil: isoUntil,
          isActive,
        };

        const res = await couponService.updateCoupon(activeCouponId, payload);
        setToastMessage(`Coupon ${res.coupon.code} updated successfully`);

        setTimeout(() => {
          navigate('/dashboard/coupons');
        }, 700);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to persist coupon to the database';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
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

      {/* Error banner */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #F87171',
            color: '#B91C1C',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>⚠ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#B91C1C',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="edit-coupon-header-section">
        <div>
          <p className="edit-coupon-breadcrumb">
            Coupons / {isCreateMode ? 'Create' : 'Edit'} · Connected to Neon PostgreSQL Database
          </p>
          <h1 className="edit-coupon-title" id="page-title">
            {isCreateMode
              ? 'Create coupon'
              : `Edit coupon - ${code || activeCouponId}`}
          </h1>
        </div>
        {!isCreateRoute && (
          <button
            className="btn-toggle-mode"
            id="btn-toggle-coupon-mode"
            onClick={handleToggleMode}
            type="button"
          >
            {isCreateMode ? 'Edit mode' : 'Create mode'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
          Loading coupon details from server...
        </div>
      ) : (
        /* Two Column Grid */
        <div className="edit-coupon-grid">
          {/* Left Column */}
          <div className="edit-coupon-left-col">
            {/* Card 1: Coupon identity */}
            <div className="coupon-editor-card">
              <h2 className="editor-card-title">Coupon identity</h2>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="coupon-code-input">
                    CODE *
                  </label>
                  <input
                    id="coupon-code-input"
                    className="form-input"
                    type="text"
                    value={code}
                    placeholder="e.g. WELCOME10"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={isSubmitting}
                  />
                  <span className="form-input-hint">Unique uppercase code per restaurant</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="coupon-name-input">
                    NAME *
                  </label>
                  <input
                    id="coupon-name-input"
                    className="form-input"
                    type="text"
                    value={name}
                    placeholder="e.g. Welcome offer"
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
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
                  placeholder="e.g. 10% off for first-time dine-in customers"
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Card 2: Discount definition */}
            <div className="coupon-editor-card">
              <h2 className="editor-card-title">Discount definition</h2>
              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="discount-type-input">
                    DISCOUNT TYPE *
                  </label>
                  <select
                    id="discount-type-input"
                    className="form-input"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
                    disabled={isSubmitting}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                  <span className="form-input-hint">
                    Select percentage discount or flat currency deduction
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="discount-value-input">
                    DISCOUNT VALUE *
                  </label>
                  <input
                    id="discount-value-input"
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={discountType === 'percentage' ? 100 : undefined}
                    placeholder={discountType === 'percentage' ? 'e.g. 10 (%)' : 'e.g. 50 (₹)'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <span className="form-input-hint">
                    {discountType === 'percentage' ? 'Value between 0.01% and 100%' : 'Flat amount in ₹'}
                  </span>
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="min-order-input">
                    MINIMUM ORDER AMOUNT (₹)
                  </label>
                  <input
                    id="min-order-input"
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <span className="form-input-hint">Minimum cart subtotal to apply coupon</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="max-discount-input">
                    MAXIMUM DISCOUNT AMOUNT (₹)
                  </label>
                  <input
                    id="max-discount-input"
                    className={`form-input ${discountType === 'fixed' ? 'readonly' : ''}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={discountType === 'fixed' ? 'N/A for fixed discounts' : 'Optional cap (₹)'}
                    value={discountType === 'fixed' ? '' : maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    disabled={discountType === 'fixed' || isSubmitting}
                  />
                  <span className="form-input-hint">
                    {discountType === 'fixed'
                      ? 'Not applicable for flat discount types'
                      : 'Upper cap on percentage discount savings'}
                  </span>
                </div>
              </div>

              <div className="card-footer-notice">
                Backend enforces transactional validation and database decimal precision (2 decimal places).
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
                    type="datetime-local"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="valid-until-input">
                    VALID UNTIL (OPTIONAL)
                  </label>
                  <input
                    id="valid-until-input"
                    className="form-input"
                    type="datetime-local"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="card-footer-notice">
                Times are interpreted in local timezone and converted to UTC timestamps in PostgreSQL.
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
                    disabled={isSubmitting}
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
                  {validFrom ? new Date(validFrom).toLocaleDateString() : 'Immediate'}
                  {' → '}
                  {validUntil ? new Date(validUntil).toLocaleDateString() : 'No expiry'}
                </div>
                <div className="validity-summary-desc">
                  Coupons are redeemable when Active is enabled and current time falls within the configured validity window.
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
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Optional limit (e.g. 100)"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  disabled={isSubmitting}
                />
                <span className="form-input-hint">Maximum number of total redeems allowed</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="usage-count-readonly-input">
                  USAGE COUNT · READ ONLY
                </label>
                <input
                  id="usage-count-readonly-input"
                  className="form-input readonly"
                  type="text"
                  value={isCreateMode ? '0 (New coupon)' : `${usageCount} redeems`}
                  disabled
                  readOnly
                />
                <span className="form-input-hint">
                  Persisted count returned by database ledger.
                </span>
              </div>
            </div>

            {/* Card 3: Informational card */}
            <div className="info-card">
              <h3>Database Persistence</h3>
              <p>
                Submitting this form executes an authenticated API request to <code>/api/v1/owner/coupons</code>, saving the record in Neon PostgreSQL.
              </p>
              <p>
                Refreshing the page or navigating back reads the authoritative data directly from the server.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="edit-coupon-bottom-bar">
        <div className="bottom-bar-left-notice">
          <div className="notice-bold">Live PostgreSQL Persistence</div>
          <div className="notice-muted">
            All coupons are validated against backend business rules and persisted to your restaurant database.
          </div>
        </div>

        <div className="bottom-bar-right-actions">
          <button
            className="btn-cancel"
            id="btn-cancel-coupon"
            onClick={() => navigate('/dashboard/coupons')}
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </button>
          <button
            className="btn-save-changes"
            id="btn-save-coupon"
            onClick={handleSave}
            disabled={isSubmitting || isLoading}
            type="button"
          >
            {isSubmitting
              ? isCreateMode
                ? 'Creating...'
                : 'Saving...'
              : isCreateMode
              ? 'Create coupon'
              : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
