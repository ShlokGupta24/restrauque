import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Pencil, Delete } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { requestCustomerOtp } from '../../services';
import { ApiClientError } from '../../services/apiClient';
import './OtpVerificationScreen.css';

/**
 * Screen 06: OTP Verification
 * Visual reference: UIUX/06-otp-verification.png
 */
export const OtpVerificationScreen: React.FC = () => {
  const { auth, verifyAndLogin, navigateTo, goBack } = useApp();

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(28);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Format recipient phone: +91 98765 43210
  const formattedPhone = React.useMemo(() => {
    const raw = auth.phone || '9876543210';
    if (raw.length === 10) {
      return `+91 ${raw.slice(0, 5)} ${raw.slice(5)}`;
    }
    return raw.startsWith('+') ? raw : `+91 ${raw}`;
  }, [auth.phone]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResendOtp = async () => {
    if (loading) return; // Prevent duplicate submissions
    if (!auth.phone) {
      navigateTo('auth-login');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await requestCustomerOtp(auth.phone);
      const cooldownSec = res.retryAfter || 30;
      setCountdown(cooldownSec);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.code === 'TOO_MANY_REQUESTS' && typeof (err.details as any)?.retryAfter === 'number') {
          setCountdown((err.details as any).retryAfter);
        }
      } else {
        setError('Could not resend OTP. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDigitInput = useCallback(
    async (digit: string) => {
      if (loading) return; // Prevent input while verification in flight
      if (error) setError(null);

      const nextDigits = [...otpDigits];
      const targetIdx = Math.min(activeIndex, 5);
      nextDigits[targetIdx] = digit;
      setOtpDigits(nextDigits);

      if (targetIdx < 5) {
        setActiveIndex(targetIdx + 1);
      } else {
        // All 6 digits entered -> verify automatically
        const fullOtp = nextDigits.join('');
        if (fullOtp.length === 6) {
          setLoading(true);
          const res = await verifyAndLogin(fullOtp, auth.customerName);
          setLoading(false);
          if (!res.success) {
            setError(res.error || 'Invalid or expired verification code. Please check and try again.');
          }
        }
      }
    },
    [otpDigits, activeIndex, loading, error, verifyAndLogin, auth.customerName]
  );

  const handleBackspace = useCallback(() => {
    if (loading) return;
    if (error) setError(null);

    const nextDigits = [...otpDigits];
    if (nextDigits[activeIndex]) {
      nextDigits[activeIndex] = '';
      setOtpDigits(nextDigits);
    } else if (activeIndex > 0) {
      nextDigits[activeIndex - 1] = '';
      setOtpDigits(nextDigits);
      setActiveIndex(activeIndex - 1);
    }
  }, [otpDigits, activeIndex, loading, error]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigitInput(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigitInput, handleBackspace]);

  const keypadKeys = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ];

  return (
    <div className="otp-page">
      {/* Top Header Section */}
      <div className="otp-top-section">
        <button
          className="otp-back-btn"
          onClick={goBack}
          aria-label="Back to login"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="otp-header-content">
          <h1 className="otp-title">Enter OTP</h1>
          <p className="otp-subtitle">We've sent a 6-digit code to</p>

          <div
            className="phone-display-row"
            onClick={() => navigateTo('auth-login')}
            title="Edit mobile number"
          >
            <span className="phone-display-text">{formattedPhone}</span>
            <Pencil size={15} className="phone-edit-icon" />
          </div>

          {/* 6 OTP Boxes */}
          <div className="otp-boxes-container" role="group" aria-label="6 digit OTP">
            {otpDigits.map((digit, idx) => {
              const isActive = activeIndex === idx;
              const isFilled = digit !== '';
              return (
                <div
                  key={idx}
                  className={`otp-box ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
                  onClick={() => setActiveIndex(idx)}
                >
                  {digit}
                </div>
              );
            })}
          </div>

          {error && <p className="otp-error-msg">{error}</p>}

          {/* Resend Timer / Action */}
          <div className="otp-resend-container">
            {countdown > 0 ? (
              <span className="resend-text">
                Resend OTP in{' '}
                <span className="resend-timer-bold">
                  00:{countdown < 10 ? `0${countdown}` : countdown}
                </span>
              </span>
            ) : (
              <button
                className="resend-active-btn"
                onClick={handleResendOtp}
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Numerical Touch Keypad */}
      <footer className="keypad-container" aria-label="Numeric Keypad">
        <div className="keypad-grid">
          {keypadKeys.map((k) => (
            <button
              key={k.digit}
              className="keypad-btn"
              onClick={() => handleDigitInput(k.digit)}
              aria-label={k.digit}
            >
              <span className="keypad-digit">{k.digit}</span>
              {k.letters && <span className="keypad-letters">{k.letters}</span>}
            </button>
          ))}

          {/* Bottom Row */}
          <div className="keypad-empty" />

          <button
            className="keypad-btn"
            onClick={() => handleDigitInput('0')}
            aria-label="0"
          >
            <span className="keypad-digit">0</span>
          </button>

          <button
            className="keypad-backspace-btn"
            onClick={handleBackspace}
            aria-label="Backspace"
          >
            <Delete size={26} strokeWidth={1.8} />
          </button>
        </div>
      </footer>
    </div>
  );
};
