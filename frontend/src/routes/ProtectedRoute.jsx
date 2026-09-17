// src/routes/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPendingOtpToken, getPendingOtpUserId } from '../api/otp';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const pendingOtpToken = getPendingOtpToken();
  const pendingOtpUserId = getPendingOtpUserId();

  if (pendingOtpToken || pendingOtpUserId) {
    return <Navigate to="/verify-otp" replace />;
  }

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
