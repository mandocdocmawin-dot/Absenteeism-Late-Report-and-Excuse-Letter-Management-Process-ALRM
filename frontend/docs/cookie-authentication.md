# Cookie authentication hosted with the frontend

## Deployment

The Vercel project's root directory must be `frontend`. Deploy the complete project, including `api/gateway.js` and `server/`; publishing only the static `dist` folder will not provide authentication.

Set these **server-only** Vercel environment variables before deploying:

- `ALRM_COOKIE_SECRET`: a persistent, cryptographically random secret of at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never prefix it with `VITE_`, commit it, or put it in browser code. Use the same secret for every instance of the same deployment environment.
- `ALRM_BACKEND_ORIGIN`: `https://absenteeism-late-report-and-excuse.onrender.com` (the existing default). HTTPS is required.

No Laravel files or configuration need to change. The existing backend must continue to allow the deployed frontend origin for Google OAuth. No new OAuth callback URL is introduced. The existing `/api/auth/google/callback` path stays the same.

The old `VITE_API_URL` is no longer used by browser API calls. All API requests use the frontend's own `/api` routes.

For local development, `npm run dev` runs the same gateway through Vite. A secret in ignored `.env.local` keeps local cookies usable across restarts. Without one, development generates a process-local secret, so restarting the server requires signing in again. Development cookies are limited to localhost HTTP; production cookies always require HTTPS.

## Cookie and session guarantees

- The existing backend bearer token is exchanged on the frontend server, encrypted with AES-256-GCM, and stored in `__Host-alrm_session`. Cookie attributes are `HttpOnly; Secure; SameSite=Lax; Path=/`, with no Domain and a maximum eight-hour lifetime. Backend token expiry and revocation remain authoritative.
- The browser receives a user resource and `authenticated: true`, never the bearer token. Cookie values and server secrets never enter localStorage, sessionStorage, or browser Authorization headers.
- Existing installations must sign in once after migration. Legacy localStorage bearer tokens are removed rather than imported into the new session.
- A non-secret browser session version may coordinate tabs; it cannot authenticate a request. Startup verifies `/api/me` using the HttpOnly cookie.
- Sign-in and logout use Web Locks to serialize cookie changes across tabs in supported secure-context browsers. Older browsers retain ordering within each tab; they do not fall back to browser bearer tokens. Logout publishes an explicit expiration marker so other tabs discard pending account restoration.
- Existing `alrm_device` and `alrm_oauth` cookies pass through. Logout does not remove trusted-device status. The backend can still require OTP after trust expires, cookies are cleared, or the account/device changes.
- Logout attempts to revoke the backend token and clears the browser's session, CSRF, and anonymous-seed cookies. If Laravel is unreachable, the cookie is cleared but remote revocation cannot be confirmed; the backend's existing token expiry still applies.
- Short-lived pre-OTP identifiers and one-time exchange codes remain part of the existing OAuth/OTP flow. They are not an authenticated session and still require backend verification.

## CSRF and response handling

`GET /api/auth/csrf` returns a signed CSRF proof bound to the authenticated session ID, or to an anonymous HttpOnly seed before login. Mutations require that proof in `X-CSRF-Token`, the corresponding cookie, an exact matching Origin, and no cross-site Fetch Metadata header. The proof is held in browser memory and reset after sign-in/logout. The gateway does not automatically repeat mutations after rejection.

Only a configured HTTPS backend origin can receive forwarded API requests. Browser Authorization headers are never forwarded. Only the backend's existing trusted-device and OAuth cookies pass through, and only on auth routes. API responses are `no-store`; binary attachments are limited to supported image, PDF, CSV and Excel types. OAuth redirects are restricted to Google or the same-origin login/callback paths.

## XSS protections and limitations

Application text continues to use React's escaped rendering. Chart styles use React text with validated CSS identifiers and color tokens instead of raw HTML. No feature requires arbitrary HTML, so there is no general HTML sanitizer or HTML rendering API to bypass.

The production Content Security Policy allows scripts only from the frontend origin plus the exact hash of the static JSON-LD metadata. It blocks inline executable scripts, inline handlers, eval, foreign script origins, objects, base tags and framing. API connections stay on the frontend origin. Local fonts, image previews and downloads remain supported.

Inline **styles** are allowed because the existing component library and charts generate them. Development additionally allows Vite's inline refresh script and local WebSockets; those exceptions do not enter production. The build checks the JSON-LD hash and fails if the metadata changes without a corresponding policy update.

HttpOnly cookies reduce credential theft through JavaScript. They do not make XSS harmless: malicious code executing in the app can still act through an authenticated browser. The gateway complements safe rendering and CSP rather than replacing them.

## Verification before production use

Automated tests cover cookie flags/encryption, response redaction, CSRF rejection, origin enforcement, anonymous/session proof rotation, tampered cookies, OAuth cookie preservation, logout, upload/download forwarding and rendering injection payloads. Local browser verification uses an isolated synthetic session and never sends a real OTP.

To repeat the isolated browser check, run `node tests/browser-security-fixture.mjs` and open `http://[::1]:5176/`. The fixture uses a synthetic upstream and the actual gateway, API client and React auth provider. It does not use a real account. The IPv6 loopback host keeps its cookies separate from the usual localhost development site.

After deploying, verify a real Google/OTP sign-in, refresh, trusted-device sign-in, state-changing action, file upload/download, and logout. Confirm `__Host-alrm_session` has HttpOnly/Secure/SameSite=Lax and that API requests contain no browser bearer token. This work does not change database RLS or claim that the live database was audited.
