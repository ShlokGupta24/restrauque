import React from 'react';
import { AlertCircle, QrCode, RefreshCw } from 'lucide-react';
import { RestrauqueLogo } from '../../components/RestrauqueLogo';
import './QrErrorScreen.css';

interface QrErrorScreenProps {
  errorMessage?: string | null;
  onRetry?: () => void;
}

/**
 * Screen: QR Resolution Error / Missing Token
 * Displayed when:
 * 1. User arrives without a valid table QR token in URL/session.
 * 2. Scanned QR code is invalid, expired, inactive, or belongs to a table in maintenance.
 * 3. Network connection to the restaurant server fails.
 */
export const QrErrorScreen: React.FC<QrErrorScreenProps> = ({
  errorMessage,
  onRetry,
}) => {
  const isMissingToken = !errorMessage || errorMessage.toLowerCase().includes('no table qr');

  const title = isMissingToken
    ? 'Table QR Scan Required'
    : 'Unable to Connect to Table';

  const defaultDescription = isMissingToken
    ? 'Please scan the physical QR code located on your café table to view the menu and place your order.'
    : (errorMessage || 'The scanned QR code is invalid, expired, or inactive.');

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="qr-error-page">
      <header className="qr-error-header">
        <RestrauqueLogo size="md" />
      </header>

      <main className="qr-error-content">
        <div className="qr-error-icon-bubble" aria-hidden="true">
          {isMissingToken ? <QrCode size={40} /> : <AlertCircle size={40} />}
        </div>

        <h1 className="qr-error-title">{title}</h1>
        <p className="qr-error-description">{defaultDescription}</p>

        <div className="qr-error-advice-card">
          <div className="advice-card-title">What should I do?</div>
          <ul className="advice-list">
            <li className="advice-item">
              <span className="advice-bullet">&#8226;</span>
              <span>Find the printed or acrylic QR stand on your dining table.</span>
            </li>
            <li className="advice-item">
              <span className="advice-bullet">&#8226;</span>
              <span>Open your phone's camera or a QR scanner app to scan it again.</span>
            </li>
            <li className="advice-item">
              <span className="advice-bullet">&#8226;</span>
              <span>If your table's code isn't working, please ask our staff for assistance.</span>
            </li>
          </ul>
        </div>

        <button
          type="button"
          className="qr-retry-btn"
          onClick={handleRetry}
          aria-label="Retry QR scan"
        >
          <RefreshCw size={18} />
          <span>Try Again / Refresh</span>
        </button>
      </main>

      <footer className="qr-error-footer">
        <p>Restrauque &middot; AI-Native Caf&eacute; Intelligence Platform</p>
      </footer>
    </div>
  );
};
