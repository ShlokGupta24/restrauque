import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, AlertCircle, RotateCw } from 'lucide-react';
import { RestrauqueLogo } from '../../components/common/RestrauqueLogo';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { isValidIndianPhone } from '../../services/authService';
import { ApiClientError } from '../../services/apiClient';
import { resolveSafeRedirect } from '../../services/redirectUtils';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || searchParams.get('returnTo');
  const targetRedirect = resolveSafeRedirect(rawRedirect);

  const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
  const websiteUrl = meta?.env?.VITE_MAIN_WEBSITE_URL
    ? String(meta.env.VITE_MAIN_WEBSITE_URL).replace(/\/+$/, '')
    : 'http://localhost:5173';

  const { status, isAuthenticated, requestOtp, verifyOtp } = useCustomerAuth();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // If already authenticated, redirect to target
  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetRedirect, { replace: true });
    }
  }, [isAuthenticated, navigate, targetRedirect]);

  // Resend cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, '');
    if (!isValidIndianPhone(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (name.trim() && name.trim().length < 2) {
      setError('Full Name must be at least 2 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await requestOtp(cleanPhone);
      setStep('otp');
      const cooldownSec =
        response.retryAfter ||
        (response.expiresInSeconds ? Math.min(response.expiresInSeconds, 60) : 60);
      setResendCooldown(cooldownSec);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 429) {
          const retrySec =
            err.details && typeof err.details === 'object' && 'retryAfter' in err.details
              ? Number((err.details as Record<string, unknown>).retryAfter) || 60
              : 60;
          setResendCooldown(retrySec);
          setError(
            `Too many requests. Please wait ${retrySec} seconds before requesting a new OTP.`
          );
        } else {
          setError(
            err.message || 'Failed to request OTP. Please check your connection and try again.'
          );
        }
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone, cleanOtp, name.trim() || undefined);
      navigate(targetRedirect, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 400 || err.status === 401) {
          setError(err.message || 'Invalid or expired OTP. Please check the code and try again.');
        } else if (err.status === 429) {
          setError('Too many failed verification attempts. Please wait before trying again.');
        } else {
          setError(err.message || 'OTP verification failed. Please try again.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);

    try {
      const response = await requestOtp(phone);
      const cooldownSec =
        response.retryAfter ||
        (response.expiresInSeconds ? Math.min(response.expiresInSeconds, 60) : 60);
      setResendCooldown(cooldownSec);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 429) {
          const retrySec =
            err.details && typeof err.details === 'object' && 'retryAfter' in err.details
              ? Number((err.details as Record<string, unknown>).retryAfter) || 60
              : 60;
          setResendCooldown(retrySec);
          setError(`Please wait ${retrySec} seconds before resending.`);
        } else {
          setError(err.message || 'Failed to resend OTP.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to resend OTP.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="login-page-wrap">
        <div className="login-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <RestrauqueLogo size="md" />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Checking existing customer session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page-wrap">
      <div className="login-card">
        <div className="login-header">
          <RestrauqueLogo size="md" />
          <h1 className="login-title">Customer Account Access</h1>
          <p className="login-subtitle">
            {step === 'phone'
              ? 'Enter your mobile number to view your multi-restaurant orders, reviews, and rewards.'
              : `Enter the 6-digit verification code sent to +91 ${phone}`}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form className="login-form" onSubmit={handlePhoneSubmit}>
            <div className="login-input-group">
              <label htmlFor="customer-phone" className="login-label">
                Mobile Number
              </label>
              <div className="phone-input-wrap">
                <span className="phone-prefix">+91</span>
                <input
                  id="customer-phone"
                  type="tel"
                  className="phone-input"
                  placeholder="10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="customer-name" className="login-label">
                Full Name{' '}
                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                  (Optional for existing accounts)
                </span>
              </label>
              <input
                id="customer-name"
                type="text"
                className="text-input"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary-red btn-lg"
              disabled={loading || phone.length !== 10}
            >
              <span>{loading ? 'Sending OTP...' : 'Continue with OTP'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleOtpSubmit}>
            <div className="login-input-group">
              <label htmlFor="customer-otp" className="login-label">
                One-Time Password (OTP)
              </label>
              <input
                id="customer-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="otp-input"
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary-red btn-lg"
              disabled={loading || otp.length !== 6}
            >
              <span>{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
              <Check size={16} />
            </button>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                  setOtp('');
                }}
                disabled={loading}
                style={{ fontSize: '13px' }}
              >
                Change mobile number
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResendOtp}
                disabled={loading || resendCooldown > 0}
                style={{
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: resendCooldown > 0 ? 0.6 : 1,
                }}
              >
                <RotateCw size={13} />
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </span>
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <a
            href={websiteUrl}
            style={{
              color: 'var(--text-muted, #71717a)',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Back to website
          </a>
        </div>
      </div>
    </div>
  );
};
