import { needsProfileSetup } from '../lib/profileSetup.js';

const LAST_PAGE_PREFIX = 'alrm_last_page:';
const AUTH_PATHS = ['/login', '/signed-out', '/auth/callback', '/auth/otp', '/verify-otp', '/complete-profile'];

function safePage(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;

  try {
    const url = new URL(path, 'https://alrm.invalid');
    if (url.origin !== 'https://alrm.invalid' || url.pathname === '/' ||
        AUTH_PATHS.includes(url.pathname.replace(/\/+$/, '').toLowerCase())) return null;

    // Authentication credentials must never be included in a saved location.
    for (const key of [...url.searchParams.keys()]) {
      if (/token|code|password|secret/i.test(key)) url.searchParams.delete(key);
    }
    if (/token|code|password|secret/i.test(url.hash)) url.hash = '';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function rememberAuthenticatedPage(user, path) {
  const page = safePage(path);
  if (!user?.id || !page) return;
  try {
    localStorage.setItem(`${LAST_PAGE_PREFIX}${user.id}`, page);
  } catch {
    // Page restoration is optional when browser storage is unavailable.
  }
}

export function getPostLoginPath(user) {
  if (!user?.id) return '/login';
  if (needsProfileSetup(user)) return '/complete-profile';

  try {
    return safePage(localStorage.getItem(`${LAST_PAGE_PREFIX}${user.id}`)) || '/dashboard';
  } catch {
    return '/dashboard';
  }
}
