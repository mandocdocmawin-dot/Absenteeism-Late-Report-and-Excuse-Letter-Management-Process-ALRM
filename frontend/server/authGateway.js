import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { isIP } from 'node:net';

const LIFETIME = 8 * 60 * 60;
const MAX_BODY = 3 * 1024 * 1024;
const PUBLIC_POSTS = new Set(['auth/exchange', 'auth/otp/check-trusted', 'auth/otp/verify', 'auth/otp/resend']);
const PUBLIC_GETS = new Set(['auth/google/redirect', 'auth/google/callback']);

function equal(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && timingSafeEqual(a, b);
}

function readCookies(header) {
  const values = new Map();
  for (const part of (header || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    const name = part.slice(0, at).trim();
    values.set(name, values.has(name) ? '' : part.slice(at + 1).trim());
  }
  return values;
}

function seal(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')}`;
}

function unseal(value, key) {
  try {
    if (!value?.startsWith('v1.') || value.length > 3800) return null;
    const bytes = Buffer.from(value.slice(3), 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
    return typeof data.token === 'string' && data.token.length < 2048 && /^[a-f0-9]{64}$/.test(data.id) && data.expires > Date.now() ? data : null;
  } catch { return null; }
}

function csrfSignature(nonce, scope, key) {
  return createHmac('sha256', key).update(`alrm-csrf:${scope}:${nonce}`).digest('base64url');
}

function validCsrf(value, scope, key) {
  const [nonce, signature, extra] = (value || '').split('.');
  return !extra && /^[a-f0-9]{64}$/.test(nonce || '') && equal(signature, csrfSignature(nonce, scope, key));
}

function cookie(name, value, maxAge, production) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${production ? '; Secure' : ''}`;
}

function json(data, status = 200, headers = new Headers()) {
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return Response.json(data, { status, headers });
}

function fail(message, status) {
  return json({ success: false, message, data: null }, status);
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) return Buffer.concat(chunks, size);
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); return null; }
    chunks.push(Buffer.from(value));
  }
}

export async function handleGateway(request, { secret, backendOrigin, production = true, clientIp, fetch: upstreamFetch = fetch } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) return fail('The frontend server needs ALRM_COOKIE_SECRET configured before sign-in is available.', 503);
  const url = new URL(request.url);
  let backend;
  try {
    backend = new URL(backendOrigin);
    if (backend.protocol !== 'https:' || backend.username || backend.password || backend.pathname !== '/') throw new Error();
  } catch { return fail('The frontend API server is not configured correctly.', 503); }
  if (production && url.protocol !== 'https:') return fail('HTTPS is required.', 400);
  if (!production && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return fail('Development cookies are restricted to localhost.', 400);

  let path;
  try {
    path = decodeURIComponent(url.searchParams.get('__alrm_path') ?? url.pathname.replace(/^\/api\//, ''));
    if (!path || path.split('/').some(segment => !/^[a-zA-Z0-9_-][a-zA-Z0-9_.~-]*$/.test(segment) || segment === '..')) throw new Error();
  } catch { return fail('Invalid API path.', 400); }
  const method = request.method.toUpperCase();
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return fail('Method not allowed.', 405);
  const safe = method === 'GET' || method === 'HEAD';
  const crossSite = request.headers.get('sec-fetch-site') === 'cross-site';
  if (!safe && (crossSite || request.headers.get('origin') !== url.origin)) return fail('This request did not pass the origin check.', 403);
  if (path === 'auth/csrf' && crossSite) return fail('Cross-site requests are not allowed.', 403);

  const prefix = production ? '__Host-alrm_' : 'alrm_dev_';
  const names = { session: `${prefix}session`, seed: `${prefix}seed`, csrf: `${prefix}csrf` };
  const cookies = readCookies(request.headers.get('cookie'));
  const key = createHash('sha256').update(secret).digest();
  const session = unseal(cookies.get(names.session), key);
  const validSeed = /^[a-f0-9]{64}$/.test(cookies.get(names.seed) || '');
  const seed = validSeed ? cookies.get(names.seed) : randomBytes(32).toString('hex');
  const scope = session?.id || seed;
  const responseHeaders = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });

  if (path === 'auth/csrf') {
    if (method !== 'GET') return fail('Method not allowed.', 405);
    const current = cookies.get(names.csrf);
    const nonce = randomBytes(32).toString('hex');
    const proof = validCsrf(current, scope, key) ? current : `${nonce}.${csrfSignature(nonce, scope, key)}`;
    if (!session && !validSeed) responseHeaders.append('Set-Cookie', cookie(names.seed, seed, 600, production));
    responseHeaders.append('Set-Cookie', cookie(names.csrf, proof, LIFETIME, production));
    return json({ success: true, data: { csrf_token: proof } }, 200, responseHeaders);
  }

  if (!safe) {
    const proof = request.headers.get('x-csrf-token');
    if (!equal(proof, cookies.get(names.csrf)) || !validCsrf(proof, scope, key)) return fail('Your security check expired. Refresh the page and try again.', 403);
  }
  const publicRoute = safe ? PUBLIC_GETS.has(path) : PUBLIC_POSTS.has(path);
  if (!session && !publicRoute && !(path === 'logout' && method === 'POST')) return fail('Your session has expired. Please sign in again.', 401);

  const headers = new Headers({ Accept: 'application/json' });
  for (const name of ['content-type', 'user-agent', 'accept-language']) {
    if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  }
  headers.set('origin', url.origin);
  headers.set('referer', `${url.origin}/`);
  if (typeof clientIp === 'string' && isIP(clientIp)) headers.set('X-Forwarded-For', clientIp);
  if (session && !publicRoute) headers.set('Authorization', `Bearer ${session.token}`);
  if (path.startsWith('auth/')) {
    const trusted = ['alrm_device', 'alrm_oauth'].filter(name => cookies.get(name)).map(name => `${name}=${cookies.get(name)}`).join('; ');
    if (trusted) headers.set('Cookie', trusted);
  }
  let body;
  if (!safe) {
    if (Number(request.headers.get('content-length')) > MAX_BODY) return fail('The upload is too large.', 413);
    try { body = await readBody(request); } catch { return fail('The request body could not be read.', 400); }
    if (body === null) return fail('The upload is too large.', 413);
  }
  const query = new URLSearchParams(url.search);
  query.delete('__alrm_path');
  const upstreamUrl = new URL(`/api/${path}`, backend);
  upstreamUrl.search = query.toString();

  if (path === 'logout' && method === 'POST') {
    let revoked = !session;
    try {
      if (session) {
        const response = await upstreamFetch(upstreamUrl.href, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(5000) });
        revoked = response.ok || response.status === 401;
      }
    } catch { /* The browser session is cleared even if Laravel is unavailable. */ }
    for (const name of Object.values(names)) responseHeaders.append('Set-Cookie', cookie(name, '', 0, production));
    return json({ success: true, data: { revoked } }, 200, responseHeaders);
  }

  let response;
  try {
    response = await upstreamFetch(upstreamUrl.href, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(45000) });
  } catch { return fail('The API could not be reached. Please try again.', 502); }
  for (const value of response.headers.getSetCookie()) {
    if (!/^(alrm_device|alrm_oauth)=/.test(value)) continue;
    const clean = value.replace(/;\s*Domain=[^;]*/ig, '').replace(/;\s*Secure/ig, '').replace(/;\s*SameSite=[^;]*/ig, '');
    responseHeaders.append('Set-Cookie', `${clean}; SameSite=Lax${production ? '; Secure' : ''}${/;\s*HttpOnly/i.test(clean) ? '' : '; HttpOnly'}`);
  }
  if (response.status >= 300 && response.status < 400) {
    const location = new URL(response.headers.get('location') || '/', url);
    const allowedGoogle = path === 'auth/google/redirect' && location.origin === 'https://accounts.google.com';
    const allowedCallback = path === 'auth/google/callback' && location.origin === url.origin && ['/login', '/auth/otp', '/verify-otp', '/auth/callback'].includes(location.pathname);
    if ((!allowedGoogle && !allowedCallback) || [...location.searchParams.keys()].some(name => /^(token|access_token|otp_token|verification_token)$/i.test(name))) return fail('The sign-in redirect was not accepted.', 502);
    responseHeaders.set('Location', location.href);
    responseHeaders.set('Referrer-Policy', 'no-referrer');
    return new Response(null, { status: response.status, headers: responseHeaders });
  }

  const type = response.headers.get('content-type') || '';
  if (method === 'HEAD' || response.status === 204 || response.status === 205) {
    if (type) responseHeaders.set('Content-Type', type);
    return new Response(null, { status: response.status, headers: responseHeaders });
  }
  if (type.includes('application/json')) {
    let payload;
    try { payload = await response.json(); } catch { return fail('The API returned an invalid response.', 502); }
    if (path === 'auth/exchange' && response.ok) {
      const token = payload?.data?.token;
      if (payload?.success !== true || typeof token !== 'string' || !token || token.length > 2048 || !payload.data.user?.id) return fail('The server did not confirm your sign-in.', 502);
      const value = seal({ token, id: randomBytes(32).toString('hex'), expires: Date.now() + LIFETIME * 1000 }, key);
      responseHeaders.append('Set-Cookie', cookie(names.session, value, LIFETIME, production));
      responseHeaders.append('Set-Cookie', cookie(names.csrf, '', 0, production));
      payload = { success: true, message: payload.message, data: { authenticated: true, user: payload.data.user } };
    }
    if (path.startsWith('auth/')) {
      for (const target of [payload, payload?.data]) {
        if (!target || typeof target !== 'object') continue;
        for (const name of ['token', 'access_token', 'plainTextToken']) delete target[name];
      }
    }
    return json(payload, response.status, responseHeaders);
  }
  if (!['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'].some(mime => type.split(';')[0].trim() === mime)) return fail('The API returned an unsupported response.', 502);
  responseHeaders.set('Content-Type', type);
  if (response.headers.has('content-disposition')) responseHeaders.set('Content-Disposition', response.headers.get('content-disposition'));
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}
