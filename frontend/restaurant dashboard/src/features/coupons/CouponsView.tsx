import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CouponItem,
  getCouponsStore,
  toggleCouponActive,
} from '../../services/couponData';
import './CouponsPage.css';

interface CouponsViewProps {
  onNotify?: (msg: string) => void;
}

export const CouponsView: React.FC<CouponsViewProps> = ({ onNotify }) => {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<CouponItem[]>(() => getCouponsStore());
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [scope, setScope] = useState<'all' | 'coupons_only' | 'points_cashback'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [validityFilter, setValidityFilter] = useState<string>('all');

  const notify = (msg: string) => {
    if (onNotify) {
      onNotify(msg);
    }
  };

  const handleToggle = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    const updated = toggleCouponActive(id);
    if (updated) {
      setCoupons(getCouponsStore());
      notify(`${updated.code} is now ${updated.isActive ? 'Active' : 'Inactive'}`);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Code', 'Name', 'Discount', 'Usage Count', 'Usage Limit', 'Validity', 'Active'];
    const rows = coupons.map((c) => [
      c.code,
      `"${c.name}"`,
      c.discountLabel,
      c.usageCount,
      c.usageLimit,
      `"${c.validityRangeLabel}"`,
      c.isActive ? 'Active' : 'Inactive',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'restrauque_coupons_demo.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Exported coupons CSV successfully');
  };

  // KPI Calculations
  const activeCouponsCount = useMemo(() => coupons.filter((c) => c.isActive).length, [coupons]);
  const globalUsageCount = useMemo(() => coupons.reduce((sum, c) => sum + c.usageCount, 0), [coupons]);
  const globalUsageLimit = useMemo(() => coupons.reduce((sum, c) => sum + c.usageLimit, 0), [coupons]);

  const withinValidityCount = useMemo(() => {
    return coupons.filter((c) => {
      return c.code === 'WELCOME10' || c.code === 'LUNCH80';
    }).length;
  }, [coupons]);

  // Filtering
  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      if (statusFilter === 'active' && !coupon.isActive) return false;
      if (statusFilter === 'inactive' && coupon.isActive) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCode = coupon.code.toLowerCase().includes(query);
        const matchesName = coupon.name.toLowerCase().includes(query);
        if (!matchesCode && !matchesName) return false;
      }

      if (validityFilter === 'within') {
        return coupon.code === 'WELCOME10' || coupon.code === 'LUNCH80';
      } else if (validityFilter === 'upcoming') {
        return coupon.code === 'COMEBACK15' || coupon.code === 'RETURN20';
      } else if (validityFilter === 'expired') {
        return coupon.code === 'WEEKEND5';
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
        >
          All Offers
        </button>
        <button
          className={`scope-pill ${scope === 'coupons_only' ? 'active' : ''}`}
          onClick={() => setScope('coupons_only')}
        >
          Coupons Only
        </button>
        <button
          className={`scope-pill ${scope === 'points_cashback' ? 'active' : ''}`}
          onClick={() => setScope('points_cashback')}
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
          <div className="kpi-card-value">{activeCouponsCount}</div>
          <div className="kpi-card-sublabel">Active coupons only · Demo data</div>
        </div>

        <div className="coupon-kpi-card" id="kpi-global-usage">
          <div className="kpi-card-header">
            <span>Global usage count</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{globalUsageCount.toLocaleString()}</div>
          <div className="kpi-card-sublabel">Not a claim ledger · Demo data</div>
        </div>

        <div className="coupon-kpi-card" id="kpi-usage-limit">
          <div className="kpi-card-header">
            <span>Global usage limit</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{globalUsageLimit.toLocaleString()}</div>
          <div className="kpi-card-sublabel">Across sample coupons · Demo data</div>
        </div>

        <div className="coupon-kpi-card" id="kpi-validity-window">
          <div className="kpi-card-header">
            <span>Within validity window</span>
            <span className="kpi-link-icon">↗</span>
          </div>
          <div className="kpi-card-value">{withinValidityCount}</div>
          <div className="kpi-card-sublabel">As of 10 Oct 2026 · demo</div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="coupons-content-card">
        <div className="content-card-title-group">
          <h2>Coupons / List / Demo</h2>
          <p className="content-card-subtitle">
            Review coupon definitions, validity windows and usage counts. Filters: Active and Validity.
          </p>
        </div>

        {/* Filter controls */}
        <div className="coupons-filter-bar">
          <div className="filter-left-controls">
            <div className="status-segmented-control">
              <button
                className={`seg-btn ${statusFilter === 'all' ? 'active' : ''}`}
                id="filter-status-all"
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button
                className={`seg-btn ${statusFilter === 'active' ? 'active' : ''}`}
                id="filter-status-active"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </button>
              <button
                className={`seg-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
                id="filter-status-inactive"
                onClick={() => setStatusFilter('inactive')}
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
              <option value="all">Validity window ⌄</option>
              <option value="within">Within window (Oct 10)</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <button
            className="btn-export-csv"
            id="btn-export-coupons-csv"
            onClick={handleExportCsv}
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
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-coupons">
                    No coupons match the selected filter criteria.
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
                        >
                          Edit
                        </button>
                      </div>
                    </td>

                    <td>
                      <div className="coupon-discount-cell">
                        <span className="coupon-discount-val">{coupon.discountLabel}</span>
                        <span className="coupon-dot">·</span>
                        <span className="coupon-discount-sub">Confirm with backend</span>
                      </div>
                    </td>

                    <td>
                      <span className="coupon-usage-cell">
                        {coupon.usageCount} / {coupon.usageLimit}
                      </span>
                    </td>

                    <td>
                      <span className="coupon-validity-cell">{coupon.validityRangeLabel}</span>
                    </td>

                    <td>
                      {coupon.isActive ? (
                        <span className="status-pill active">Active</span>
                      ) : coupon.usageCount >= coupon.usageLimit ? (
                        <span className="status-pill inactive">Inactive</span>
                      ) : (
                        <span className="status-pill off">Off</span>
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

        {/* Table footer with schema note and secondary create button */}
        <div className="coupons-table-footer">
          <p className="schema-note">
            Discount type enum pending. No per-customer caps, eligibility restrictions or claim ledger in current schema.
          </p>
          <button
            className="btn-create-coupon"
            id="btn-create-coupon-bottom"
            onClick={() => navigate('/dashboard/coupons/create')}
          >
            Create coupon
          </button>
        </div>
      </div>
    </div>
  );
};
