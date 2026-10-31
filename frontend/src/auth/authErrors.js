export const authErrorMessages = {
  invalid_domain:
    "This Google account is not authorized to access this system. Please sign in using an authorized LV account.",
  oauth_failed:
    "Google sign in reached the backend, but the backend could not complete the OAuth exchange. Check the Google OAuth settings on Render.",
  google_access_denied:
    "Google denied access before ALRM could read your email. Make sure this OAuth app allows the staff Workspace/domain, or add your staff account as an allowed test user.",
  google_invalid_client:
    "Google rejected the OAuth client. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Render, then redeploy or clear Laravel config cache.",
  google_invalid_grant:
    "Google rejected the login code. Check that GOOGLE_REDIRECT_URI on Render exactly matches the authorized redirect URI in Google Cloud Console.",
  google_redirect_mismatch:
    "Google rejected the callback URL. Add the backend callback URL to Google Cloud Console authorized redirect URIs.",
  missing_token:
    "The login callback did not include a session token.",
  google_code_on_frontend:
    "Google returned an authorization code to the frontend. The Google redirect URI should point to the backend callback instead.",
  session_failed: "Your session could not be loaded after sign in.",
  session_expired: "Your session expired. Please sign in again.",
};

export function getAuthErrorMessage(code, fallback = "") {
  if (!code) return fallback;
  return authErrorMessages[code] || fallback || "Authentication could not be completed.";
}
