# HttpOnly Authentication and XSS Hardening Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Work only under frontend/. Do not commit or edit backend/.

**Goal:** Keep Laravel's current OAuth, OTP, and bearer API contract while removing authentication credentials from browser JavaScript and adding CSRF and CSP protection.

**Architecture:** A same-origin Node server function deployed with the frontend exchanges the existing one-time login code, stores the resulting backend token in a host-only HttpOnly cookie, removes it from the JSON response, and forwards authenticated API calls. The same handler runs in Vite through a development adapter. The Laravel backend is read-only and unchanged. The browser uses credentials and a CSRF header rather than Authorization. Existing non-sensitive preferences remain local.

**Tech Stack:** React, Vite, Vercel Node functions, Node built-in crypto and fetch; no new dependencies.

## Constraints and review focus

- Production cookies: HttpOnly, Secure, SameSite=Lax, Path=/, no Domain; __Host- prefix. Local HTTP uses explicitly separate development names.
- CSRF: signed double-submit token bound to the session or an HttpOnly anonymous seed, custom request header, exact Origin validation, and cross-site Fetch Metadata rejection for mutations. Secrets never enter a VITE_ variable.
- Preserve OAuth redirect/state and trusted-device cookies, OTP, multipart uploads, binary downloads, status codes, and private no-store responses.
- Reject external API destinations, path traversal, caller-supplied Authorization, unexpected redirects, malformed login responses, and oversized bodies. No token in URLs, storage, or browser response JSON.
- Stale failures cannot clear a newer session; logout and authentication failures cannot clear unrelated cookie state.
- CSP blocks foreign scripts, inline executable scripts and handlers, eval, framing and objects. Styles needed by the existing component library are explicitly permitted. Existing static JSON-LD uses a hash.
- First deployment requires one fresh sign-in for existing bearer-token sessions. Deployment and real Google OTP verification are separate from local automated verification.

## Tasks

- [x] 1. Write and run failing gateway security tests; implement cookie/CSRF proxy and Node adapters.
- [x] 2. Write and run browser-client session and CSRF tests; migrate OAuth/OTP/session restoration to cookie authentication and remove browser token persistence.
- [x] 3. Harden chart rendering against HTML/CSS injection; add regression tests.
- [x] 4. Apply production CSP/security headers and development-safe policy; preserve metadata and navigation.
- [x] 5. Run targeted checks, complete test suite and build; browser-verify with isolated responses; request independent security review and fix findings.
- [x] 6. Document deployment configuration, browser-cookie guarantees and remaining live verification limits.

## Verification results

- All 378 tests passed with `node --test --test-concurrency=4 tests/*.test.js`.
- `npm run build` passed, including validation of emitted inline metadata against CSP. Existing bundle-size warnings remain.
- ESLint passed for every changed or added JavaScript/JSX file.
- Isolated browser checks passed for cookie exchange, no browser bearer storage, HttpOnly visibility, reload restoration, protected mutations, CSRF rejection, CSP injection rejection, React session restoration and logout (including anonymous logout).
- Independent read-only review confirmed the final logout and cross-tab restoration fixes; no blocking issue remained in the reviewed changes.
- Live Google/OTP and deployed Vercel verification are pending deployment. Backend files and Git state were not mutated by this implementation.

## Decisions

- User requires actual HttpOnly cookies without changes to backend/. Implement the server boundary within frontend/ rather than enabling unsupported Laravel session mode.
- Authentication state in React is confirmed by /api/me. Any browser marker is non-secret synchronization state and never authority.
- Use a server-only cookie signing secret; production fails closed with an actionable configuration error when missing. Local development may use one process-local random secret.
