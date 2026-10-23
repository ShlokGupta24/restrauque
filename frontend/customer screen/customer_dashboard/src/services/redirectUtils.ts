/**
 * Utility functions for validating and resolving safe internal redirect targets.
 * Prevents open redirect attacks by strictly allowing internal routes starting with /account.
 */

export function resolveSafeRedirect(
  rawRedirect: string | null | undefined,
  fallback = '/account'
): string {
  if (!rawRedirect) return fallback;
  const trimmed = rawRedirect.trim();

  // Disallow protocol schemes (e.g. http:, https:, javascript:)
  // and protocol-relative URLs (//)
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('://') &&
    (trimmed === '/account' || trimmed.startsWith('/account/') || trimmed.startsWith('/account?'))
  ) {
    return trimmed;
  }

  return fallback;
}
