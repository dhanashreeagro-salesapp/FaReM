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

  // 2. API URL check (Test backend has 'test' e.g. farem-test.onrender.com)
  const apiUrl = (import.meta.env.VITE_API_URL || '').toLowerCase();
  if (apiUrl.includes('test') || apiUrl.includes('staging')) {
    return true;
  }

  // 3. Hostname check (test domain, main branch previews, or local dev)
  const hostname = (window.location.hostname || '').toLowerCase();
  if (
    hostname.includes('testagriamigo') ||
    hostname.includes('-git-main-') ||
    hostname.includes('preview') ||
    hostname.includes('test') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    return true;
  }

  return false;
}
