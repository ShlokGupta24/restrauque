import React, { useState } from 'react';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError } from '../../services/apiClient';

export const DashboardAuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error('Password must contain uppercase, lowercase, and a number');
        }

        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() ? phone.trim() : undefined,
        });
      } else {
        await login({
          email: email.trim(),
          password,
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.details && Array.isArray(err.details)) {
          const formatted = (err.details as Array<{ field: string; message: string }>)
            .map((d) => d.message)
            .join('. ');
          setError(formatted || err.message);
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please verify credentials and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#101112',
        backgroundImage: 'radial-gradient(ellipse at 70% 15%, rgba(229, 57, 53, 0.12), transparent 45%)',
        padding: '24px',
        fontFamily: 'var(--font-family, sans-serif)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#191a1c',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.5)',
          color: '#ffffff',
        }}
      >
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'var(--brand-red, #e53935)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              R
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              restrauque<span style={{ color: 'var(--brand-red, #e53935)' }}>.</span>
            </span>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: 'var(--brand-red, #e53935)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            RESTAURANT OS
          </span>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            {isRegisterMode ? 'Register owner account' : 'Sign in to Dashboard'}
          </h1>
          <p style={{ fontSize: '13px', color: '#a5a6aa', margin: 0, lineHeight: 1.6 }}>
            {isRegisterMode
              ? 'Create your restaurant owner account to access operations.'
              : 'Enter your credentials to access your restaurant operations.'}
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(229, 57, 53, 0.12)',
              border: '1px solid rgba(229, 57, 53, 0.35)',
              color: '#ff6c64',
              fontSize: '12px',
              lineHeight: 1.5,
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegisterMode && (
            <div>
              <label
                htmlFor="dash-name"
                style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}
              >
                Owner name
              </label>
              <input
                id="dash-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Kapoor"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '9px',
                  border: '1px solid #3b3d40',
                  backgroundColor: '#111213',
                  color: '#ffffff',
                  padding: '0 14px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="dash-email"
              style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}
            >
              Email address
            </label>
            <input
              id="dash-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@restaurant.com"
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '9px',
                border: '1px solid #3b3d40',
                backgroundColor: '#111213',
                color: '#ffffff',
                padding: '0 14px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="dash-password"
              style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}
            >
              Password
            </label>
            <input
              id="dash-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegisterMode ? 'Min 8 chars, 1 uppercase, 1 number' : 'Enter password'}
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '9px',
                border: '1px solid #3b3d40',
                backgroundColor: '#111213',
                color: '#ffffff',
                padding: '0 14px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {isRegisterMode && (
            <div>
              <label
                htmlFor="dash-phone"
                style={{ display: 'block', fontSize: '12px', color: '#d8d8d8', marginBottom: '6px' }}
              >
                Phone (optional)
              </label>
              <input
                id="dash-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '9px',
                  border: '1px solid #3b3d40',
                  backgroundColor: '#111213',
                  color: '#ffffff',
                  padding: '0 14px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: '44px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--brand-red, #e53935)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              boxShadow: '0 4px 14px rgba(229, 57, 53, 0.35)',
            }}
          >
            {isSubmitting ? (
              'Authenticating...'
            ) : isRegisterMode ? (
              <>
                Register Owner <UserPlus size={16} />
              </>
            ) : (
              <>
                Sign in to Dashboard <LogIn size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#ff7770',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              marginTop: '4px',
            }}
          >
            {isRegisterMode ? 'Already have an account? Sign in' : 'New owner? Create account'}
          </button>
        </form>
      </div>
    </div>
  );
};
