import { apiFetch, getSessionVersion } from './client.js';

const pendingRequests = new Map();
const resolvedUsers = new Map();
const SESSION_TIMEOUT_MS = 5000;
const SESSION_ATTEMPTS = 2;

function isRetryableSessionError(error) {
  return (
    error instanceof TypeError ||
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError'
  );
}

async function requestSessionUser(signal) {
  let lastError;

  for (let attempt = 0; attempt < SESSION_ATTEMPTS; attempt += 1) {
    try {
      return await apiFetch('/api/me', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(SESSION_TIMEOUT_MS)]),
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableSessionError(error) || attempt === SESSION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function getSessionUser() {
  const version = getSessionVersion();
  if (resolvedUsers.has(version)) return Promise.resolve(resolvedUsers.get(version));
  if (pendingRequests.has(version)) return pendingRequests.get(version).promise;
  const controller = new AbortController();

  const request = (async () => {
    const response = await requestSessionUser(controller.signal);

    if (!response.ok) {
      const error = new Error(
        response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Unable to check your session. Please try again.',
      );
      error.status = response.status;
      throw error;
    }

    const { data } = await response.json();
    if (!data?.id) throw new Error('Unable to check your session. Please try again.');
    if (version !== getSessionVersion()) throw new DOMException('This session request is no longer current.', 'AbortError');
    resolvedUsers.clear();
    resolvedUsers.set(version, data);
    return data;
  })().finally(() => pendingRequests.delete(version));

  pendingRequests.set(version, { promise: request, controller });
  return request;
}

export function clearSessionUserCache() {
  pendingRequests.forEach(({ controller }) => controller.abort());
  resolvedUsers.clear();
  pendingRequests.clear();
}
