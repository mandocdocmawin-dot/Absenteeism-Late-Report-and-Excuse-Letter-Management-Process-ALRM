// src/pages/AuthCallback.jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAccountVerified, isTrustedOtpDevice } from '../api/authSecurity';
import { API_URL, apiFetch, setToken } from '../api/client';
import { setPendingOtpSession } from '../api/otp';
import { useAuth } from '../context/AuthContext';
import { needsProfileSetup } from '../lib/profileSetup';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function prepareVerification() {
      const oauthError = searchParams.get('error');
      if (oauthError) {
        setError('Login failed. Please use your official LV email account.');
        return;
      }

      const token =
        searchParams.get('token') ||
        searchParams.get('otp_token') ||
        searchParams.get('verification_token');
      const email = searchParams.get('email');

      async function continueWithToken(nextToken, fallbackEmail) {
        const user = await loadUserFromToken(nextToken);
        const identity = {
          userId: user?.id,
          email: user?.email || fallbackEmail,
        };

        if (isAccountVerified(user) || isTrustedOtpDevice(identity)) {
          const verifiedUser = await loginWithToken(nextToken);
          navigate(
            needsProfileSetup(verifiedUser) ? '/complete-profile' : '/',
            { replace: true },
          );
          return;
        }

        setToken(null);
        setPendingOtpSession({
          token: nextToken,
          email: identity.email,
          userId: identity.userId,
        });
        navigate('/verify-otp', { replace: true });
      }

      if (token) {
        await continueWithToken(token, email);
        return;
      }

      const code = searchParams.get('code');
      if (!code) {
        setError('Missing login token.');
        return;
      }

      try {
        const res = await apiFetch('/api/auth/exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        if (!res.ok) throw new Error('Exchange failed');
        const { data } = await res.json();
        const exchangedToken = data.token || data.access_token;

        if (!exchangedToken) throw new Error('Missing exchanged token');

        await continueWithToken(exchangedToken, data.email || data.user?.email);
      } catch {
        setError('Login failed. Please try again.');
      }
    }

    prepareVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6 text-center text-slate-950">
        <div className="grid gap-4">
          <p>{error}</p>
          <a className="font-semibold text-[#0b4bd3]" href="/login">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-white text-slate-950">
      <p>Preparing verification...</p>
    </div>
  );
}

async function loadUserFromToken(token) {
  try {
    const res = await fetch(`${API_URL}/api/me`, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const { data } = await res.json();
    return data;
  } catch {
    return null;
  }
}
