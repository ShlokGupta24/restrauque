/**
 * Configuration and URL resolver for cross-app navigation between Landing Page
 * and the authoritative Customer and Restaurant Dashboards.
 */

export function getCustomerDashboardBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_CUSTOMER_DASHBOARD_URL as string | undefined)
      : undefined;
  return (envUrl || 'http://localhost:5176').replace(/\/+$/, '');
}

export function getCustomerDashboardLoginUrl(redirect?: string): string {
  const base = getCustomerDashboardBaseUrl();
  const url = `${base}/login`;
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('://')) {
    return `${url}?redirect=${encodeURIComponent(redirect)}`;
  }
  return url;
}

export function getRestaurantDashboardUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_DASHBOARD_URL as string | undefined)
      : undefined;
  return envUrl || 'http://localhost:5174/dashboard/overview';
}
