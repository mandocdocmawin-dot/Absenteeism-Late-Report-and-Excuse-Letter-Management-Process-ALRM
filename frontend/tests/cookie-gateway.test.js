import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleGateway } from '../server/authGateway.js';

const origin = 'https://alrm.example';
const secret = 'test-only-cookie-secret-with-at-least-32-characters';
const token = '42|private-backend-token';
const options = { secret, backendOrigin: 'https://backend.example', production: true };
const request = (path, init = {}) => new Request(`${origin}/api/${path}`, init);
function remember(jar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0];
    const at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
}
const cookies = jar => [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
async function csrf(jar) {
  const response = await handleGateway(request('auth/csrf', { headers: { cookie: cookies(jar) } }), options);
  assert.equal(response.status, 200);
  remember(jar, response);
  return (await response.json()).data.csrf_token;
}
async function login(jar = new Map()) {
  const proof = await csrf(jar);
  const response = await handleGateway(request('auth/exchange', { method: 'POST', headers: { cookie: cookies(jar), origin, 'x-csrf-token': proof, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'one-time-code' }) }), {
    ...options, fetch: async () => Response.json({ success: true, data: { token, user: { id: 'one', role: 'student' } } }),
  });
  assert.equal(response.status, 200);
  remember(jar, response);
  return { jar, response };
}

test('exchange stores an encrypted HttpOnly host cookie and never returns the bearer token', async () => {
  const { response } = await login();
  const headers = response.headers.getSetCookie();
  const session = headers.find(value => value.startsWith('__Host-alrm_session='));
  assert.ok(session);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=28800']) assert.ok(session.includes(flag));
  assert.doesNotMatch(session, /Domain=|private-backend-token/);
  const body = await response.text();
  assert.doesNotMatch(body, /private-backend-token|"token"/);
  assert.equal(JSON.parse(body).data.authenticated, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('authenticated requests use the cookie server-side and reject caller bearer credentials', async () => {
  const { jar } = await login();
  let calls = 0;
  const fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://backend.example/api/me');
    assert.equal(init.headers.get('authorization'), `Bearer ${token}`);
    assert.equal(init.headers.get('cookie'), null);
    return Response.json({ data: { id: 'one' } });
  };
  const response = await handleGateway(request('me', { headers: { cookie: cookies(jar) } }), { ...options, fetch });
  assert.equal(response.status, 200);
  const forged = await handleGateway(request('me', { headers: { authorization: 'Bearer attacker' } }), { ...options, fetch });
  assert.equal(forged.status, 401);
  assert.equal(calls, 1);
});

test('mutations reject absent, tampered, cross-session and cross-origin CSRF proofs before contacting Laravel', async () => {
  const { jar } = await login();
  const proof = await csrf(jar);
  const other = await login();
  for (const headers of [
    { cookie: cookies(jar), origin },
    { cookie: cookies(jar), origin, 'x-csrf-token': `${proof}x` },
    { cookie: cookies(jar), origin: 'https://evil.example', 'x-csrf-token': proof },
    { cookie: cookies(jar), origin, 'sec-fetch-site': 'cross-site', 'x-csrf-token': proof },
    { cookie: cookies(other.jar), origin, 'x-csrf-token': proof },
  ]) {
    const response = await handleGateway(request('requests', { method: 'POST', headers }), { ...options, fetch: () => { throw new Error('CSRF bypass'); } });
    assert.equal(response.status, 403);
  }
});

test('multipart bodies and binary downloads survive the gateway unchanged', async () => {
  const { jar } = await login();
  const proof = await csrf(jar);
  const bytes = new Uint8Array([0, 255, 10, 13, 2]);
  const response = await handleGateway(request('requests/evidence', { method: 'POST', headers: { cookie: cookies(jar), origin, 'x-csrf-token': proof, 'content-type': 'multipart/form-data; boundary=sample' }, body: bytes }), {
    ...options, fetch: async (_url, init) => {
      assert.deepEqual(new Uint8Array(init.body), bytes);
      assert.equal(init.headers.get('content-type'), 'multipart/form-data; boundary=sample');
      return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="evidence.pdf"' } });
    },
  });
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="evidence.pdf"');
});

test('trusted-device cookies survive OAuth and logout clears only the session cookies', async () => {
  const response = await handleGateway(request('auth/google/redirect?origin=https%3A%2F%2Falrm.example', { headers: { cookie: 'alrm_device=trusted; secret=do-not-forward' } }), {
    ...options, fetch: async (_url, init) => {
      assert.equal(init.headers.get('cookie'), 'alrm_device=trusted');
      return new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/o/oauth2/auth', 'set-cookie': 'alrm_oauth=nonce; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax' } });
    },
  });
  assert.equal(response.status, 302);
  assert.match(response.headers.getSetCookie()[0], /alrm_oauth=nonce/);
  const { jar } = await login();
  const proof = await csrf(jar);
  const logout = await handleGateway(request('logout', { method: 'POST', headers: { cookie: cookies(jar), origin, 'x-csrf-token': proof } }), { ...options, fetch: async () => { throw new Error('offline'); } });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.getSetCookie().some(value => value.includes('Max-Age=0')));
  assert.ok(logout.headers.getSetCookie().every(value => !value.startsWith('alrm_device=')));
});

test('guest OTP recovery can log out idempotently after CSRF validation without contacting Laravel', async () => {
  const jar = new Map([['__Host-alrm_session', 'corrupt']]);
  const proof = await csrf(jar);
  const response = await handleGateway(request('logout', { method: 'POST', headers: { cookie: cookies(jar), origin, 'x-csrf-token': proof } }), {
    ...options, fetch: () => { throw new Error('No bearer exists to revoke'); },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.revoked, true);
  assert.equal(response.headers.getSetCookie().length, 3);
  assert.ok(response.headers.getSetCookie().every(value => value.includes('Max-Age=0')));
  assert.equal((await handleGateway(request('logout', { method: 'POST', headers: { origin } }), options)).status, 403);
});

test('the real backend OTP callback routes are accepted for trusted and new devices', async () => {
  for (const query of ['exchange_code=one-time-code', 'user_id=one&pending=short-lived-proof&checked=1']) {
    const location = `${origin}/auth/otp?${query}`;
    const response = await handleGateway(request('auth/google/callback?code=google-code'), { ...options, fetch: async () => new Response(null, { status: 302, headers: { location } }) });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), location);
  }
});

test('HEAD JSON responses stay bodyless and client IPs come only from trusted adapter metadata', async () => {
  const { jar } = await login();
  const response = await handleGateway(request('me', { method: 'HEAD', headers: { cookie: cookies(jar), 'x-forwarded-for': 'attacker' } }), { ...options, clientIp: '203.0.113.7', fetch: async (_url, init) => {
    assert.equal(init.headers.get('x-forwarded-for'), '203.0.113.7');
    return new Response(null, { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});

test('misconfiguration, invalid paths, tampered cookies and unexpected redirects fail closed', async () => {
  const noSecret = await handleGateway(request('me'), { ...options, secret: '' });
  assert.equal(noSecret.status, 503);
  const badCookie = await handleGateway(request('me', { headers: { cookie: '__Host-alrm_session=v1.forged' } }), options);
  assert.equal(badCookie.status, 401);
  const badPath = await handleGateway(request('gateway?__alrm_path=https%3A%2F%2Fevil.example'), options);
  assert.equal(badPath.status, 400);
  const redirect = await handleGateway(request('auth/google/redirect'), { ...options, fetch: async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }) });
  assert.equal(redirect.status, 502);
});

test('corrupt anonymous seed cookies are repaired before the browser submits a CSRF proof', async () => {
  const jar = new Map([['__Host-alrm_seed', 'malformed']]);
  const proof = await csrf(jar);
  assert.match(jar.get('__Host-alrm_seed'), /^[a-f0-9]{64}$/);
  const response = await handleGateway(request('auth/exchange', { method: 'POST', headers: { cookie: cookies(jar), origin, 'x-csrf-token': proof }, body: '{}' }), { ...options, fetch: async () => Response.json({ success: false }, { status: 422 }) });
  assert.equal(response.status, 422);
});

test('oversized chunked uploads are stopped without trusting Content-Length', async () => {
  const { jar } = await login();
  const proof = await csrf(jar);
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3 * 1024 * 1024 + 1)); controller.close(); } });
  const response = await handleGateway(request('requests/evidence', { method: 'POST', headers: { cookie: cookies(jar), origin, 'x-csrf-token': proof }, body, duplex: 'half' }), { ...options, fetch: () => { throw new Error('Oversized upload reached the backend'); } });
  assert.equal(response.status, 413);
});

test('the rewritten function URL preserves filters without permitting an external upstream', async () => {
  const { jar } = await login();
  const response = await handleGateway(request('gateway?__alrm_path=instructor%2Frequests&type=late&page=2', { headers: { cookie: cookies(jar) } }), { ...options, fetch: async (url) => {
    assert.equal(url, 'https://backend.example/api/instructor/requests?type=late&page=2');
    return Response.json({ success: true, data: [] });
  } });
  assert.equal(response.status, 200);
});

test('the Node adapter serves actual cookie and multipart HTTP requests on localhost', async () => {
  const { createServer } = await import('node:http');
  const { nodeGateway } = await import('../server/viteGateway.js');
  const server = createServer(nodeGateway({ ...options, production: false, fetch: async (url, init) => {
    if (url.endsWith('/api/auth/exchange')) return Response.json({ success: true, data: { token, user: { id: 'one' } } });
    assert.ok(url.endsWith('/api/requests/evidence'));
    assert.match(init.headers.get('content-type'), /multipart\/form-data; boundary=/);
    assert.match(new TextDecoder().decode(init.body), /fixture-file-contents/);
    return Response.json({ success: true, data: { path: 'evidence-id' } });
  } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const local = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${local}/api/auth/csrf`);
    assert.equal(response.status, 200);
    const jar = new Map();
    remember(jar, response);
    assert.ok(jar.has('alrm_dev_csrf'));
    assert.ok(response.headers.getSetCookie().every(value => value.includes('HttpOnly') && !value.includes('Secure')));
    const proof = (await response.json()).data.csrf_token;
    assert.ok(proof);
    const noCookie = await fetch(`${local}/api/me`);
    assert.equal(noCookie.status, 401);
    const loggedIn = await fetch(`${local}/api/auth/exchange`, { method: 'POST', headers: { origin: local, cookie: cookies(jar), 'x-csrf-token': proof, 'content-type': 'application/json' }, body: '{"code":"one-use-code"}' });
    assert.equal(loggedIn.status, 200);
    remember(jar, loggedIn);
    const updatedProof = await fetch(`${local}/api/auth/csrf`, { headers: { cookie: cookies(jar) } });
    remember(jar, updatedProof);
    const form = new FormData();
    form.set('file', new Blob(['fixture-file-contents'], { type: 'image/png' }), 'test.png');
    const upload = await fetch(`${local}/api/requests/evidence`, { method: 'POST', headers: { origin: local, cookie: cookies(jar), 'x-csrf-token': (await updatedProof.json()).data.csrf_token }, body: form });
    assert.equal(upload.status, 200);
    assert.equal((await upload.json()).data.path, 'evidence-id');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
