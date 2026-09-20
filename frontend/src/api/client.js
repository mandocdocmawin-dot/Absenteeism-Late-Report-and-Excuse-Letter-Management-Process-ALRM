// src/api/client.js
export const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem('auth_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: options.credentials || 'include',
    headers,
  });

  if (res.status === 401) {
    // token is invalid/expired — clear it so the app falls back to login
    setToken(null);
  }

  return res;
}

export function googleLoginUrl(options = {}) {
  const url = new URL(`${API_URL}/api/auth/google/redirect`);

  if (options.prompt) {
    url.searchParams.set('prompt', options.prompt);
  }

  return url.toString();
}
