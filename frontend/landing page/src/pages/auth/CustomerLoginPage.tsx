import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { getCustomerDashboardLoginUrl } from '../../config/authConfig';

export default function CustomerLoginPage() {
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || searchParams.get('returnTo');
  const targetLoginUrl = getCustomerDashboardLoginUrl(rawRedirect || undefined);

  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Automatically transfer to the customer dashboard's real OTP authentication flow
    if (!hasRedirected) {
      setHasRedirected(true);
      window.location.replace(targetLoginUrl);
    }
  }, [hasRedirected, targetLoginUrl]);

  return (
    <AuthLayout
      title="Access your customer account."
      subtitle="Connecting you to the authoritative customer authentication flow..."
      eyebrow="CUSTOMER ACCESS"
      showNewToLink={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <ShieldCheck size={28} style={{ color: '#54d69a' }} />
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted, #a5a6aa)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Taking you to the customer portal to verify your Indian mobile number via OTP, view
            orders, and manage loyalty points.
          </p>
        </div>

        <a
          href={targetLoginUrl}
          className="button button-red"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Continue to Customer Sign In <ArrowRight size={16} />
        </a>

        <a href="/" className="auth-back" style={{ marginTop: '4px' }}>
          ← Back to website
        </a>
      </div>
    </AuthLayout>
  );
}
