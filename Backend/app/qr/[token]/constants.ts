export const THEME = {
  colors: {
    bgPage: '#fbf9f5', // Warm off-white page background
    bgCard: '#ffffff',
    bgCardSubtle: '#f5f1ea',
    bgCardHighlight: '#f1ebd8',
    navyPrimary: '#173f70', // Deep navy primary buttons
    navyHover: '#11325c',
    navyLight: '#eef3fa',
    navyText: '#173f70',
    textMain: '#1e293b',
    textMuted: '#64748b',
    textLight: '#94a3b8',
    borderSubtle: '#e8e4dc', // Subtle neutral borders
    borderStrong: '#d5cfc4',
    borderFocus: '#173f70',
    successGreen: '#15803d',
    successBg: '#f0fdf4',
    badgeAmber: '#b45309',
    badgeAmberBg: '#fef3c7',
    badgeRed: '#b91c1c',
    badgeRedBg: '#fef2f2',
    accentGold: '#d97706',
  },
  radius: {
    sm: '8px',
    md: '14px',
    lg: '18px',
    xl: '22px',
    pill: '9999px',
    full: '9999px',
  },
  shadow: {
    card: '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    elevated: '0 10px 25px -5px rgba(23, 63, 112, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
    floating: '0 20px 30px -10px rgba(23, 63, 112, 0.25)',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
} as const;

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function generateCartItemId(
  productId: string,
  variantId?: string | null,
  addonIds: string[] = []
): string {
  const sortedAddons = [...addonIds].sort().join(',');
  return `${productId}:${variantId || 'base'}:${sortedAddons}`;
}
