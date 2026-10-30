import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  loyaltyService,
  LoyaltyRuleSummary,
  OwnerLoyaltyAccountItem,
  OwnerLoyaltyAccountsSummary,
  OwnerLoyaltyAccountDetailResponse,
  LoyaltyPaginationInfo,
} from '../../services/loyaltyService';
import { DEFAULT_LOYALTY_PROGRAM } from '../../services/loyaltyData';
import './LoyaltyView.css';

interface LoyaltyViewProps {
  onConfigureReward?: () => void;
}

export const LoyaltyView: React.FC<LoyaltyViewProps> = () => {
  const navigate = useNavigate();
  const { restaurant, activeBranch, availableBranches } = useRestaurant();

  const [selectedBranch, setSelectedBranch] = useState(activeBranch?.name || 'Main Branch');
  const [showRewardModal, setShowRewardModal] = useState(false);

  // 1. Live program rules state (Step 8F)
  const [programRules, setProgramRules] = useState<LoyaltyRuleSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 2. Live customer accounts & summary metrics state (Step 8K)
  const [accounts, setAccounts] = useState<OwnerLoyaltyAccountItem[]>([]);
  const [accountsSummary, setAccountsSummary] = useState<OwnerLoyaltyAccountsSummary | null>(null);
  const [pagination, setPagination] = useState<LoyaltyPaginationInfo | null>(null);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 3. Live account detail & ledger state (Step 8K)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] =
    useState<OwnerLoyaltyAccountDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Load program rules
  const loadRules = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setFetchError(null);

      try {
        const res = await loyaltyService.getLoyaltyRules({
          restaurantId: restaurant?.id,
          signal,
        });
        setProgramRules(res.loyaltyProgram);
        setFetchError(null);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Unable to connect to loyalty rules service';
        setFetchError(message);
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [restaurant?.id]
  );

  // Load paginated accounts and summary metrics
  const loadAccounts = useCallback(
    async (signal?: AbortSignal) => {
      setAccountsLoading(true);
      setAccountsError(null);

      try {
        const res = await loyaltyService.getLoyaltyAccounts({
          restaurantId: restaurant?.id,
          page,
          limit: 10,
          search: searchTerm.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          signal,
        });

        setAccounts(res.accounts);
        setAccountsSummary(res.summary);
        setPagination(res.pagination);
        setAccountsError(null);

        // Auto-select first account if nothing currently selected or current selection is not in list
        if (res.accounts.length > 0) {
          setSelectedAccountId((prev) => {
            const stillExists = res.accounts.some((a) => a.id === prev);
            return stillExists ? prev : res.accounts[0].id;
          });
        } else {
          setSelectedAccountId(null);
          setSelectedAccountDetail(null);
        }
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Unable to connect to loyalty accounts API';
        setAccountsError(message);
      } finally {
        if (!signal?.aborted) {
          setAccountsLoading(false);
        }
      }
    },
    [restaurant?.id, page, searchTerm, statusFilter]
  );

  // Load single account detail & ledger
  const loadAccountDetail = useCallback(
    async (accountId: string, signal?: AbortSignal) => {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const res = await loyaltyService.getLoyaltyAccountDetail(accountId, {
          restaurantId: restaurant?.id,
          limit: 20,
          signal,
        });
        setSelectedAccountDetail(res);
        setDetailError(null);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load account details & transactions';
        setDetailError(message);
      } finally {
        if (!signal?.aborted) {
          setDetailLoading(false);
        }
      }
    },
    [restaurant?.id]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadRules(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadRules]);

  useEffect(() => {
    const controller = new AbortController();
    loadAccounts(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadAccounts]);

  useEffect(() => {
    if (!selectedAccountId) {
      setSelectedAccountDetail(null);
      return;
    }
    const controller = new AbortController();
    loadAccountDetail(selectedAccountId, controller.signal);

    return () => {
      controller.abort();
    };
  }, [selectedAccountId, loadAccountDetail]);

  const formatEarningMode = (mode?: string): string => {
    switch (mode) {
      case 'visit_and_review':
        return 'Hybrid (Visit + Review)';
      case 'visit_only':
        return 'Visit Only';
      case 'review_only':
        return 'Review Only';
      default:
        return mode || 'Visit & Review';
    }
  };

  const formatTransactionType = (type: string): string => {
    switch (type) {
      case 'visit_reward':
        return 'Visit Reward';
      case 'review_reward':
        return 'Review Reward';
      case 'redemption':
        return 'Points Redemption';
      case 'cancellation_reversal':
        return 'Cancellation Reversal';
      case 'liability_recovery':
        return 'Liability Recovery';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="loyalty-view">
      {/* Live Integration Status Banner */}
      {fetchError || accountsError ? (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#b91c1c',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>
              <strong>Failed to load live loyalty data:</strong> {fetchError || accountsError}
            </span>
          </div>
          <button
            type="button"
            className="btn-configure-reward"
            style={{ padding: '4px 12px', fontSize: '12px', minHeight: 'unset' }}
            onClick={() => {
              loadRules();
              loadAccounts();
            }}
          >
            Retry
          </button>
        </div>
      ) : isLoading || accountsLoading ? (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: '#1d4ed8',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <span>⏳</span>
          <span>Loading live loyalty program rules and customer accounts from PostgreSQL backend...</span>
        </div>
      ) : (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#065f46',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <span>🟢</span>
          <span>
            <strong>LIVE BACKEND CONNECTED:</strong> Loyalty program rules, customer accounts, and transaction ledgers are synced with PostgreSQL via <code>/api/v1/owner/loyalty/rules</code> and <code>/api/v1/owner/loyalty/accounts</code>. Reward tier progression remains a preview feature until tier CRUD APIs are deployed.
          </span>
        </div>
      )}

      {/* Top Banner showing Active Program with button to Edit / Start */}
      <div className="loyalty-hero-banner" id="loyalty-hero-banner">
        <div>
          <div className="loyalty-hero-title">
            <span>✦</span>
            <span>
              {programRules
                ? `Loyalty Program (Live): ${programRules.name}`
                : isLoading
                ? 'Loading Loyalty Program...'
                : 'Loyalty Program Rules'}
            </span>
          </div>
          <div className="loyalty-hero-desc">
            {programRules
              ? `${programRules.description || 'Rewards earned on visits and reviews'} · Earning Mode: ${formatEarningMode(programRules.earningMode)} · Status: ${programRules.isActive ? 'Active & Rewarding' : 'Inactive'}`
              : 'Configure earning rates and member redemption rates.'}
          </div>
        </div>

        <button
          className="btn-hero-configure"
          id="btn-open-loyalty-setup"
          onClick={() => navigate('/dashboard/loyalty/setup')}
        >
          ⚙ Configure Program Rules
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
          {availableBranches.length > 0 ? (
            availableBranches.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name} ({b.city || 'Main'})
              </option>
            ))
          ) : (
            <option value="Main Branch">Main Branch</option>
          )}
        </select>
      </div>

      {/* Top 2 Columns Grid */}
      <div className="loyalty-top-grid">
        {/* Left Column: Program configuration */}
        <div className="loyalty-card" id="card-program-configuration">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 className="loyalty-card-title" style={{ margin: 0 }}>
              Program configuration
              {programRules && (
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    color: '#047857',
                    fontWeight: 600,
                  }}
                >
                  Live Persisted
                </span>
              )}
            </h2>
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
              Program name · Persisted
            </label>
            <input
              id="input-program-name"
              className="loyalty-input-readonly"
              type="text"
              value={programRules?.name || (isLoading ? 'Loading...' : 'Not available')}
              readOnly
            />
          </div>

          <div className="loyalty-form-group">
            <label className="loyalty-label" htmlFor="input-program-desc">
              Program description · Persisted
            </label>
            <input
              id="input-program-desc"
              className="loyalty-input-readonly"
              type="text"
              value={programRules?.description || (isLoading ? 'Loading...' : 'No description provided')}
              readOnly
            />
          </div>

          <div className="loyalty-form-row">
            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-earning-mode">
                Earning mode · Persisted
              </label>
              <input
                id="input-earning-mode"
                className="loyalty-input-readonly"
                type="text"
                value={formatEarningMode(programRules?.earningMode)}
                readOnly
              />
              <span className="loyalty-hint">
                {programRules
                  ? `${programRules.starsPerVisit} stars per visit · ${programRules.starsPerReview} stars per review`
                  : 'Resolved from backend rules.'}
              </span>
            </div>

            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-active-status">
                Active status · is_active
              </label>
              <input
                id="input-active-status"
                className="loyalty-input-readonly"
                type="text"
                value={
                  programRules !== null
                    ? programRules.isActive
                      ? 'Active · On'
                      : 'Inactive · Off'
                    : isLoading
                    ? 'Loading...'
                    : 'Not available'
                }
                readOnly
              />
              <span className="loyalty-hint">
                {programRules?.isActive
                  ? 'Live and rewarding enrolled customers'
                  : 'Program is paused or inactive'}
              </span>
            </div>
          </div>

          <div className="loyalty-form-row">
            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-stars-visit">
                Stars per visit · Persisted
              </label>
              <input
                id="input-stars-visit"
                className="loyalty-input-readonly"
                type="text"
                value={
                  programRules !== null
                    ? `${programRules.starsPerVisit} stars`
                    : isLoading
                    ? 'Loading...'
                    : 'Not available'
                }
                readOnly
              />
            </div>

            <div className="loyalty-form-group">
              <label className="loyalty-label" htmlFor="input-stars-review">
                Stars per review · Persisted
              </label>
              <input
                id="input-stars-review"
                className="loyalty-input-readonly"
                type="text"
                value={
                  programRules !== null
                    ? `${programRules.starsPerReview} stars`
                    : isLoading
                    ? 'Loading...'
                    : 'Not available'
                }
                readOnly
              />
            </div>
          </div>

          <div className="loyalty-form-group">
            <label className="loyalty-label" htmlFor="input-redemption-rate">
              Redemption conversion rate · Persisted
            </label>
            <input
              id="input-redemption-rate"
              className="loyalty-input-readonly"
              type="text"
              value={
                programRules !== null
                  ? `1 Star = ₹${Number(programRules.redemptionRate).toFixed(2)} discount value`
                  : isLoading
                  ? 'Loading...'
                  : 'Not available'
              }
              readOnly
            />
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
            {programRules
              ? `Live program ID: ${programRules.id} · Last updated: ${new Date(programRules.updatedAt).toLocaleDateString()}.`
              : 'Earning rules and redemption rate are loaded directly from authoritative backend.'}
          </div>
        </div>

        {/* Right Column Stack */}
        <div className="loyalty-right-stack">
          {/* Card 1: Account detail & Transaction Ledger (Live) */}
          <div className="loyalty-card" id="card-account-detail">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
              }}
            >
              <div>
                <h2 className="loyalty-card-title" style={{ margin: 0 }}>
                  {selectedAccountDetail
                    ? selectedAccountDetail.account.customerName
                    : 'Customer Account Details'}
                </h2>
                <span style={{ fontSize: '11.5px', color: '#6B7280' }}>
                  {selectedAccountDetail
                    ? `Account ID: ${selectedAccountDetail.account.id.slice(0, 8)}... · ${selectedAccountDetail.account.programName}`
                    : 'Select an account from the table below'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  background: '#ecfdf5',
                  color: '#047857',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: 600,
                }}
              >
                Live Ledger
              </span>
            </div>

            {detailLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
                ⏳ Loading account profile & transaction ledger...
              </div>
            ) : detailError ? (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#b91c1c',
                  fontSize: '12.5px',
                }}
              >
                <div>Failed to load account ledger: {detailError}</div>
                {selectedAccountId && (
                  <button
                    type="button"
                    onClick={() => loadAccountDetail(selectedAccountId)}
                    style={{
                      marginTop: '8px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #b91c1c',
                      background: '#ffffff',
                      color: '#b91c1c',
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : selectedAccountDetail ? (
              <div>
                <div className="account-preview-list">
                  <div className="account-preview-item">
                    <span className="account-preview-label">Stars balance</span>
                    <span className="account-preview-val" style={{ color: '#D97706', fontSize: '16px' }}>
                      {selectedAccountDetail.account.starsBalance} Stars ★
                    </span>
                  </div>

                  <div className="account-preview-item">
                    <span className="account-preview-label">Lifetime stars earned / redeemed</span>
                    <span className="account-preview-val">
                      {selectedAccountDetail.account.lifetimeStarsEarned} earned ·{' '}
                      {selectedAccountDetail.account.lifetimeStarsRedeemed} redeemed
                    </span>
                  </div>

                  <div className="account-preview-item">
                    <span className="account-preview-label">Tier status</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className={`tier-badge-pill ${
                          selectedAccountDetail.account.tier.toLowerCase().includes('gold')
                            ? 'gold'
                            : selectedAccountDetail.account.tier.toLowerCase().includes('silver')
                            ? 'silver'
                            : 'bronze'
                        }`}
                      >
                        {selectedAccountDetail.account.tier}
                      </span>
                      <span
                        className={`status-pill ${
                          selectedAccountDetail.account.status.toLowerCase() === 'active' ? 'active' : 'inactive'
                        }`}
                      >
                        {selectedAccountDetail.account.status}
                      </span>
                    </div>
                  </div>

                  <div className="account-preview-item">
                    <span className="account-preview-label">Enrolled date</span>
                    <span className="account-preview-val">
                      {new Date(selectedAccountDetail.account.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Transactions Ledger */}
                <div style={{ marginTop: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Recent Ledger Transactions ({selectedAccountDetail.transactions.length})
                    </span>
                  </div>

                  {selectedAccountDetail.transactions.length === 0 ? (
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: '#6B7280',
                        padding: '16px 0',
                        textAlign: 'center',
                        background: '#F9FAFB',
                        borderRadius: '8px',
                      }}
                    >
                      No ledger transactions recorded yet for this customer.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                      }}
                    >
                      {selectedAccountDetail.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          style={{
                            padding: '8px 10px',
                            background: '#F9FAFB',
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                            fontSize: '12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '2px',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#111827' }}>
                              {formatTransactionType(tx.transactionType)}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: tx.stars >= 0 ? '#059669' : '#DC2626',
                              }}
                            >
                              {tx.stars > 0 ? `+${tx.stars}` : tx.stars} ★
                            </span>
                          </div>
                          {tx.description && (
                            <div style={{ color: '#4B5563', fontSize: '11.5px', margin: '2px 0' }}>
                              {tx.description}
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              color: '#9CA3AF',
                              fontSize: '11px',
                              marginTop: '2px',
                            }}
                          >
                            <span>
                              {tx.orderNumber
                                ? `Order #${tx.orderNumber}`
                                : tx.feedbackId
                                ? 'Review Reward'
                                : 'Account adjustment'}
                            </span>
                            <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '30px 16px',
                  textAlign: 'center',
                  color: '#6B7280',
                  fontSize: '13px',
                }}
              >
                No customer account selected.
              </div>
            )}
          </div>

          {/* Card 2: Rewards (Preview only) */}
          <div className="loyalty-card" id="card-rewards">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 className="loyalty-card-title" style={{ margin: 0 }}>Reward Tiers</h2>
                <span style={{ fontSize: '11.5px', color: '#6B7280' }}>
                  Preview · Tiers CRUD planned in future API
                </span>
              </div>
              <button
                className="btn-edit-program-link"
                id="btn-manage-tiers"
                onClick={() => setShowRewardModal(true)}
              >
                <span>Tiers modal</span>
                <span>↗</span>
              </button>
            </div>

            <div className="rewards-active-list">
              {DEFAULT_LOYALTY_PROGRAM.tiers.map((tier) => (
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
                onClick={() => setShowRewardModal(true)}
              >
                Preview reward tiers
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Card: Real Customer Accounts & Ledger Table (Live) */}
      <div className="loyalty-accounts-card" id="card-accounts-table">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h2 className="loyalty-card-title" style={{ margin: 0 }}>
              Customer Loyalty Accounts {pagination ? `(${pagination.totalCount})` : ''}
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: '#ecfdf5',
                  color: '#047857',
                  fontWeight: 600,
                }}
              >
                Live PostgreSQL Data
              </span>
            </h2>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>
              Real enrolled accounts and transaction ledgers belonging to authorized restaurant. Select a customer to inspect ledger.
            </span>
          </div>
        </div>

        {/* Server-derived summary KPI row */}
        {accountsSummary && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '18px',
              padding: '14px',
              background: '#F9FAFB',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Enrolled</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
                {accountsSummary.totalEnrolledAccounts.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Restaurant-wide</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Active Members</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                {accountsSummary.activeAccounts.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Currently active</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>In Circulation</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#D97706', marginTop: '2px' }}>
                {accountsSummary.totalPointsInCirculation.toLocaleString()} ★
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Outstanding liability</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Lifetime Earned</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563EB', marginTop: '2px' }}>
                {accountsSummary.totalLifetimePointsEarned.toLocaleString()} ★
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>All-time customer rewards</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Lifetime Redeemed</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#7C3AED', marginTop: '2px' }}>
                {accountsSummary.totalLifetimePointsRedeemed.toLocaleString()} ★
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>All-time dining discounts</div>
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search customer by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              fontSize: '13px',
              background: '#ffffff',
              color: '#374151',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button
            type="button"
            onClick={() => loadAccounts()}
            disabled={accountsLoading}
            style={{
              padding: '8px 14px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              background: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            {accountsLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Accounts Table Header */}
        <div className="accounts-table-header">
          <span className="accounts-header-col">CUSTOMER</span>
          <span className="accounts-header-col">STARS BALANCE</span>
          <span className="accounts-header-col">LIFETIME ACTIVITY</span>
          <span className="accounts-header-col">TIER</span>
          <span className="accounts-header-col">STATUS · ENROLLED</span>
        </div>

        {/* Accounts Table Body */}
        {accountsLoading ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#6B7280', fontSize: '13.5px' }}>
            ⏳ Loading customer loyalty accounts...
          </div>
        ) : accountsError ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#b91c1c',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            <div>Failed to load customer accounts: {accountsError}</div>
            <button
              type="button"
              className="btn-configure-reward"
              style={{ marginTop: '10px' }}
              onClick={() => loadAccounts()}
            >
              Retry
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="accounts-empty-state">
            <div className="accounts-empty-title">
              {searchTerm ? 'No matching customer accounts' : 'No enrolled loyalty accounts yet'}
            </div>
            <div className="accounts-empty-desc">
              {searchTerm
                ? `No customer accounts matching "${searchTerm}". Try a different name or clear the filter.`
                : 'Customers automatically enroll in your rewards program when they place an order or leave a review.'}
            </div>
          </div>
        ) : (
          <div>
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <div
                  key={acc.id}
                  className="accounts-data-row"
                  id={`account-row-${acc.id}`}
                  onClick={() => setSelectedAccountId(acc.id)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(59, 130, 246, 0.06)' : undefined,
                    borderLeft: isSelected ? '3px solid #E53935' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{acc.customerName}</div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF' }}>ID: {acc.id.slice(0, 8)}...</div>
                  </div>

                  <div style={{ fontWeight: 700, color: '#D97706' }}>
                    {acc.starsBalance} ★
                  </div>

                  <div style={{ color: '#4B5563' }}>
                    {acc.lifetimeStarsEarned} earned · {acc.lifetimeStarsRedeemed} spent
                  </div>

                  <div>
                    <span
                      className={`tier-badge-pill ${
                        acc.tier.toLowerCase().includes('gold')
                          ? 'gold'
                          : acc.tier.toLowerCase().includes('silver')
                          ? 'silver'
                          : 'bronze'
                      }`}
                    >
                      {acc.tier}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`status-pill ${
                        acc.status.toLowerCase() === 'active' ? 'active' : 'inactive'
                      }`}
                    >
                      {acc.status}
                    </span>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                      Joined {new Date(acc.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #F3F4F6',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '12.5px', color: '#6B7280' }}>
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> (
              {pagination.totalCount} total accounts)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={!pagination.hasPrevPage || accountsLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  background: pagination.hasPrevPage ? '#ffffff' : '#F9FAFB',
                  color: pagination.hasPrevPage ? '#111827' : '#9CA3AF',
                  cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                ← Previous
              </button>
              <button
                type="button"
                disabled={!pagination.hasNextPage || accountsLoading}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  background: pagination.hasNextPage ? '#ffffff' : '#F9FAFB',
                  color: pagination.hasNextPage ? '#111827' : '#9CA3AF',
                  cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Configure Reward Modal (Preview Only) */}
      {showRewardModal && (
        <div className="reward-modal-backdrop" onClick={() => setShowRewardModal(false)}>
          <div className="reward-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="reward-modal-header">
              <h3>Configured Reward Tiers (Preview)</h3>
              <button
                className="reward-modal-close-btn"
                onClick={() => setShowRewardModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="reward-modal-body">
              <p>
                Customer rewards are previewed below with progressive tier thresholds:
              </p>

              <div className="reward-tier-preview-list">
                {DEFAULT_LOYALTY_PROGRAM.tiers.map((t) => (
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

              <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic', marginTop: '12px' }}>
                Note: Reward tier CRUD endpoints are planned for a subsequent integration step. Program rules and customer account ledgers above are live.
              </div>
            </div>
            <div className="reward-modal-footer">
              <button
                className="btn-configure-reward"
                style={{ backgroundColor: '#E53935', color: '#ffffff', border: 'none' }}
                onClick={() => setShowRewardModal(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
