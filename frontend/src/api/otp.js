import { apiFetch } from "./client.js";
import { assertValidInputs } from "../lib/inputValidation.js";

const PENDING_TOKEN_KEY = "pending_otp_token";
const PENDING_EMAIL_KEY = "pending_otp_email";
const PENDING_USER_ID_KEY = "pending_otp_user_id";
const PENDING_LOGIN_KEY = "pending_otp_login";
const PENDING_EXPIRES_KEY = "pending_otp_expires_at";
const PENDING_LIFETIME_MS = 10 * 60 * 1000;

async function expectJson(res) {
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success !== true) {
    const error = new Error(body?.message || (res.status === 404
      ? "The backend OTP verification route was not found."
      : "The server did not confirm the OTP request."));
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
}

function store(key, value) {
  if (value) sessionStorage.setItem(key, value);
  else sessionStorage.removeItem(key);
}

function readPending(key) {
  try {
    const expiry = Number(sessionStorage.getItem(PENDING_EXPIRES_KEY));
    if (!expiry || expiry <= Date.now() || expiry > Date.now() + PENDING_LIFETIME_MS) {
      clearPendingOtp();
      return null;
    }
    return sessionStorage.getItem(key);
  } catch { return null; }
}

// Kept only for existing route guards; pending bearer tokens are obsolete.
export function getPendingOtpToken() {
  try { sessionStorage.removeItem(PENDING_TOKEN_KEY); } catch { /* No pending credential. */ }
  return null;
}
export function getPendingOtpEmail() { return readPending(PENDING_EMAIL_KEY); }
export function getPendingOtpUserId() { return readPending(PENDING_USER_ID_KEY); }
export function getPendingLogin() { return readPending(PENDING_LOGIN_KEY); }

export function setPendingLogin(pending) {
  if (pending && getPendingLogin() !== pending) sessionStorage.setItem(PENDING_EXPIRES_KEY, String(Date.now() + PENDING_LIFETIME_MS));
  store(PENDING_LOGIN_KEY, pending);
}
export function clearPendingOtp() {
  for (const key of [PENDING_TOKEN_KEY, PENDING_EMAIL_KEY, PENDING_USER_ID_KEY, PENDING_LOGIN_KEY, PENDING_EXPIRES_KEY]) {
    try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
  }
}
export function setPendingOtpSession({ email, userId }) {
  getPendingOtpToken();
  store(PENDING_EMAIL_KEY, email);
  store(PENDING_USER_ID_KEY, userId);
}

export function getExchangeCodeFromResponse(response) {
  return (
    response?.data?.exchange_code ||
    response?.data?.code ||
    response?.exchange_code ||
    response?.code ||
    null
  );
}

export function getOtpWaitSeconds(payload, fallbackSeconds = 0) {
  const data = payload?.body?.data || payload?.data || payload?.body || payload;
  const seconds = Number(
    data?.resend_after ?? data?.retry_after ?? data?.expires_in,
  );

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }

  return fallbackSeconds;
}

export async function exchangeOtpCode(exchangeCode) {
  const res = await apiFetch("/api/auth/exchange", {
    method: "POST",
    body: JSON.stringify({ code: exchangeCode, exchange_code: exchangeCode }),
  });
  const response = await expectJson(res);
  if (response.data?.authenticated !== true || !response.data.user?.id) {
    throw new Error("The server did not confirm your cookie sign-in.");
  }
  return { ...response, sessionVersion: res.sessionVersion };
}

export async function checkTrustedDevice({ pending }) {
  return expectJson(await apiFetch("/api/auth/otp/check-trusted", {
    method: "POST", body: JSON.stringify({ pending }),
  }));
}

export async function sendOtp({ userId, email, pending }) {
  return expectJson(await apiFetch("/api/auth/otp/resend", {
    method: "POST", body: JSON.stringify({ user_id: userId, email, pending }),
  }));
}

export async function verifyOtp({ userId, email, code, pending }) {
  assertValidInputs({ code: typeof code === 'string' && /^\d{6}$/.test(code) ? '' : 'Enter the six-digit verification code.' });
  return expectJson(await apiFetch("/api/auth/otp/verify", {
    method: "POST", body: JSON.stringify({ user_id: userId, email, pending, otp: code, code, otp_code: code }),
  }));
}
