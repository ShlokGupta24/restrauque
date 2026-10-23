import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
  showLabel?: boolean;
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  readonly = false,
  size = 20,
  showLabel = false,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : value;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
      role={readonly ? 'img' : 'radiogroup'}
      aria-label={`Rating: ${value} of 5 stars`}
    >
      <div style={{ display: 'inline-flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating;

          return (
            <button
              key={star}
              type="button"
              disabled={readonly}
              onClick={() => onChange && onChange(star)}
              onMouseEnter={() => !readonly && setHoverRating(star)}
              onMouseLeave={() => !readonly && setHoverRating(null)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: readonly ? 'default' : 'pointer',
                color: isFilled ? '#EAB308' : '#D1D5DB',
                transition: 'transform 0.1s ease, color 0.1s ease',
                transform: !readonly && hoverRating === star ? 'scale(1.2)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-checked={star === value}
              role={readonly ? undefined : 'radio'}
              aria-label={`${star} Star${star > 1 ? 's' : ''}`}
            >
              <Star
                size={size}
                fill={isFilled ? '#EAB308' : 'transparent'}
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </div>

      {showLabel && (
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            minWidth: '65px',
          }}
        >
          {RATING_LABELS[displayRating] || ''}
        </span>
      )}
    </div>
  );
};
