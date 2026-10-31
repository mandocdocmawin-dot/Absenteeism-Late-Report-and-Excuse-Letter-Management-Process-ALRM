// Hash of the static JSON-LD with LF line endings, enforced by the Vite plugin.
const METADATA_HASH = "'sha256-GyHYrxAs3/PRQBmEHSWVMpWHWhzrAzQHQvtBd7OU2Ro='";

export function contentSecurityPolicy({ development = false } = {}) {
  return [
    "default-src 'none'",
    `script-src 'self' ${development ? "'unsafe-inline'" : METADATA_HASH}`,
    "script-src-attr 'none'",
    // Base UI, Recharts and React use runtime style elements and style properties.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? ' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*' : ''}`,
    "object-src 'none'", "base-uri 'none'", "frame-src 'none'",
    "frame-ancestors 'none'", "form-action 'self'", "manifest-src 'self'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function securityHeaders(options) {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}
