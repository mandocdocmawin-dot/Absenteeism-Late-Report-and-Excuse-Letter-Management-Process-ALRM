import { API_URL } from "./client";

const PENDING_TOKEN_KEY = "pending_otp_token";
const PENDING_EMAIL_KEY = "pending_otp_email";
const PENDING_USER_ID_KEY = "pending_otp_user_id";
const EXCHANGE_ENDPOINT = "/api/auth/exchange";
const RESEND_ENDPOINT = "/api/auth/otp/resend";
const VERIFY_ENDPOINT = "/api/auth/otp/verify";

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function expectJson(res) {
  const body = await readJson(res);

  if (!res.ok) {
    const message =
      body?.message ||
      (res.status === 404
        ? "The backend OTP verification route was not found."
        : `OTP request failed with status ${res.status}.`);

    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body;
}

function otpHeaders(token) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function setPendingOtpToken(token) {
  if (token) {
    sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(PENDING_TOKEN_KEY);
  }
}

export function getPendingOtpToken() {
  return sessionStorage.getItem(PENDING_TOKEN_KEY);
}

export function setPendingOtpEmail(email) {
  if (email) {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } else {
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
  }
}

export function getPendingOtpEmail() {
  return sessionStorage.getItem(PENDING_EMAIL_KEY);
}

export function setPendingOtpUserId(userId) {
  if (userId) {
    sessionStorage.setItem(PENDING_USER_ID_KEY, userId);
  } else {
    sessionStorage.removeItem(PENDING_USER_ID_KEY);
  }
}

export function getPendingOtpUserId() {
  return sessionStorage.getItem(PENDING_USER_ID_KEY);
}

export function clearPendingOtp() {
  setPendingOtpToken(null);
  setPendingOtpEmail(null);
  setPendingOtpUserId(null);
}

export function setPendingOtpSession({ token, email, userId }) {
  setPendingOtpToken(token);
  setPendingOtpEmail(email);
  setPendingOtpUserId(userId);
}

export function getOtpTokenFromResponse(response, fallbackToken) {
  return (
    response?.data?.token ||
    response?.data?.access_token ||
    response?.data?.plainTextToken ||
    response?.token ||
    response?.access_token ||
    fallbackToken
  );
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
  const res = await fetch(`${API_URL}${EXCHANGE_ENDPOINT}`, {
    method: "POST",
    credentials: "include",
    headers: otpHeaders(),
    body: JSON.stringify({
      code: exchangeCode,
      exchange_code: exchangeCode,
    }),
  });

  return expectJson(res);
}

export async function sendOtp({ token, userId, email }) {
  const res = await fetch(`${API_URL}${RESEND_ENDPOINT}`, {
    method: "POST",
    credentials: "include",
    headers: otpHeaders(token),
    body: JSON.stringify({
      token,
      user_id: userId,
      email,
    }),
  });

  return expectJson(res);
}

export async function verifyOtp({ token, userId, email, code }) {
  const res = await fetch(`${API_URL}${VERIFY_ENDPOINT}`, {
    method: "POST",
    credentials: "include",
    headers: otpHeaders(token),
    body: JSON.stringify({
      token,
      user_id: userId,
      email,
      otp: code,
      code,
      otp_code: code,
    }),
  });

  return expectJson(res);
}
