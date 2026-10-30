import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Coins,
  Coffee,
  UtensilsCrossed,
  Sparkles,
  ArrowRight,
  History,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  fetchCustomerLoyaltyWallets,
  CustomerDetailedWallet,
} from '../../services/loyaltyService';
import { ApiClientError } from '../../services/apiClient';
import { LoadingState } from '../../components/common/LoadingState';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './LoyaltyPointsPage.css';

function formatTxnDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const LoyaltyPointsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantFilter = searchParams.get('restaurant') || '';
  const { dataVersion } = useCustomerAuth();

  const [wallets, setWallets] = useState<CustomerDetailedWallet[]>([]);
  const [totalInformationalPoints, setTotalInformationalPoints] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadWallets = useCallback(async (showLoadingSpinner: boolean = true) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (showLoadingSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetchCustomerLoyaltyWallets(controller.signal);
      setWallets(result.wallets);
      setTotalInformationalPoints(result.totalInformationalPoints);
      setLoading(false);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setLoading(false);

      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setError('Your session has expired. Please sign in to view your loyalty points.');
        } else {
          setError(err.message || 'Unable to retrieve your loyalty wallets.');
        }
      } else {
        setError('Unable to reach the server. Please check your internet connection.');
      }
    }
  }, []);

  // Live balance refresh on component mount, URL change, or when dataVersion changes (e.g. feedback submission)
  useEffect(() => {
    loadWallets(true);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadWallets, dataVersion]);

  // Optional filter if navigated with ?restaurant=...
  const displayedWallets = restaurantFilter
    ? wallets.filter(
        (w) =>
          w.restaurantId === restaurantFilter ||
          w.restaurantName.toLowerCase().includes(restaurantFilter.toLowerCase())
      )
    : wallets;

  return (
    <div className="loyalty-page-shell">
      {/* Header */}
      <header className="loyalty-header">
        <h1 className="loyalty-title">Loyalty Points</h1>
        <p className="loyalty-subtitle">
          Track your dining points, review bonuses, and redeemable balance across partner restaurants.
        </p>
      </header>

      {/* Recoverable Error Card */}
      {error && !loading && (
        <div className="loyalty-error-card" role="alert">
          <div className="loyalty-error-icon">
            <AlertCircle size={26} />
          </div>
          <div className="loyalty-error-content">
            <h3 className="loyalty-error-title">Unable to load loyalty wallets</h3>
            <p className="loyalty-error-message">{error}</p>
          </div>
          <button
            type="button"
            className="loyalty-retry-btn"
            onClick={() => loadWallets(true)}
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loyalty-loading-wrap">
          <LoadingState message="Retrieving your restaurant loyalty balances..." />
        </div>
      )}

      {/* ================= COMBINED INFORMATIONAL TOTAL ================= */}
      {!loading && !error && wallets.length > 0 && (
        <section className="loyalty-summary-banner" aria-label="Combined Points Summary">
          <div className="banner-left">
            <div className="banner-icon-wrap">
              <Coins size={28} />
            </div>
            <div>
              <span className="banner-label">Combined Informational Balance</span>
              <div className="banner-points-row">
                <span className="banner-points-number">{totalInformationalPoints}</span>
                <span className="banner-points-unit">total points</span>
              </div>
            </div>
          </div>

          <div className="banner-right">
            <div className="informational-disclaimer-pill">
              <Info size={14} className="info-icon" />
              <span>Informational total only</span>
            </div>
            <p className="disclaimer-text">
              Points are maintained separately for each restaurant and cannot be pooled, transferred, or cross-spent between venues.
            </p>
          </div>
        </section>
      )}

      {/* ================= EMPTY WALLETS STATE ================= */}
      {!loading && !error && wallets.length === 0 && (
        <div className="loyalty-empty-card">
          <div className="loyalty-empty-icon-wrap">
            <Coins size={28} />
          </div>
          <h2 className="loyalty-empty-title">No loyalty wallets yet</h2>
          <p className="loyalty-empty-desc">
            When you dine at partner restaurants and place orders or leave verified reviews, your separate restaurant loyalty wallets and points will appear here.
          </p>
        </div>
      )}

      {/* ================= RESTAURANT LOYALTY WALLETS GRID ================= */}
      {!loading && !error && displayedWallets.length > 0 && (
        <section className="wallets-grid" aria-label="Restaurant Loyalty Wallets">
          {displayedWallets.map((wallet) => {
            const isCafe = wallet.restaurantName.toLowerCase().includes('cafe') || wallet.restaurantName.toLowerCase().includes('coffee');
            const recentTxns = wallet.recentTransactions || [];

            return (
              <div key={wallet.accountId} className="restaurant-wallet-card">
                {/* Top Bar */}
                <div className="wallet-card-header">
                  <div className="wallet-brand-group">
                    <div
                      className="wallet-avatar"
                      style={{
                        background: isCafe ? '#e0f2fe' : '#fef3c7',
                        color: isCafe ? '#0369a1' : '#92400e',
                      }}
                    >
                      {isCafe ? <Coffee size={24} /> : <UtensilsCrossed size={24} />}
                    </div>
                    <div>
                      <h2 className="wallet-restaurant-name">{wallet.restaurantName}</h2>
                      <div
                        className="wallet-tier-pill"
                        style={{
                          background: isCafe ? '#e0f2fe' : '#fef3c7',
                          color: isCafe ? '#0369a1' : '#92400e',
                        }}
                      >
                        {wallet.tier ? `${wallet.tier.charAt(0).toUpperCase() + wallet.tier.slice(1)} Member` : 'Member'}
                      </div>
                    </div>
                  </div>

                  <div className="wallet-balance-box">
                    <span className="balance-label">Available Points</span>
                    <span className="balance-number">{wallet.starsBalance}</span>
                  </div>
                </div>

                {/* Review Earning Notice */}
                <div className="wallet-earning-highlight">
                  <Sparkles size={15} className="sparkle-gold" />
                  <span>Earn loyalty points on verified reviews for completed orders</span>
                </div>

                {/* Transparent Redemption Notice */}
                <div className="wallet-redemption-info">
                  <CheckCircle2 size={16} className="wallet-redemption-icon" />
                  <span>
                    <strong>Redemption Policy:</strong> Redeemable on your bill during Table QR Checkout at {wallet.restaurantName} (Min. 20 points, up to 50% discount).
                  </span>
                </div>

                {/* Lifetime Accounting Stats */}
                <div className="wallet-lifetime-row">
                  <div className="lifetime-stat">
                    <span className="lifetime-stat-label">Lifetime Earned:</span>
                    <span className="lifetime-stat-val">+{wallet.lifetimeStarsEarned}</span>
                  </div>
                  <div className="lifetime-stat">
                    <span className="lifetime-stat-label">Lifetime Redeemed:</span>
                    <span className="lifetime-stat-val">-{wallet.lifetimeStarsRedeemed}</span>
                  </div>
                </div>

                {/* Compact Transactions Section */}
                <div className="wallet-transactions-section">
                  <div className="transactions-header">
                    <History size={14} />
                    <span>Recent Points Activity</span>
                  </div>

                  <div className="transactions-list">
                    {recentTxns.length === 0 ? (
                      <div className="no-transactions">No recent activity recorded</div>
                    ) : (
                      recentTxns.slice(0, 3).map((txn) => {
                        const isPositive = txn.stars > 0;

                        return (
                          <div key={txn.id} className="transaction-item">
                            <div className="txn-desc-col">
                              <span className="txn-desc">
                                {txn.description || (isPositive ? 'Earned stars' : 'Redeemed stars')}
                              </span>
                              <span className="txn-date">{formatTxnDate(txn.createdAt)}</span>
                            </div>
                            <span className={`txn-points ${isPositive ? 'positive' : 'negative'}`}>
                              {isPositive ? `+${txn.stars}` : txn.stars} pts
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="wallet-card-footer">
                  <button
                    type="button"
                    className="wallet-footer-btn"
                    onClick={() =>
                      navigate(
                        `/account/feedback?restaurant=${encodeURIComponent(
                          wallet.restaurantId
                        )}`
                      )
                    }
                  >
                    <span>Review {wallet.restaurantName} Orders to Earn Points</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};
