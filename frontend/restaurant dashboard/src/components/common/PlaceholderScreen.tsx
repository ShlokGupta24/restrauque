import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlaceholderScreenProps {
  screenName: string;
  screenId: string;
  referenceImage: string;
  description: string;
}

export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  screenName,
  screenId,
  referenceImage,
  description,
}) => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: '40px 32px' }}>
        <span
          className="badge badge-preview"
          style={{ marginBottom: '16px', display: 'inline-block' }}
        >
          {screenId} · STAGE D QUEUE
        </span>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          {screenName}
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', maxWidth: '520px', margin: '0 auto 24px', lineHeight: 1.6 }}>
          {description}
        </p>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '12px',
            color: '#4b5563',
            marginBottom: '24px',
            textAlign: 'left',
          }}
        >
          <div><strong>Reference Image:</strong> <code>reference-images/{referenceImage}</code></div>
          <div style={{ marginTop: '4px' }}>
            <strong>Build Plan Order:</strong> This screen is queued to be built incrementally right after approval of the current screen.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/dashboard/overview')}
        >
          <ArrowLeft size={14} />
          <span>Return to Overview</span>
        </button>
      </div>
    </div>
  );
};
