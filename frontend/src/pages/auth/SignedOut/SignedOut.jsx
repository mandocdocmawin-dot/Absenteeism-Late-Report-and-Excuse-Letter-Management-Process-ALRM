import { Navigate } from "react-router-dom";
import { getPostLoginPath } from "@/api/authSecurity";
import SessionStatus from "@/components/SessionStatus";
import { useAuth } from "@/context/AuthContext";
import SchoolIdentityPanel from "./SchoolIdentityPanel";
import SignedOutMessage from "./SignedOutMessage";
import MobileAuthBrand from "@/components/auth/MobileAuthBrand";

export default function SignedOut() {
  const { user, loading, sessionError } = useAuth();
  if (!user && (loading || sessionError)) return <SessionStatus />;
  if (user) return <Navigate to={getPostLoginPath(user)} replace />;

  return <main className="flex min-h-svh flex-col bg-[#132351] text-slate-900 sm:grid sm:min-h-screen sm:grid-cols-[48%_52%] sm:bg-white">
    <MobileAuthBrand />
    <SchoolIdentityPanel />
    <SignedOutMessage />
  </main>;
}
