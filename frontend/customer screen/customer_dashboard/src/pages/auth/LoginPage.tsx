import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, AlertCircle } from 'lucide-react';
import { RestrauqueLogo } from '../../components/common/RestrauqueLogo';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useCustomerAuth();

  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setStep('otp');
    setOtp('123456'); // Pre-fill demo OTP
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      setError('Please enter the 4–6 digit verification code.');
      return;
    }
    setError(null);
    login(phone);
    navigate('/account');
  };

  return (
    <div className="login-page-wrap">
      <div className="login-card">
        <div className="login-header">
          <RestrauqueLogo size="md" />
          <h1 className="login-title">Customer Account Access</h1>
          <p className="login-subtitle">
            {step === 'phone'
              ? 'Enter your mobile number to view your multi-restaurant orders, reviews, and rewards.'
              : `Enter the verification code sent to +91 ${phone}`}
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
            <AlertCircle size={16} />
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
                />
              </div>
            </div>

            <div className="login-hint-box">
              <strong>Demo Account:</strong> Mobile number <code>9876543210</code> is pre-configured with dining orders from NBC Cafe and The Bhoj Family Restaurant.
            </div>

            <button type="submit" className="btn btn-primary-red btn-lg">
              <span>Continue with OTP</span>
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
                className="otp-input"
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                required
              />
            </div>

            <div className="login-hint-box">
              <strong>Demo Mode:</strong> Any 4–6 digit code advances to your account. No live SMS is transmitted.
            </div>

            <button type="submit" className="btn btn-primary-red btn-lg">
              <span>Verify & Sign In</span>
              <Check size={16} />
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep('phone');
                setError(null);
              }}
              style={{ fontSize: '13px' }}
            >
              Change mobile number
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
