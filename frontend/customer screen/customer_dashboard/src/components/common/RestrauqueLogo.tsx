import React from 'react';

interface RestrauqueLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const RestrauqueLogo: React.FC<RestrauqueLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 24,
    md: 32,
    lg: 42,
  };

  const iconPx = iconSizes[size];

  return (
    <div
      className={`restrauque-logo-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : '10px',
      }}
    >
      <div
        style={{
          width: iconPx,
          height: iconPx,
          borderRadius: '8px',
          backgroundColor: '#E53935',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(229, 57, 53, 0.25)',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: size === 'sm' ? '14px' : size === 'lg' ? '22px' : '17px',
          fontFamily: 'var(--font-family)',
        }}
        aria-hidden="true"
      >
        R
      </div>

      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: size === 'sm' ? '1.05rem' : size === 'lg' ? '1.4rem' : '1.2rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-family)',
          }}
        >
          restrauque<span style={{ color: 'var(--brand-red)' }}>.</span>
        </span>
      )}
    </div>
  );
};
