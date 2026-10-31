import { apiFetch, apiRequest, ApiError, clearSession, googleLoginUrl } from "./client.js";

export function startGoogleLogin() {
  clearSession();
  window.location.assign(googleLoginUrl());
}

export function getCurrentUser() {
  return apiRequest("/me");
}

export async function logout() {
  const response = await apiFetch("/api/logout", { method: "POST", signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.message || "Unable to sign out. Please try again.", response.status, payload?.errors);
  }
  return response.sessionVersion;
}
