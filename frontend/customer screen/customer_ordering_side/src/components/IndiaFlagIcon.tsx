import React from 'react';

export const IndiaFlagIcon: React.FC<{ width?: number; height?: number }> = ({
  width = 20,
  height = 14,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }}
      aria-label="India Flag"
    >
      <rect width="30" height="20" rx="2" fill="#FFFFFF" />
      {/* Saffron Top Stripe */}
      <rect width="30" height="6.67" fill="#FF9933" />
      {/* White Middle Stripe */}
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      {/* Green Bottom Stripe */}
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      {/* Ashoka Chakra */}
      <circle cx="15" cy="10" r="2.5" stroke="#000080" strokeWidth="0.8" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
};
