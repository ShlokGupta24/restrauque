import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

interface DemoNoticeBannerProps {
  message?: string;
  allowDismiss?: boolean;
}

export const DemoNoticeBanner: React.FC<DemoNoticeBannerProps> = ({
  message = 'Frontend Demo Mode: Customer profile edits, review submissions, and loyalty points are recorded in your local browser session. Production database persistence requires backend integration.',
  allowDismiss = true,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="demo-badge-bar" role="status" aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Info size={16} style={{ flexShrink: 0, color: '#b45309' }} />
        <span>
          <strong>Demo Notice:</strong> {message}
        </span>
      </div>
      {allowDismiss && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#92400e',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Dismiss notice"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
