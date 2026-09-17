const ACTIVE_SESSION_KEY = "alrm_active_session_id";
const TAB_SESSION_KEY = "alrm_tab_session_id";
const TRUSTED_DEVICE_PREFIX = "alrm_trusted_otp:";

function randomId() {
  if (crypto?.randomUUID) return crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeIdentity(identity = {}) {
  return String(identity.userId || identity.email || "").trim().toLowerCase();
}

function trustedDeviceKey(identity) {
  const normalized = normalizeIdentity(identity);

  return normalized ? `${TRUSTED_DEVICE_PREFIX}${normalized}` : null;
}

export function getTabSessionId() {
  let sessionId = sessionStorage.getItem(TAB_SESSION_KEY);

  if (!sessionId) {
    sessionId = randomId();
    sessionStorage.setItem(TAB_SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function activateBrowserSession() {
  const sessionId = getTabSessionId();
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

  return sessionId;
}

export function clearActiveBrowserSession() {
  const sessionId = sessionStorage.getItem(TAB_SESSION_KEY);

  if (sessionId && localStorage.getItem(ACTIVE_SESSION_KEY) === sessionId) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

export function isCurrentBrowserSessionActive() {
  const activeSessionId = localStorage.getItem(ACTIVE_SESSION_KEY);

  return !activeSessionId || activeSessionId === getTabSessionId();
}

export function subscribeToActiveSessionChanges(onInactive) {
  function handleStorage(event) {
    if (event.key !== ACTIVE_SESSION_KEY || !event.newValue) return;
    if (event.newValue === getTabSessionId()) return;

    onInactive?.();
  }

  window.addEventListener("storage", handleStorage);

  return () => window.removeEventListener("storage", handleStorage);
}

export function markTrustedOtpDevice(identity) {
  const key = trustedDeviceKey(identity);

  if (!key) return;

  localStorage.setItem(
    key,
    JSON.stringify({
      trustedAt: new Date().toISOString(),
    }),
  );
}

export function isTrustedOtpDevice(identity) {
  const key = trustedDeviceKey(identity);

  return Boolean(key && localStorage.getItem(key));
}

export function clearTrustedOtpDevices() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(TRUSTED_DEVICE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}
