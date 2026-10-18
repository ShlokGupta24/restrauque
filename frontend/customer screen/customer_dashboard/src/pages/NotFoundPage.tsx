import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { RestrauqueLogo } from '../components/common/RestrauqueLogo';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <RestrauqueLogo size="md" />
      </div>

      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--brand-red-light)',
          color: 'var(--brand-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <AlertCircle size={32} />
      </div>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}
      >
        Page Not Found
      </h1>

      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          maxWidth: '400px',
          marginBottom: '24px',
          lineHeight: 1.5,
        }}
      >
        The page you are looking for does not exist or may have been moved. Return to your customer dashboard.
      </p>

      <button
        type="button"
        className="btn btn-primary-red"
        onClick={() => navigate('/account')}
      >
        <ArrowLeft size={16} />
        <span>Return to Dashboard</span>
      </button>
    </div>
  );
};
