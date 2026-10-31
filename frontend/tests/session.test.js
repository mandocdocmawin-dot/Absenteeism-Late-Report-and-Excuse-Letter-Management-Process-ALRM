import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import * as client from '../src/api/client.js';
import { getSessionUser } from '../src/api/session.js';
import { getPostLoginPath, rememberAuthenticatedPage } from '../src/api/authSecurity.js';
const user = { id: 'student-one', role: 'student', program_id: 1, school_id_number: '2026-1001', year_level: '1st Year' };
let items;
beforeEach(() => {
  items = new Map();
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key) };
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, name, { configurable: true, value: storage });
  globalThis.window = new EventTarget();
  client.resetCsrfToken?.();
});
afterEach(() => mock.restoreAll());
const csrf = () => Response.json({ success: true, data: { csrf_token: 'signed-proof' } });

test('startup purges legacy credentials without reading them', async () => {
  items.set('auth_token', 'old-secret');
  mock.method(localStorage, 'getItem', key => { assert.notEqual(key, 'auth_token'); return items.get(key) ?? null; });
  await import('../src/api/client.js?startup-purge');
  assert.equal(items.has('auth_token'), false);
});
test('cookie restoration probes without a marker and shares concurrent validation', async () => {
  const calls = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/me');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.has('Authorization'), false);
    return Response.json({ data: user });
  });
  const first = getSessionUser();
  assert.equal(getSessionUser(), first);
  assert.deepEqual(await first, user);
  assert.equal(calls.mock.callCount(), 1);
});
test('forged hints never authenticate without a successful me response', async () => {
  items.set('alrm_session_version', 'forged-hint');
  items.set('auth_token', 'forged-bearer');
  mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.has('Authorization'), false);
    return new Response('', { status: 401 });
  });
  await assert.rejects(getSessionUser(), { status: 401 });
});
test('outages preserve the version and permit retry', async () => {
  items.set('alrm_session_version', 'version-one');
  let available = false;
  mock.method(globalThis, 'fetch', async () => available ? Response.json({ data: user }) : new Response('', { status: 503 }));
  await assert.rejects(getSessionUser(), { status: 503 });
  assert.equal(items.get('alrm_session_version'), 'version-one');
  available = true;
  assert.deepEqual(await getSessionUser(), user);
});
test('safe session validation retries a transient network failure', async () => {
  let attempts = 0;
  mock.method(globalThis, 'fetch', async () => { if (++attempts === 1) throw new TypeError('offline'); return Response.json({ data: user }); });
  assert.deepEqual(await getSessionUser(), user);
  assert.equal(attempts, 2);
});
test('a stale 401 cannot erase a newer cookie login version', async () => {
  assert.equal(typeof client.markSessionChanged, 'function');
  client.markSessionChanged();
  let finish;
  mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const request = client.apiFetch('/api/me');
  const next = client.markSessionChanged();
  finish(new Response('', { status: 401 }));
  await request;
  assert.equal(client.getSessionVersion(), next);
});

test('logout publishes expiration to other tabs even when restoration started without a marker', async () => {
  const other = await import('../src/api/client.js?other-tab-logout');
  let notification;
  const unsubscribe = other.subscribeToSessionChanges(event => { notification = event; });
  const before = other.getSessionVersion();
  const next = client.clearSession();
  assert.match(items.get('alrm_session_version'), /^expired:/);
  const event = new Event('storage');
  Object.assign(event, { key: 'alrm_session_version', newValue: next });
  window.dispatchEvent(event);
  assert.equal(notification.expired, true);
  assert.notEqual(other.getSessionVersion(), before);
  assert.equal(other.getSessionVersion(), next);
  unsubscribe();
});
test('public OTP 401 never expires an existing session', async () => {
  assert.equal(typeof client.markSessionChanged, 'function');
  const version = client.markSessionChanged();
  mock.method(globalThis, 'fetch', async url => url === '/api/auth/csrf' ? csrf() : new Response('', { status: 401 }));
  assert.equal((await client.apiFetch('/api/auth/otp/verify', { method: 'POST' })).status, 401);
  assert.equal(client.getSessionVersion(), version);
});
test('unsafe API paths and caller Authorization are rejected before sending', async () => {
  const calls = mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (const path of ['https://attacker.test/api/me', '//attacker.test/api/me', '/me', '/api/../me']) await assert.rejects(client.apiFetch(path), /same-origin|API path/i);
  await assert.rejects(client.apiRequest('https://attacker.test/api/me'), /same-origin|API path/i);
  await assert.rejects(client.apiDownload('//attacker.test/file'), /same-origin|API path/i);
  await assert.rejects(client.apiFetch('/api/me', { headers: { authorization: 'Bearer forbidden' } }), /Authorization/i);
  assert.equal(calls.mock.callCount(), 0);
});
test('concurrent mutations share CSRF bootstrap and force cookie credentials', async () => {
  let release, bootstraps = 0;
  const bootstrap = new Promise(resolve => { release = resolve; });
  const methods = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.has('Authorization'), false);
    if (url === '/api/auth/csrf') { bootstraps++; return bootstrap; }
    assert.equal(options.headers.get('X-CSRF-Token'), 'signed-proof');
    methods.push(options.method);
    return Response.json({ success: true });
  });
  const pending = ['POST', 'PUT', 'PATCH', 'DELETE'].map(method => client.apiFetch('/api/requests', { method, credentials: 'omit' }));
  assert.equal(bootstraps, 1);
  release(csrf());
  await Promise.all(pending);
  assert.deepEqual(methods.sort(), ['DELETE', 'PATCH', 'POST', 'PUT']);
  await client.apiFetch('/api/requests', { method: 'POST' });
  assert.equal(bootstraps, 1);
});
test('failed shared CSRF sends no mutations and allows an explicit retry', async () => {
  let available = false;
  const paths = [];
  mock.method(globalThis, 'fetch', async url => {
    paths.push(url);
    if (url === '/api/auth/csrf') return available ? csrf() : Response.json({ message: 'Security check unavailable' }, { status: 503 });
    return Response.json({ success: true });
  });
  const failures = await Promise.allSettled(['POST', 'PATCH'].map(method => client.apiFetch('/api/requests', { method })));
  assert.ok(failures.every(result => result.status === 'rejected' && result.reason.status === 503));
  assert.deepEqual(paths, ['/api/auth/csrf']);
  available = true;
  await client.apiFetch('/api/requests', { method: 'POST' });
  assert.deepEqual(paths, ['/api/auth/csrf', '/api/auth/csrf', '/api/requests']);
});
test('malformed CSRF fails explicitly and a 403 mutation is never replayed', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: {} }));
  await assert.rejects(client.apiFetch('/api/requests', { method: 'POST' }), /CSRF|security check/i);
  let writes = 0;
  mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/csrf') return csrf();
    writes++;
    return Response.json({ message: 'Security check expired' }, { status: 403 });
  });
  await assert.rejects(client.apiRequest('/requests', { method: 'POST' }), { status: 403 });
  assert.equal(writes, 1);
});
test('exchange and logout each invalidate the CSRF cache', async () => {
  let bootstraps = 0;
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/csrf') return Response.json({ success: true, data: { csrf_token: 'proof-' + ++bootstraps } });
    assert.equal(options.headers.get('X-CSRF-Token'), 'proof-' + bootstraps);
    return Response.json({ success: true, data: { authenticated: true, user } });
  });
  await client.apiFetch('/api/auth/exchange', { method: 'POST' });
  await client.apiFetch('/api/logout', { method: 'POST' });
  await client.apiFetch('/api/requests', { method: 'POST' });
  assert.equal(bootstraps, 3);
});
test('FormData and binary retain native content types and CSRF protection', async () => {
  const form = new FormData(); form.set('proof', new Blob(['image'], { type: 'image/png' }), 'proof.png');
  const bytes = new Uint8Array([1, 2, 3]);
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/csrf') return csrf();
    assert.equal(options.headers.has('Content-Type'), false);
    assert.equal(options.headers.get('X-CSRF-Token'), 'signed-proof');
    assert.ok(options.body === form || options.body === bytes);
    return Response.json({ success: true });
  });
  await client.apiFetch('/api/evidence', { method: 'POST', body: form });
  await client.apiFetch('/api/evidence', { method: 'POST', body: bytes });
});

test('exchange and logout hold the shared browser lock through CSRF and cookie delivery', async () => {
  let queue = Promise.resolve();
  let held = false;
  const lockNames = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
    request(name, run) {
      lockNames.push(name);
      const pending = queue.then(async () => { held = true; try { return await run(); } finally { held = false; } });
      queue = pending.catch(() => {});
      return pending;
    },
  } } });
  const order = [];
  let deliverLogout;
  mock.method(globalThis, 'fetch', async url => {
    assert.equal(held, true, 'CSRF bootstrap must also hold the auth lock');
    order.push(url);
    if (url === '/api/auth/csrf') return csrf();
    if (url === '/api/logout') return new Promise(resolve => { deliverLogout = resolve; });
    return Response.json({ success: true, data: { authenticated: true, user } });
  });
  try {
    const logout = client.apiFetch('/api/logout', { method: 'POST' });
    const login = client.apiFetch('/api/auth/exchange', { method: 'POST' });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(order, ['/api/auth/csrf', '/api/logout']);
    deliverLogout(Response.json({ success: true }));
    await Promise.all([logout, login]);
    assert.deepEqual(order, ['/api/auth/csrf', '/api/logout', '/api/auth/csrf', '/api/auth/exchange']);
    assert.deepEqual(lockNames, ['alrm-auth-session', 'alrm-auth-session']);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
});

test('the fallback queue serializes exchanges and releases after failure', async () => {
  let release;
  const order = [];
  mock.method(globalThis, 'fetch', async url => {
    order.push(url);
    if (url === '/api/auth/csrf') return csrf();
    if (order.filter(path => path === '/api/auth/exchange').length === 1) return new Promise(resolve => { release = resolve; });
    return Response.json({ success: true, data: { authenticated: true, user } });
  });
  const first = client.apiFetch('/api/auth/exchange', { method: 'POST' });
  const second = client.apiFetch('/api/auth/exchange', { method: 'POST' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(order, ['/api/auth/csrf', '/api/auth/exchange']);
  release(Response.json({ message: 'Code expired' }, { status: 401 }));
  await Promise.all([first, second]);
  assert.deepEqual(order, ['/api/auth/csrf', '/api/auth/exchange', '/api/auth/csrf', '/api/auth/exchange']);
});

test('last page restores per account with its filters and fragment', () => {
  rememberAuthenticatedPage(user, '/student/records?status=valid#history');
  assert.equal(getPostLoginPath(user), '/student/records?status=valid#history');
  assert.equal(getPostLoginPath({ ...user, id: 'another-student' }), '/dashboard');
});

test('auth pages and external URLs cannot become a saved destination', () => {
  for (const path of ['https://example.com', '//example.com', '/\\example.com', '/',
    '/auth/callback?code=private', '/auth/otp', '/verify-otp', '/login', '/LOGIN/', '/complete-profile']) {
    globalThis.localStorage.setItem(`alrm_last_page:${user.id}`, path);
    assert.equal(getPostLoginPath(user), '/dashboard', path);
  }
});

test('saved navigation omits credentials and does not overwrite the last page on login', () => {
  rememberAuthenticatedPage(user, '/settings?token=private&status=saved#access_token=private');
  assert.equal(getPostLoginPath(user), '/settings?status=saved');
  rememberAuthenticatedPage(user, '/auth/callback?code=private');
  assert.equal(getPostLoginPath(user), '/settings?status=saved');
});

test('saved navigation cannot bypass login or incomplete profile setup', () => {
  rememberAuthenticatedPage(user, '/student/records');
  assert.equal(getPostLoginPath(null), '/login');
  assert.equal(getPostLoginPath({ id: user.id, role: 'student' }), '/complete-profile');
});
