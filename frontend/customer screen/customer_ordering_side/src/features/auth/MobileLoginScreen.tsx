import React, { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { RestrauqueLogo } from '../../components/RestrauqueLogo';
import { DiningIllustration } from '../../components/DiningIllustration';
import { IndiaFlagIcon } from '../../components/IndiaFlagIcon';
import './MobileLoginScreen.css';

/**
 * Screen 05: Mobile Number Login
 * Layout inspiration: UIUX/05-mobile-login.png
 * Preserves Restrauque brand palette (navy #174A82, warm ivory #FCF8ED).
 */
export const MobileLoginScreen: React.FC = () => {
  const { auth, setAuthPhone, navigateTo, goBack, screenHistory, restaurant } = useApp();
  const [phone, setPhone] = useState<string>(auth.phone || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 10 digits
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
    if (error) setError(null);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await customerDataService.requestOtp(phone);
      if (res.success) {
        setAuthPhone(phone);
        navigateTo('auth-otp');
      } else {
        setError(res.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err: any) {
      // Never expose internal raw error/database strings
      setError(err?.message || 'Network error sending OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isPhoneValid = phone.length === 10;
  const canGoBack = screenHistory.length > 1;

  return (
    <div className="mobile-login-page">
      {/* Optional Back Button (only when routed from previous screen, hidden on direct QR scan entry) */}
      {canGoBack && (
        <button
          className="login-back-btn"
          onClick={goBack}
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Brand Header */}
      <header className="login-header">
        <RestrauqueLogo size="md" />
      </header>

      {/* Main Content Area */}
      <main className="login-content">
        <div className="login-intro">
          <h1 className="login-title">Login to Continue</h1>
          <p className="login-subtitle">
            A quick OTP to get you started with great food.
          </p>
        </div>

        {/* Mobile Number Entry Form */}
        <form className="login-form" onSubmit={handleSendOtp}>
          <div className="phone-composite-box">
            <div className="country-code-pill" title="India (+91)">
              <IndiaFlagIcon width={21} height={14} />
              <span className="country-code">+91</span>
              <ChevronDown size={14} className="dropdown-arrow" />
            </div>

            <div className="composite-divider" />

            <input
              id="mobile-input"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              className="phone-number-input"
              placeholder="Enter mobile number"
              value={phone}
              onChange={handlePhoneChange}
              autoFocus
              maxLength={10}
              aria-label="Mobile phone number"
            />
          </div>

          {error && (
            <div className="login-error-badge" role="alert">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="send-otp-btn"
            disabled={!isPhoneValid || loading}
          >
            {loading ? (
              <span className="loading-spinner-wrap">
                <span className="spinner-dots" />
                Sending OTP...
              </span>
            ) : (
              'Send OTP'
            )}
          </button>
        </form>

        {/* Illustration Section */}
        <div className="login-illustration-wrap">
          <DiningIllustration />
        </div>

        {/* Table & Venue Trust Footnote */}
        <footer className="login-trust-footer">
          <p className="trust-phrase">Simple. Secure. Always with you at the table.</p>
          {restaurant?.tableLabel && (
            <p className="table-context-hint">
              Ready to order at <strong>{restaurant.tableLabel}</strong>
            </p>
          )}
        </footer>
      </main>
    </div>
  );
};
