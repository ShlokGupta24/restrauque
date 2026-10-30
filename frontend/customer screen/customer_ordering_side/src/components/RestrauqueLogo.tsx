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
    md: 36,
    lg: 48,
  };

  const iconPx = iconSizes[size];

  return (
    <div className={`restrauque-logo-badge ${size} ${className}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size === 'sm' ? '8px' : '10px',
    }}>
      <div
        style={{
          width: iconPx,
          height: iconPx,
          borderRadius: '50%',
          backgroundColor: '#EBF2F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid #D9E4EE',
          boxShadow: '0 2px 6px rgba(23, 74, 130, 0.08)',
        }}
        aria-hidden="true"
      >
        <svg
          width={Math.round(iconPx * 0.65)}
          height={Math.round(iconPx * 0.65)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylized Restrauque blossom/tulip in navy brand color */}
          <path
            d="M12 2C12 2 13.5 6 13.5 8.5C13.5 9.5 12.8 10.3 12 10.5C11.2 10.3 10.5 9.5 10.5 8.5C10.5 6 12 2 12 2Z"
            fill="var(--brand-primary, #174A82)"
          />
          <path
            d="M6.5 7C7.5 7 10 9.5 10 12.5C10 15.5 8 18 8 18C8 18 5 15.5 5 12.5C5 9.5 6.5 7 6.5 7Z"
            fill="var(--brand-primary, #174A82)"
          />
          <path
            d="M17.5 7C16.5 7 14 9.5 14 12.5C14 15.5 16 18 16 18C16 18 19 15.5 19 12.5C19 9.5 17.5 7 17.5 7Z"
            fill="var(--brand-primary, #174A82)"
          />
          <path
            d="M12 12V22"
            stroke="var(--brand-primary, #174A82)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: size === 'sm' ? '1.05rem' : size === 'lg' ? '1.45rem' : '1.25rem',
            color: 'var(--text-color, #20201E)',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-family)',
          }}
        >
          Restrauque
        </span>
      )}
    </div>
  );
};
