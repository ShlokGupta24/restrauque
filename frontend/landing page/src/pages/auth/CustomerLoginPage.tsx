import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, AlertCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { authService, type SafeUser } from '../../services/authService';
import { ApiClientError } from '../../services/apiClient';

export default function CustomerLoginPage() {
  const navigate = useNavigate();

  // State for form inputs
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');

  // Step state
  const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [authenticatedCustomer, setAuthenticatedCustomer] = useState<SafeUser | null>(null);

  const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setServerMessage(null);

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.requestCustomerOtp(cleanPhone);
      setServerMessage(result.message || 'Verification code sent to your mobile number');
      setStep('otp');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const result = await authService.verifyCustomerOtp({
        phone: cleanPhone,
        otp: cleanOtp,
        name: name.trim() ? name.trim() : undefined,
      });

      setAuthenticatedCustomer(result.user);
      setStep('done');
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Verification failed. Invalid or expired OTP.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authService.logoutCustomer();
      setAuthenticatedCustomer(null);
      setPhone('');
      setOtp('');
      setName('');
      setStep('phone');
      setError(null);
      setServerMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Logout failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const title =
    step === 'done'
      ? `Welcome, ${authenticatedCustomer?.name || 'Customer'}`
      : 'Your table is waiting.';

  const subtitle =
    step === 'done'
      ? 'Your customer account and session have been verified.'
      : 'Sign in with your phone number to continue your dining experience.';

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      eyebrow="CUSTOMER ACCESS"
      showNewToLink={step !== 'done'}
    >
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(229, 57, 53, 0.12)',
            border: '1px solid rgba(229, 57, 53, 0.35)',
            color: '#ff6c64',
            fontSize: '12px',
            lineHeight: '1.5',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {step === 'done' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(84, 214, 154, 0.08)',
              border: '1px solid rgba(84, 214, 154, 0.25)',
              fontSize: '12px',
              color: '#d1fae5',
              lineHeight: '1.6',
            }}
          >
            <div style={{ fontWeight: 600, color: '#54d69a', marginBottom: '4px' }}>
              ✓ Customer Session Active
            </div>
            <div>Phone: {authenticatedCustomer?.phone}</div>
            <div>Customer ID: {authenticatedCustomer?.id}</div>
          </div>

          <button
            className="button button-red"
            type="button"
            onClick={() => navigate('/')}
          >
            Back to website <ArrowRight size={16} />
          </button>

          <button
            className="button button-outline"
            type="button"
            onClick={handleLogout}
            disabled={isLoading}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      ) : step === 'phone' ? (
        <form onSubmit={handleRequestOtp}>
          <label htmlFor="customer-name">Name (optional)</label>
          <input
            id="customer-name"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
          />

          <label htmlFor="phone">Phone number</label>
          <div className="phone-input">
            <span>+91</span>
            <input
              id="phone"
              autoComplete="tel-national"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile number"
              required
              minLength={10}
              disabled={isLoading}
            />
          </div>

          <button className="button button-red" type="submit" disabled={isLoading}>
            {isLoading ? 'Requesting OTP...' : (
              <>
                Continue with OTP <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          {serverMessage && (
            <p style={{ color: '#a5a6aa', fontSize: '11px', marginBottom: '12px' }}>
              {serverMessage} (Sent to +91 {phone})
            </p>
          )}

          <label htmlFor="otp">6-digit verification code</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit OTP"
            required
            minLength={6}
            disabled={isLoading}
          />

          <button className="button button-red" type="submit" disabled={isLoading}>
            {isLoading ? 'Verifying code...' : (
              <>
                Verify code <Check size={16} />
              </>
            )}
          </button>

          <button
            className="text-button"
            type="button"
            onClick={() => {
              setStep('phone');
              setError(null);
            }}
            disabled={isLoading}
          >
            Change phone number
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
