import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          marginBottom: '16px',
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          maxWidth: '440px',
          marginBottom: actionText ? '20px' : '0',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      {actionText && onAction && (
        <button type="button" className="btn btn-primary-red" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};
