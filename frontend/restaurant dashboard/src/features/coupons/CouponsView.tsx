import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  couponService,
  SafeCoupon,
  CouponSummaryCounts,
} from '../../services/couponService';
import { ApiClientError } from '../../services/apiClient';
import './CouponsPage.css';

interface CouponsViewProps {
  onNotify?: (msg: string) => void;
  onCountUpdate?: (count: number) => void;
}

function formatDateDisplay(iso?: string | null): string {
  if (!iso) return 'None';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDiscountLabel(c: SafeCoupon): string {
  if (c.discountType === 'percentage') {
    return `${c.discountValue}% off`;
  }
  return `₹${c.discountValueFormatted} off`;
}

export const CouponsView: React.FC<CouponsViewProps> = ({ onNotify, onCountUpdate }) => {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<SafeCoupon[]>([]);
  const [summary, setSummary] = useState<CouponSummaryCounts | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [scope, setScope] = useState<'all' | 'coupons_only' | 'points_cashback'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [validityFilter, setValidityFilter] = useState<string>('all');

  const notify = useCallback(
    (msg: string) => {
      if (onNotify) {
        onNotify(msg);
      }
    },
    [onNotify]
  );

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await couponService.getCoupons();
      setCoupons(response.coupons || []);
      setSummary(response.summary || null);
      if (onCountUpdate) {
        onCountUpdate(response.summary?.totalCoupons ?? response.coupons.length);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to load coupons from server';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [onCountUpdate]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleToggle = async (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();

    const targetCoupon = coupons.find((c) => c.id === id);
    if (!targetCoupon) return;

    const previousState = targetCoupon.isActive;
    const nextState = !previousState;

    // Optimistic UI update
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: nextState } : c))
    );

    try {
      const result = await couponService.updateCoupon(id, { isActive: nextState });
      notify(`${result.coupon.code} is now ${result.coupon.isActive ? 'Active' : 'Inactive'}`);
      // Refresh summary numbers
      fetchCoupons();
    } catch (err: unknown) {
      // Rollback on failure
      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: previousState } : c))
      );
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Failed to update coupon status on server';
      notify(`⚠ ${msg}`);
    }
  };

  const handleExportCsv = () => {
    if (coupons.length === 0) {
      notify('No coupons available to export');
      return;
    }

    const headers = [
      'Code',
      'Name',
      'Discount Type',
      'Discount Value',
      'Min Order',
      'Max Discount',
      'Usage Count',
      'Usage Limit',
      'Valid From',
      'Valid Until',
      'Active',
      'Status',
    ];

    const rows = coupons.map((c) => [
      c.code,
      `"${c.name.replace(/"/g, '""')}"`,
      c.discountType,
      c.discountValue,
      c.minimumOrderAmount,
      c.maximumDiscountAmount ?? 'None',
      c.usageCount,
      c.usageLimit ?? 'Unlimited',
      c.validFrom,
      c.validUntil ?? 'No expiry',
      c.isActive ? 'Yes' : 'No',
      c.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `coupons_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Exported coupons CSV successfully');
  };

  // KPI Calculations
  const activeCouponsCount = useMemo(() => {
    if (summary) return summary.activeCoupons;
    return coupons.filter((c) => c.isActive).length;
  }, [summary, coupons]);

  const globalUsageCount = useMemo(() => {
    return coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);
  }, [coupons]);

  const globalUsageLimit = useMemo(() => {
    return coupons.reduce((sum, c) => sum + (c.usageLimit || 0), 0);
  }, [coupons]);

  const withinValidityCount = useMemo(() => {
    return coupons.filter((c) => c.status === 'active').length;
  }, [coupons]);

  // Filtering
  const filteredCoupons = useMemo(() => {
    const now = new Date();

    return coupons.filter((coupon) => {
      // Status filter
      if (statusFilter === 'active' && !coupon.isActive) return false;
      if (statusFilter === 'inactive' && coupon.isActive) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCode = coupon.code.toLowerCase().includes(query);
        const matchesName = coupon.name.toLowerCase().includes(query);
        if (!matchesCode && !matchesName) return false;
      }

      // Validity filter
      if (validityFilter === 'within') {
        const from = new Date(coupon.validFrom);
        const until = coupon.validUntil ? new Date(coupon.validUntil) : null;
        if (from > now || (until && until < now)) return false;
      } else if (validityFilter === 'upcoming') {
        const from = new Date(coupon.validFrom);
        if (from <= now) return false;
      } else if (validityFilter === 'expired') {
        if (!coupon.validUntil) return false;
        const until = new Date(coupon.validUntil);
        if (until >= now) return false;
      }

      return true;
    });
  }, [coupons, statusFilter, searchQuery, validityFilter]);

  return (
    <div className="coupons-tab-content">
      {/* Scope Filter Bar */}
      <div className="coupons-scope-bar">
        <span className="scope-label">Scope:</span>
        <button
          className={`scope-pill ${scope === 'all' ? 'active' : ''}`}
          onClick={() => setScope('all')}
          type="button"
        >
          All Offers
        </button>
        <button
          className={`scope-pill ${scope === 'coupons_only' ? 'active' : ''}`}
          onClick={() => setScope('coupons_only')}
          type="button"
        >
          Coupons Only
        </button>
        <button
          className={`scope-pill ${scope === 'points_cashback' ? 'active' : ''}`}
          onClick={() => setScope('points_cashback')}
          type="button"
        >
          Points & Cashback
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="coupons-kpi-grid">
        <div className="coupon-kpi-card" id="kpi-active-coupons">
          <div className="kpi-card-header">
            <span>Active coupons</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{isLoading ? '...' : activeCouponsCount}</div>
          <div className="kpi-card-sublabel">Live active coupons</div>
        </div>

        <div className="coupon-kpi-card" id="kpi-global-usage">
          <div className="kpi-card-header">
            <span>Global usage count</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{isLoading ? '...' : globalUsageCount.toLocaleString()}</div>
          <div className="kpi-card-sublabel">Total redeems to date</div>
        </div>

        <div className="coupon-kpi-card" id="kpi-usage-limit">
          <div className="kpi-card-header">
            <span>Global usage limit</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{isLoading ? '...' : globalUsageLimit.toLocaleString()}</div>
          <div className="kpi-card-sublabel">Cumulative limit capacity</div>
        </div>

        <div className="coupon-kpi-card" id="kpi-validity-window">
          <div className="kpi-card-header">
            <span>Within validity window</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{isLoading ? '...' : withinValidityCount}</div>
          <div className="kpi-card-sublabel">Currently valid for redemption</div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="coupons-content-card">
        <div className="content-card-title-group">
          <h2>Coupons List</h2>
          <p className="content-card-subtitle">
            Manage your restaurant coupons, discount policies, and global usage limits.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            style={{
              margin: '16px 0',
              padding: '12px 16px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #F87171',
              borderRadius: '8px',
              color: '#B91C1C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13.5px',
            }}
          >
            <span>⚠ {errorMessage}</span>
            <button
              onClick={fetchCoupons}
              style={{
                backgroundColor: '#B91C1C',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter controls */}
        <div className="coupons-filter-bar">
          <div className="filter-left-controls">
            <div className="status-segmented-control">
              <button
                className={`seg-btn ${statusFilter === 'all' ? 'active' : ''}`}
                id="filter-status-all"
                onClick={() => setStatusFilter('all')}
                type="button"
              >
                All
              </button>
              <button
                className={`seg-btn ${statusFilter === 'active' ? 'active' : ''}`}
                id="filter-status-active"
                onClick={() => setStatusFilter('active')}
                type="button"
              >
                Active
              </button>
              <button
                className={`seg-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
                id="filter-status-inactive"
                onClick={() => setStatusFilter('inactive')}
                type="button"
              >
                Inactive
              </button>
            </div>

            <div className="coupon-search-input-wrap">
              <span className="coupon-search-icon">🔍</span>
              <input
                type="text"
                className="coupon-search-input"
                id="input-coupon-search"
                placeholder="Search code or name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="validity-dropdown-select"
              id="select-validity-window"
              value={validityFilter}
              onChange={(e) => setValidityFilter(e.target.value)}
            >
              <option value="all">All Validity Windows</option>
              <option value="within">Within Window (Current)</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <button
            className="btn-export-csv"
            id="btn-export-coupons-csv"
            onClick={handleExportCsv}
            type="button"
          >
            <span>Export CSV</span>
          </button>
        </div>

        {/* Data Table */}
        <div className="coupons-table-wrapper">
          <table className="coupons-table" id="coupons-data-table">
            <thead>
              <tr>
                <th>CODE · NAME</th>
                <th>DISCOUNT · TYPE</th>
                <th>USAGE</th>
                <th>VALIDITY</th>
                <th>ACTIVE</th>
                <th style={{ textAlign: 'right', paddingRight: '20px' }}>ACTIVE TOGGLE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#6B7280' }}>
                    Loading coupons from database...
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-coupons" style={{ textAlign: 'center', padding: '36px' }}>
                    {searchQuery.trim() || statusFilter !== 'all' || validityFilter !== 'all'
                      ? 'No coupons match the selected filter criteria.'
                      : 'No coupons found. Click "Create coupon" below to create your first promotion!'}
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    id={`coupon-row-${coupon.id}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/dashboard/coupons/${coupon.id}/edit`)}
                  >
                    <td>
                      <div className="coupon-code-name">
                        <span className="coupon-code">{coupon.code}</span>
                        <span className="coupon-dot">·</span>
                        <span className="coupon-name">{coupon.name}</span>
                        <button
                          className="coupon-edit-link"
                          id={`btn-edit-${coupon.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/coupons/${coupon.id}/edit`);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                      </div>
                    </td>

                    <td>
                      <div className="coupon-discount-cell">
                        <span className="coupon-discount-val">
                          {formatDiscountLabel(coupon)}
                        </span>
                        <span className="coupon-dot">·</span>
                        <span className="coupon-discount-sub" style={{ textTransform: 'capitalize' }}>
                          {coupon.discountType}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="coupon-usage-cell">
                        {coupon.usageCount} / {coupon.usageLimit !== null ? coupon.usageLimit : '∞'}
                      </span>
                    </td>

                    <td>
                      <span className="coupon-validity-cell">
                        {formatDateDisplay(coupon.validFrom)}
                        {' - '}
                        {coupon.validUntil ? formatDateDisplay(coupon.validUntil) : 'Ongoing'}
                      </span>
                    </td>

                    <td>
                      {coupon.isActive ? (
                        <span className="status-pill active">Active</span>
                      ) : (
                        <span className="status-pill off">Inactive</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                      <label
                        className="coupon-switch"
                        id={`switch-${coupon.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={coupon.isActive}
                          onChange={(e) => handleToggle(coupon.id, e)}
                        />
                        <span className="coupon-slider"></span>
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer with secondary create button */}
        <div className="coupons-table-footer">
          <p className="schema-note">
            Authoritative coupon records loaded from Neon PostgreSQL. Changes are transactional.
          </p>
          <button
            className="btn-create-coupon"
            id="btn-create-coupon-bottom"
            onClick={() => navigate('/dashboard/coupons/create')}
            type="button"
          >
            Create coupon
          </button>
        </div>
      </div>
    </div>
  );
};
