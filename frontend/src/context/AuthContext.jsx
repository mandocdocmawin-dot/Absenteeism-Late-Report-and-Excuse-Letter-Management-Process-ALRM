import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSessionVersion, purgeLegacyCredentials, subscribeToSessionChanges } from '../api/client';
import { logout as logoutRequest } from '../api/auth';
import { clearPendingOtp } from '../api/otp';
import { getSessionUser } from '../api/session';
import { clearSessionUserCache } from '../api/session';
import { clearResourceCache } from '../api/resourceCache';
import { clearPageViewState } from '../hooks/usePageViewState';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ version: null, user: null, error: '', loading: true });
  const requestVersion = useRef(0);
  const [logoutDestination, setLogoutDestination] = useState(null);

  const loadUser = useCallback(({ silent = false } = {}) => {
    const version = getSessionVersion();
    const request = ++requestVersion.current;
    setSession(current => ({ version, user: current.version === version ? current.user : null,
      error: '', loading: !silent || !current.user }));
    return getSessionUser().then(user => {
      if (version !== getSessionVersion() || request !== requestVersion.current) return null;
      clearPendingOtp();
      setSession({ version, user, error: '', loading: false });
      return user;
    }, error => {
      if (version === getSessionVersion() && request === requestVersion.current) {
        setSession(current => ({ version, user: error.status === 401 ? null : current.user,
          error: error.status === 401 ? '' : 'We could not reach your account. Please try again.', loading: false }));
      }
      return null;
    });
  }, []);

  useEffect(() => {
    purgeLegacyCredentials();
    const unsubscribe = subscribeToSessionChanges(event => {
      clearSessionUserCache();
      clearResourceCache();
      clearPageViewState();
      if (event.expired) {
        requestVersion.current += 1;
        setSession({ version: getSessionVersion(), user: null, error: '', loading: false });
      } else {
        setLogoutDestination(null);
        loadUser();
      }
    });
    loadUser();
    return () => { unsubscribe(); requestVersion.current += 1; };
  }, [loadUser]);

  async function completeCookieLogin(response) {
    if (response?.data?.authenticated !== true || !response.data.user?.id) {
      throw new Error('The server did not confirm your cookie sign-in.');
    }
    if (response.sessionVersion !== getSessionVersion()) throw new Error('This sign-in was replaced by a newer session.');
    setLogoutDestination(null);
    const user = await loadUser();
    if (!user) throw new Error('Unable to confirm your session. Please try again.');
    return user;
  }

  async function logout({ redirectToSignedOut = false } = {}) {
    const request = ++requestVersion.current;
    setLogoutDestination(redirectToSignedOut ? '/signed-out' : null);
    setSession(current => ({ ...current, loading: true, error: '' }));
    try {
      const version = await logoutRequest();
      if (version !== getSessionVersion()) return;
      requestVersion.current += 1;
      clearSessionUserCache();
      clearResourceCache();
      clearPageViewState();
      clearPendingOtp();
      setLogoutDestination(redirectToSignedOut ? '/signed-out' : null);
      setSession({ version, user: null, error: '', loading: false });
    } catch (error) {
      if (request === requestVersion.current) {
        setLogoutDestination(null);
        setSession(current => ({ ...current, error: error.message || 'Unable to sign out. Please try again.', loading: false }));
      }
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user: session.user, loading: session.loading, sessionError: session.error,
      logoutDestination, completeCookieLogin, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
