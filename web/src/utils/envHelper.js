/**
 * Dynamic Environment Helper
 * Determines if the current runtime is a test/staging environment.
 * Automatically enables test branding and sky-blue/royal-indigo styling.
 * Guaranteed dormant in production.
 */
export function isTestEnvironment() {
  if (typeof window === 'undefined') return false;

  // 1. Explicit VITE_APP_ENV check
  const appEnv = (import.meta.env.VITE_APP_ENV || '').toLowerCase().trim();
  if (appEnv === 'test' || appEnv === 'staging') return true;
  if (appEnv === 'production' || appEnv === 'prod') return false;

  // 2. Hostname check
  const hostname = (window.location.hostname || '').toLowerCase();
  if (
    hostname.includes('testagriamigo') ||
    hostname.includes('test') ||
    hostname.includes('vercel.app') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1')
  ) {
    return true;
  }

  // 3. API URL check
  const apiUrl = (import.meta.env.VITE_API_URL || '').toLowerCase();
  if (apiUrl.includes('farem-test') || apiUrl.includes('test')) {
    return true;
  }

  return false;
}
