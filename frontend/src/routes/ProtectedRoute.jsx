// src/routes/ProtectedRoute.jsx
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import SessionStatus from '../components/SessionStatus';
import { getPostLoginPath, rememberAuthenticatedPage } from '../api/authSecurity';
import { useAuth } from '../context/AuthContext';
import { getPendingOtpToken, getPendingOtpUserId } from '../api/otp';
import { needsProfileSetup } from '../lib/profileSetup';
import { roleMatches } from '../lib/roles';
import { usePreviewRole } from '../hooks/usePreviewRole';
import HttpErrorPage from '../pages/HttpErrorPage';
import ProgramHeadAccess from './ProgramHeadAccess';

function AuthenticatedPage({ user, children }) {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    rememberAuthenticatedPage(user, `${pathname}${search}${hash}`);
  }, [user, pathname, search, hash]);
  return children;
}

export function ProtectedRoute({
  allowedIncompleteProfile = false,
  allowedRoles,
  children,
}) {
  const { user, loading, sessionError, logoutDestination } = useAuth();
  const location = useLocation();
  const pendingOtpToken = getPendingOtpToken();
  const pendingOtpUserId = getPendingOtpUserId();
  const { activeRole } = usePreviewRole(user);

  if (!user && logoutDestination) return <Navigate to={logoutDestination} replace />;
  if (!user && (loading || sessionError)) return <SessionStatus />;

  if (!user && (pendingOtpToken || pendingOtpUserId)) {
    return <Navigate to="/verify-otp" replace />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!allowedIncompleteProfile && needsProfileSetup(user)) {
    return <Navigate to="/complete-profile" replace />;
  }
  if (allowedRoles?.length && !roleMatches(activeRole, allowedRoles)) {
    if (roleMatches(user.role, ['instructor']) && roleMatches('program', allowedRoles)) {
      return <ProgramHeadAccess><AuthenticatedPage user={user}>{children}</AuthenticatedPage></ProgramHeadAccess>;
    }
    return <HttpErrorPage status={403} />;
  }

  if (location.pathname === '/') {
    return <Navigate to={getPostLoginPath(user)} replace />;
  }

  return <AuthenticatedPage user={user}>{children}</AuthenticatedPage>;
}
