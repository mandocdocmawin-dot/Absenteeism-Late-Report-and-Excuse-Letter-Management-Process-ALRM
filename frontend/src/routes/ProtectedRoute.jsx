// src/routes/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPendingOtpToken, getPendingOtpUserId } from '../api/otp';
import { needsProfileSetup } from '../lib/profileSetup';
import { roleMatches } from '../lib/roles';

export function ProtectedRoute({
  allowedIncompleteProfile = false,
  allowedRoles,
  children,
}) {
  const { user, loading } = useAuth();
  const pendingOtpToken = getPendingOtpToken();
  const pendingOtpUserId = getPendingOtpUserId();

  if (pendingOtpToken || pendingOtpUserId) {
    return <Navigate to="/verify-otp" replace />;
  }

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedIncompleteProfile && needsProfileSetup(user)) {
    return <Navigate to="/complete-profile" replace />;
  }
  if (allowedRoles?.length && !roleMatches(user.role, allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
