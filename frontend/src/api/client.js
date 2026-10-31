// src/api/client.js
export const API_URL = "";
const SESSION_VERSION_KEY = "alrm_session_version";
const SESSION_CHANGED_EVENT = "alrm:session-changed";
let memoryVersion = null;
let csrfState = { token: null, request: null };
let authQueue = Promise.resolve();

export function purgeLegacyCredentials() {
  for (const name of ["localStorage", "sessionStorage"]) {
    try { globalThis[name]?.removeItem("auth_token"); } catch { /* Storage is optional. */ }
    try { globalThis[name]?.removeItem("pending_otp_token"); } catch { /* Obsolete bearer state. */ }
  }
}
if (typeof window !== "undefined") purgeLegacyCredentials();

export function getSessionVersion() {
  try { return localStorage.getItem(SESSION_VERSION_KEY) ?? memoryVersion; } catch { return memoryVersion; }
}

export function resetCsrfToken() {
  csrfState = { token: null, request: null };
}

function notifySessionChange(expired = false) {
  const event = new Event(SESSION_CHANGED_EVENT);
  event.expired = expired;
  globalThis.window?.dispatchEvent(event);
}

// This random marker is a notification/version only. The server cookie authenticates.
export function markSessionChanged() {
  memoryVersion = crypto.randomUUID();
  try { localStorage.setItem(SESSION_VERSION_KEY, memoryVersion); } catch { /* Sync within this tab. */ }
  resetCsrfToken();
  notifySessionChange();
  return getSessionVersion();
}

export function clearSession() {
  memoryVersion = `expired:${crypto.randomUUID()}`;
  try { localStorage.setItem(SESSION_VERSION_KEY, memoryVersion); } catch { /* Sync within this tab. */ }
  resetCsrfToken();
  notifySessionChange(true);
  return getSessionVersion();
}

// Compatibility for the existing AccessDenied action; no token is read or written.
export const clearToken = clearSession;

export function subscribeToSessionChanges(onChange) {
  function handleStorage(event) {
    if (event.key === SESSION_VERSION_KEY || event.key === null) {
      memoryVersion = event.newValue ?? null;
      resetCsrfToken();
      onChange({ expired: event.newValue == null || event.newValue.startsWith('expired:') });
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SESSION_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
  };
}

function apiPath(path, allowShorthand = false) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[\s\\]/.test(path)) {
    throw new TypeError("Requests require a same-origin API path.");
  }
  const candidate = allowShorthand && !/^\/api(?:\/|\?|$)/.test(path) ? `/api${path}` : path;
  const url = new URL(candidate, "https://alrm.invalid");
  if (url.origin !== "https://alrm.invalid" || !/^\/api(?:\/|$)/.test(url.pathname)) {
    throw new TypeError("Requests require a same-origin API path.");
  }
  return `${url.pathname}${url.search}`;
}

async function getCsrfToken() {
  const state = csrfState;
  if (state.token) return state.token;
  if (!state.request) {
    state.request = (async () => {
      const response = await fetch("/api/auth/csrf", {
        credentials: "include", redirect: "error",
        headers: new Headers({ Accept: "application/json" }),
        signal: AbortSignal.timeout(10000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || typeof payload?.data?.csrf_token !== "string" || !payload.data.csrf_token) {
        throw new ApiError(payload?.message || "Unable to complete the CSRF security check. Please try again.", response.ok ? 502 : response.status);
      }
      if (state !== csrfState) return getCsrfToken();
      state.token = payload.data.csrf_token;
      return state.token;
    })().finally(() => { state.request = null; });
  }
  return state.request;
}

export async function apiFetch(path, options = {}) {
  const url = apiPath(path);
  const headers = new Headers(options.headers);
  if (headers.has("Authorization")) throw new TypeError("Browser Authorization headers are not allowed.");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const method = (options.method || "GET").toUpperCase();
  const pathname = url.split("?")[0];
  const changesSession = method === "POST" && ["/api/auth/exchange", "/api/logout"].includes(pathname);
  const send = () => sendRequest(url, pathname, method, headers, options, changesSession);
  if (!changesSession) return send();

  const locked = () => {
    // Cookie proof must be bootstrapped after any preceding tab's cookie change.
    resetCsrfToken();
    return send();
  };
  if (globalThis.navigator?.locks?.request) return navigator.locks.request("alrm-auth-session", locked);
  // Cross-tab auth serialization requires Web Locks in a secure context.
  // Older browsers retain same-tab ordering only; never fall back to bearer auth.
  const pending = authQueue.then(locked, locked);
  authQueue = pending.catch(() => {});
  return pending;
}

async function sendRequest(url, pathname, method, headers, options, changesSession) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) headers.set("X-CSRF-Token", await getCsrfToken());
  const version = getSessionVersion();

  const res = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    redirect: "error",
    headers,
  });

  if (changesSession && res.ok) {
    res.sessionVersion = pathname === "/api/logout" ? clearSession() : markSessionChanged();
  }
  if (version === getSessionVersion()) {
    if (res.status === 401 && !pathname.startsWith("/api/auth/")) clearSession();
    if (res.status === 403) resetCsrfToken();
  }

  return res;
}

export class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function apiRequest(path, options = {}) {
  const res = await apiFetch(apiPath(path, true), options);
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json()
    : null;

  if (!res.ok) {
    throw new ApiError(
      payload?.message || "The server could not complete this request.",
      res.status,
      payload?.errors || null,
    );
  }

  return payload?.data ?? payload;
}

export async function apiDownload(path, filename = "alrm-report.xlsx") {
  const res = await apiFetch(apiPath(path, true));

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      payload?.message || "The report could not be downloaded.",
      res.status,
      payload?.errors || null,
    );
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function googleLoginUrl(options = {}) {
  // The OAuth cookie must be set on the same host that receives Google's callback.
  const url = new URL("/api/auth/google/redirect", window.location.origin);
  url.searchParams.set("origin", window.location.origin);
  if (options.prompt) url.searchParams.set("prompt", options.prompt);
  return url.toString();
}

export function clearCallbackCredentials() {
  const url = new URL(window.location.href);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(token|access_token|otp_token|verification_token|code|exchange_code|pending)$/i.test(key)) url.searchParams.delete(key);
  }
  if (/token|code|pending/i.test(url.hash)) url.hash = "";
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
