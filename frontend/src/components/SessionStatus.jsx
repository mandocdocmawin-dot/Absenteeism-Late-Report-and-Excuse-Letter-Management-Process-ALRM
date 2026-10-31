import { useLocation } from 'react-router-dom';
import AuthLoading from '@/components/loading/AuthLoading';
import SessionShellSkeleton from '@/components/loading/SessionShellSkeleton';
import { useAuth } from '@/context/AuthContext';
import HttpErrorPage from '@/pages/HttpErrorPage';

export default function SessionStatus() {
  const { loading, sessionError, refreshUser } = useAuth();
  const { pathname } = useLocation();

  if (!loading) {
    return (
      <HttpErrorPage
        status={503}
        description={sessionError}
        onRetry={refreshUser}
      />
    );
  }

  const authPath = /^\/(login|verify-otp)\/*$/.test(pathname) || pathname.startsWith('/auth/');
  return authPath ? <AuthLoading label="Signing you in..." /> : <SessionShellSkeleton />;
}
