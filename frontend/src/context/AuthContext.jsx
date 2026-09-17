// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, setToken } from '../api/client';
import {
  activateBrowserSession,
  clearActiveBrowserSession,
  clearTrustedOtpDevices,
  isCurrentBrowserSessionActive,
  subscribeToActiveSessionChanges,
} from '../api/authSecurity';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (!isCurrentBrowserSessionActive()) {
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await apiFetch('/api/me');
      if (res.ok) {
        const { data } = await res.json();
        setUser(data);
        return data;
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }

    return null;
  }

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    return subscribeToActiveSessionChanges(() => {
      if (!isCurrentBrowserSessionActive()) {
        setToken(null);
        setUser(null);
      }
    });
  }, []);

  async function loginWithToken(token) {
    setToken(token);
    activateBrowserSession();
    return await loadUser();
  }

  async function logout() {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout — clear local state regardless
    }
    setToken(null);
    setUser(null);
    clearActiveBrowserSession();
    clearTrustedOtpDevices();
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
