import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  Coffee,
  UtensilsCrossed,
  Sparkles,
  ArrowRight,
  History,
  Info,
} from 'lucide-react';
import { customerDashboardService } from '../../services/CustomerDashboardService';
import { DemoNoticeBanner } from '../../components/common/DemoNoticeBanner';
import './LoyaltyPointsPage.css';

export const LoyaltyPointsPage: React.FC = () => {
  const navigate = useNavigate();

  const metrics = customerDashboardService.getDashboardMetrics();
  const wallets = customerDashboardService.getLoyaltyWallets();

  const nbcWallet = wallets.find((w) => w.restaurantId === 'res_nbc');
  const bhojWallet = wallets.find((w) => w.restaurantId === 'res_bhoj');

  return (
    <div className="loyalty-page-shell">
      <DemoNoticeBanner />

      {/* Header */}
      <header className="loyalty-header">
        <h1 className="loyalty-title">Loyalty Points</h1>
        <p className="loyalty-subtitle">
          Track your dining points and verified review bonuses across partner restaurants.
        </p>
      </header>

      {/* ================= COMBINED INFORMATIONAL TOTAL ================= */}
      <section className="loyalty-summary-banner" aria-label="Combined Points Summary">
        <div className="banner-left">
          <div className="banner-icon-wrap">
            <Coins size={28} />
          </div>
          <div>
            <span className="banner-label">Combined Demo Balance</span>
            <div className="banner-points-row">
              <span className="banner-points-number">{metrics.totalLoyaltyPoints}</span>
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

      {/* ================= TWO RESTAURANT LOYALTY CARDS ================= */}
      <section className="wallets-grid" aria-label="Restaurant Loyalty Wallets">
        {/* Card 1: NBC Cafe */}
        {nbcWallet && (
          <div className="restaurant-wallet-card">
            {/* Top Bar */}
            <div className="wallet-card-header">
              <div className="wallet-brand-group">
                <div
                  className="wallet-avatar"
                  style={{ background: '#e0f2fe', color: '#0369a1' }}
                >
                  <Coffee size={24} />
                </div>
                <div>
                  <h2 className="wallet-restaurant-name">NBC Cafe</h2>
                  <div className="wallet-tier-pill" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                    {nbcWallet.tier}
                  </div>
                </div>
              </div>

              <div className="wallet-balance-box">
                <span className="balance-label">Available Points</span>
                <span className="balance-number">{nbcWallet.availablePoints}</span>
              </div>
            </div>

            {/* Review Earning Notice */}
            <div className="wallet-earning-highlight">
              <Sparkles size={15} className="sparkle-gold" />
              <span>Earn <strong>+50 pts</strong> for every completed visit you review</span>
            </div>

            {/* Compact Earning History */}
            <div className="wallet-transactions-section">
              <div className="transactions-header">
                <History size={14} />
                <span>Recent Points Activity</span>
              </div>

              <div className="transactions-list">
                {nbcWallet.transactions.length === 0 ? (
                  <div className="no-transactions">No recent activity</div>
                ) : (
                  nbcWallet.transactions.slice(0, 3).map((txn) => (
                    <div key={txn.id} className="transaction-item">
                      <div className="txn-desc-col">
                        <span className="txn-desc">{txn.description}</span>
                        <span className="txn-date">{txn.date}</span>
                      </div>
                      <span className={`txn-points ${txn.points > 0 ? 'positive' : 'negative'}`}>
                        {txn.points > 0 ? `+${txn.points}` : txn.points} pts
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="wallet-card-footer">
              <button
                type="button"
                className="wallet-footer-btn"
                onClick={() => navigate('/account/feedback?restaurant=res_nbc')}
              >
                <span>Review NBC Orders to Earn Points</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Card 2: The Bhoj Family Restaurant */}
        {bhojWallet && (
          <div className="restaurant-wallet-card">
            {/* Top Bar */}
            <div className="wallet-card-header">
              <div className="wallet-brand-group">
                <div
                  className="wallet-avatar"
                  style={{ background: '#fef3c7', color: '#92400e' }}
                >
                  <UtensilsCrossed size={24} />
                </div>
                <div>
                  <h2 className="wallet-restaurant-name">The Bhoj Family Restaurant</h2>
                  <div className="wallet-tier-pill" style={{ background: '#fef3c7', color: '#92400e' }}>
                    {bhojWallet.tier}
                  </div>
                </div>
              </div>

              <div className="wallet-balance-box">
                <span className="balance-label">Available Points</span>
                <span className="balance-number">{bhojWallet.availablePoints}</span>
              </div>
            </div>

            {/* Review Earning Notice */}
            <div className="wallet-earning-highlight">
              <Sparkles size={15} className="sparkle-gold" />
              <span>Earn <strong>+50 pts</strong> for every completed visit you review</span>
            </div>

            {/* Compact Earning History */}
            <div className="wallet-transactions-section">
              <div className="transactions-header">
                <History size={14} />
                <span>Recent Points Activity</span>
              </div>

              <div className="transactions-list">
                {bhojWallet.transactions.length === 0 ? (
                  <div className="no-transactions">No recent activity</div>
                ) : (
                  bhojWallet.transactions.slice(0, 3).map((txn) => (
                    <div key={txn.id} className="transaction-item">
                      <div className="txn-desc-col">
                        <span className="txn-desc">{txn.description}</span>
                        <span className="txn-date">{txn.date}</span>
                      </div>
                      <span className={`txn-points ${txn.points > 0 ? 'positive' : 'negative'}`}>
                        {txn.points > 0 ? `+${txn.points}` : txn.points} pts
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="wallet-card-footer">
              <button
                type="button"
                className="wallet-footer-btn"
                onClick={() => navigate('/account/feedback?restaurant=res_bhoj')}
              >
                <span>Review The Bhoj Orders to Earn Points</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
