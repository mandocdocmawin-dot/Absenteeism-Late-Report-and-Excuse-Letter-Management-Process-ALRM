// src/pages/AuthCallback.jsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    if (!code) {
      setError('Missing auth code.');
      return;
    }

    async function exchange() {
      try {
        const res = await apiFetch('/api/auth/exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        if (!res.ok) throw new Error('Exchange failed');
        const { data } = await res.json();
        await loginWithToken(data.token);
        navigate('/', { replace: true });
      } catch {
        setError('Login failed. Please try again.');
      }
    }

    exchange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div>
        <p>{error}</p>
        <a href="/login">Back to login</a>
      </div>
    );
  }

  return <p>Signing you in...</p>;
}