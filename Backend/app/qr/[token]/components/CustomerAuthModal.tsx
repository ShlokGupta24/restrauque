'use client';

import React, { useState } from 'react';
import { THEME } from '../constants';
import { CustomerUser, TableContext } from '../types';

interface CustomerAuthModalProps {
  isOpen: boolean;
  table?: TableContext;
  onClose: () => void;
  onAuthSuccess: (user: CustomerUser) => void;
}

export default function CustomerAuthModal({
  isOpen,
  table,
  onClose,
  onAuthSuccess,
}: CustomerAuthModalProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Format and normalize phone number for display/input
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep only digits
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(digits);
    if (errorMessage) setErrorMessage(null);
  };

  const handleOtpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(digits);
    if (errorMessage) setErrorMessage(null);
  };

  const formattedE164Phone = phoneNumber ? `+91${phoneNumber}` : '';

  // Request OTP Handler
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const res = await fetch('/api/v1/auth/customer/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedE164Phone }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.error?.message ||
            'Unable to send verification OTP at this time. Please check your number or try again.'
        );
      }

      setStep('otp');
      setInfoMessage(
        json.data?.simulated
          ? 'Development mode: OTP was simulated in server logs.'
          : `Verification code sent to +91 ${phoneNumber}`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to request verification code.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP Handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/auth/customer/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedE164Phone,
          otp: otpCode,
          name: customerName.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json.error?.message || 'Invalid or expired OTP code. Please try again.'
        );
      }

      const verifiedUser: CustomerUser = {
        id: json.data.user.id,
        name: json.data.user.name,
        phone: json.data.user.phone,
        role: json.data.user.role,
      };

      onAuthSuccess(verifiedUser);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'OTP verification failed.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtpCode('');
    setErrorMessage(null);
    setInfoMessage(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: THEME.colors.bgPage,
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          borderTopLeftRadius: THEME.radius.xl,
          borderTopRightRadius: THEME.radius.xl,
          boxShadow: THEME.shadow.floating,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {step === 'otp' && (
              <button
                type="button"
                aria-label="Back to mobile number"
                onClick={handleBackToPhone}
                style={{
                  background: 'none',
                  border: 'none',
                  color: THEME.colors.navyPrimary,
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ←
              </button>
            )}
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: THEME.colors.navyPrimary,
                margin: 0,
              }}
            >
              {step === 'phone' ? 'Customer Verification' : 'Verify Mobile Number'}
            </h3>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: THEME.colors.bgCard,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              color: THEME.colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Table Association Note */}
        <div
          style={{
            backgroundColor: THEME.colors.bgCardSubtle,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.md,
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '12px',
            color: THEME.colors.textMain,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🍽️</span>
          <span>
            Verifying phone number {table?.tableNumber ? (
              <>to place your order at <strong>Table {table.tableNumber}</strong></>
            ) : (
              <>to verify your customer account & loyalty rewards</>
            )}
          </span>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: THEME.colors.badgeRedBg,
              border: `1px solid ${THEME.colors.badgeRed}`,
              borderRadius: THEME.radius.md,
              padding: '12px 14px',
              color: THEME.colors.badgeRed,
              fontSize: '13px',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Info Notification */}
        {infoMessage && (
          <div
            style={{
              backgroundColor: THEME.colors.navyLight,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              borderRadius: THEME.radius.md,
              padding: '10px 14px',
              color: THEME.colors.navyPrimary,
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            {infoMessage}
          </div>
        )}

        {/* STEP 1: Phone & Name Input */}
        {step === 'phone' && (
          <form onSubmit={handleRequestOtp}>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="customer-phone"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: THEME.colors.navyPrimary,
                  marginBottom: '6px',
                }}
              >
                Mobile Number
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: THEME.colors.bgCard,
                  border: `1.5px solid ${THEME.colors.borderSubtle}`,
                  borderRadius: THEME.radius.md,
                  overflow: 'hidden',
                  boxShadow: THEME.shadow.card,
                }}
              >
                <div
                  style={{
                    padding: '0 12px',
                    backgroundColor: THEME.colors.bgCardSubtle,
                    borderRight: `1px solid ${THEME.colors.borderSubtle}`,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: THEME.colors.navyPrimary,
                    height: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  id="customer-phone"
                  type="tel"
                  autoFocus
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={handlePhoneInputChange}
                  style={{
                    flex: 1,
                    height: '46px',
                    padding: '0 12px',
                    border: 'none',
                    outline: 'none',
                    fontSize: '16px',
                    color: THEME.colors.textMain,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: '11px',
                  color: THEME.colors.textMuted,
                  margin: '4px 0 0',
                }}
              >
                Enter your 10-digit mobile number for order verification.
              </p>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label
                htmlFor="customer-name"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: THEME.colors.navyPrimary,
                  marginBottom: '6px',
                }}
              >
                Your Name <span style={{ fontWeight: 400, color: THEME.colors.textMuted }}>(Optional)</span>
              </label>
              <input
                id="customer-name"
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  backgroundColor: THEME.colors.bgCard,
                  border: `1.5px solid ${THEME.colors.borderSubtle}`,
                  borderRadius: THEME.radius.md,
                  fontSize: '14px',
                  color: THEME.colors.textMain,
                  boxSizing: 'border-box',
                  outline: 'none',
                  boxShadow: THEME.shadow.card,
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || phoneNumber.length < 10}
              style={{
                width: '100%',
                height: '48px',
                backgroundColor:
                  phoneNumber.length >= 10 ? THEME.colors.navyPrimary : THEME.colors.textLight,
                color: '#ffffff',
                border: 'none',
                borderRadius: THEME.radius.md,
                fontSize: '15px',
                fontWeight: 700,
                cursor: phoneNumber.length >= 10 && !isLoading ? 'pointer' : 'not-allowed',
                boxShadow:
                  phoneNumber.length >= 10 ? '0 4px 12px rgba(23, 63, 112, 0.25)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>{isLoading ? 'Requesting OTP...' : 'Send Verification OTP'}</span>
              <span>→</span>
            </button>
          </form>
        )}

        {/* STEP 2: OTP Entry */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="otp-code"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: THEME.colors.navyPrimary,
                  marginBottom: '6px',
                }}
              >
                Enter 6-Digit Code
              </label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                placeholder="• • • • • •"
                value={otpCode}
                onChange={handleOtpInputChange}
                style={{
                  width: '100%',
                  height: '52px',
                  textAlign: 'center',
                  fontSize: '24px',
                  letterSpacing: '0.3em',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                  backgroundColor: THEME.colors.bgCard,
                  border: `1.5px solid ${THEME.colors.navyPrimary}`,
                  borderRadius: THEME.radius.md,
                  boxSizing: 'border-box',
                  outline: 'none',
                  boxShadow: THEME.shadow.card,
                }}
              />
              <p
                style={{
                  fontSize: '11px',
                  color: THEME.colors.textMuted,
                  textAlign: 'center',
                  margin: '8px 0 0',
                }}
              >
                Sent to <strong>+91 {phoneNumber}</strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              style={{
                width: '100%',
                height: '48px',
                backgroundColor:
                  otpCode.length === 6 ? THEME.colors.navyPrimary : THEME.colors.textLight,
                color: '#ffffff',
                border: 'none',
                borderRadius: THEME.radius.md,
                fontSize: '15px',
                fontWeight: 700,
                cursor: otpCode.length === 6 && !isLoading ? 'pointer' : 'not-allowed',
                boxShadow:
                  otpCode.length === 6 ? '0 4px 12px rgba(23, 63, 112, 0.25)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <span>{isLoading ? 'Verifying Code...' : 'Verify & Continue Order'}</span>
              <span>✓</span>
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleRequestOtp}
                style={{
                  background: 'none',
                  border: 'none',
                  color: THEME.colors.navyPrimary,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                Didn&apos;t receive code? Resend OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
