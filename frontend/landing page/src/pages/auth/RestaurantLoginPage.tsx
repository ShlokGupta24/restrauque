import { useState, type FormEvent } from 'react';
import { ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { authService, type SafeUser } from '../../services/authService';
import { ApiClientError } from '../../services/apiClient';

export default function RestaurantLoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<SafeUser | null>(null);

  const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5174/dashboard/overview';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        // Minimal client validation matching backend schema requirements
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
        }

        const result = await authService.registerOwner({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() ? phone.trim() : undefined,
        });

        setAuthenticatedUser(result.user);
        setTimeout(() => {
          window.location.href = dashboardUrl;
        }, 800);
      } else {
        const result = await authService.loginOwner({
          email: email.trim(),
          password,
        });

        setAuthenticatedUser(result.user);
        setTimeout(() => {
          window.location.href = dashboardUrl;
        }, 800);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.details && Array.isArray(err.details)) {
          const fieldErrors = (err.details as Array<{ field: string; message: string }>)
            .map((d) => d.message)
            .join('. ');
          setError(fieldErrors || err.message);
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication request failed. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const title = authenticatedUser
    ? `Welcome, ${authenticatedUser.name}`
    : isRegisterMode
    ? 'Create owner account.'
    : 'Welcome back.';

  const subtitle = authenticatedUser
    ? 'Authentication verified. Redirecting to your dashboard...'
    : isRegisterMode
    ? 'Register as a restaurant owner to configure your branches and menu.'
    : 'Sign in to manage your restaurant operations and intelligence.';

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      eyebrow="RESTAURANT ACCESS"
      showNewToLink={!authenticatedUser}
    >
      {authenticatedUser ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: '#54d69a', fontSize: '13px', marginBottom: '18px' }}>
            ✓ Verified as {authenticatedUser.role} ({authenticatedUser.email})
          </p>
          <a href={dashboardUrl} className="button button-red">
            Go to dashboard <ArrowRight size={16} />
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
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

          {isRegisterMode && (
            <>
              <label htmlFor="owner-name">Full name</label>
              <input
                id="owner-name"
                type="text"
                autoComplete="name"
                placeholder="Aarav Kapoor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </>
          )}

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="owner@restaurant.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
            placeholder={isRegisterMode ? 'Min 8 chars, 1 uppercase, 1 number' : 'Enter password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          {isRegisterMode && (
            <>
              <label htmlFor="phone">Phone number (optional)</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
            </>
          )}

          <button className="button button-red" type="submit" disabled={isLoading}>
            {isLoading ? (
              'Processing...'
            ) : isRegisterMode ? (
              <>
                Create owner account <UserPlus size={16} />
              </>
            ) : (
              <>
                Sign in <LogIn size={16} />
              </>
            )}
          </button>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError(null);
            }}
            disabled={isLoading}
          >
            {isRegisterMode
              ? 'Already registered? Sign in instead'
              : 'New owner? Register your account'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
