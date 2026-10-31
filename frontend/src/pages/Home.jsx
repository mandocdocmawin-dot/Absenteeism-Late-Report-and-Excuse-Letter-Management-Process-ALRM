import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { getPendingOtpToken, getPendingOtpUserId } from "@/api/otp";
import { Dashboard } from "./Dashboard";
import LandingPage from "./LandingPage";

export default function Home() {
  const { user, loading, sessionError, logoutDestination } = useAuth();
  let pendingOtp = false;
  try { pendingOtp = Boolean(getPendingOtpToken() || getPendingOtpUserId()); }
  catch { /* The public page remains available when browser storage is blocked. */ }
  // Preserve the existing root redirect and recovery flow for saved sessions.
  if (user || loading || sessionError || logoutDestination || pendingOtp) {
    return <ProtectedRoute><Dashboard /></ProtectedRoute>;
  }
  return <LandingPage />;
}
