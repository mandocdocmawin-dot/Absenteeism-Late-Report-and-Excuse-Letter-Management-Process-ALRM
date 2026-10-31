import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let SessionStatus;
let SessionTestContext;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    plugins: [{
      name: "session-loading-test-context",
      enforce: "pre",
      transform(code, id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/src/pages/AuthCallback.jsx") || path.endsWith("/src/pages/OtpVerification.jsx")) {
          const router = `const useNavigate = () => globalThis.__authTestNavigate;
            const useSearchParams = () => [new URLSearchParams(globalThis.__authTestSearch || "")];
            import { Link, Navigate } from "react-router-dom";`;
          return code.replace(/import \{[^}]*useNavigate[^}]*\} from "react-router-dom";/, router) +
            (path.endsWith("/OtpVerification.jsx") ? "\nexport { OtpVerificationForm as TestOtpForm };" : "");
        }
        // Supply session states without running auth effects or changing its source file.
        if (id.replaceAll("\\", "/").endsWith("/src/context/AuthContext.jsx")) {
          return `${code}\nexport { AuthContext as SessionTestContext };`;
        }
      },
    }],
  });
  ({ SessionTestContext } = await server.ssrLoadModule("/src/context/AuthContext.jsx"));
  ({ default: SessionStatus } = await server.ssrLoadModule("/src/components/SessionStatus.jsx"));
});

after(async () => { await server?.close(); });

function renderSession(path, state = {}) {
  let element;
  function Capture() {
    element = SessionStatus();
    return element;
  }
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] },
    React.createElement(SessionTestContext.Provider, {
      value: { loading: true, sessionError: "", refreshUser() {}, user: null, ...state },
    }, React.createElement(Capture))));
  return { html, element };
}

test("login, Google callback and OTP session checks retain the single school-logo loader", () => {
  for (const path of ["/login", "/login/", "/login?next=/dashboard", "/auth/callback", "/auth/otp", "/auth/other", "/verify-otp", "/verify-otp/?exchange_code=test"]) {
    const { html } = renderSession(path);
    assert.match(html, /data-slot="auth-loading"/, path);
    assert.match(html, /La Verdad Christian College logo/, path);
    assert.match(html, /Signing you in/, path);
    assert.equal((html.match(/role="status"/g) || []).length, 1, path);
    assert.doesNotMatch(html, /data-slot="session-restore-skeleton"|data-slot="skeleton"/, path);
  }
});

const protectedPaths = [
  ["/", "dashboard"], ["/dashboard", "dashboard"], ["/dashboard/?tab=overview", "dashboard"],
  ["/students", "table"], ["/instructors", "table"], ["/user-management", "table"],
  ["/programs", "table"], ["/classes", "table"], ["/reports", "table"],
  ["/student/records", "table"], ["/student/notifications", "table"],
  ["/instructor/class-records", "table"], ["/instructor/class-records/42", "table"],
  ["/instructor/class-requests", "table"], ["/program-head/requests", "table"],
  ["/program-head/flagged", "table"], ["/program-head/instructors", "table"],
  ["/program-head/reports", "table"],
  ["/settings", "profile"], ["/settings/", "profile"], ["/students/42", "profile"],
  ["/program-head/instructors/42", "profile"],
  ["/students/add", "form"], ["/instructors/add", "form"],
  ["/student/request", "form"], ["/complete-profile", "form"],
  ["/unknown-app-page", "table"], ["/login-history", "table"],
];

for (const [path] of protectedPaths) {
  test(`session restoration at ${path} shows the centered logo before page skeletons`, () => {
    const { html } = renderSession(path);
    assert.match(html, /data-slot="auth-loading"/);
    assert.match(html, /La Verdad Christian College logo/);
    assert.match(html, /min-h-screen place-items-center/);
    assert.match(html, /<main\b/);
    assert.match(html, /aria-busy="true"/);
    assert.equal((html.match(/role="status"/g) || []).length, 1);
    assert.match(html, /aria-label="Loading ALRM System\.\.\."/);
    assert.doesNotMatch(html, /Signing you in|session-restore-skeleton|data-slot="skeleton"|<(button|input|select|a)\b/);
    assert.doesNotMatch(html, /data-variant="(student|admin|instructor|program)"/);
  });
}

test("restoration never presents unvalidated account data or a role-specific dashboard", () => {
  const { html } = renderSession("/dashboard", {
    user: { name: "UNVALIDATED ACCOUNT", role: "admin", email: "private@example.test" },
  });
  assert.doesNotMatch(html, /UNVALIDATED ACCOUNT|private@example\.test|data-variant="admin"/);
  assert.match(html, /data-slot="auth-loading"/);
  assert.doesNotMatch(html, /data-slot="skeleton"/);
});

test("a settled session failure keeps HTTP 503, its description and the exact retry callback", () => {
  const refreshUser = () => {};
  for (const path of ["/login", "/dashboard", "/settings"]) {
    const { html, element } = renderSession(path, {
      loading: false, sessionError: "Saved session could not be checked", refreshUser,
    });
    assert.equal(element.props.status, 503);
    assert.equal(element.props.description, "Saved session could not be checked");
    assert.equal(element.props.onRetry, refreshUser);
    assert.match(html, /503/);
    assert.match(html, /Saved session could not be checked/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /session-restore-skeleton|auth-loading|role="status"/);
  }
});

test("returning accounts show the same logo regardless of a stale layout hint", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const items = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) } });
  try {
    for (const role of ["instructor", "student", "program", "admin"]) {
      items.set("alrm_loading_layout", role);
      const { html } = renderSession("/dashboard", { user: { name: "UNVALIDATED ACCOUNT", email: "private@example.test" } });
      assert.match(html, /data-slot="auth-loading"/);
      assert.doesNotMatch(html, /data-slot="metric-placeholder"/);
      assert.equal((html.match(/role="status"/g) || []).length, 1);
      assert.doesNotMatch(html, /UNVALIDATED ACCOUNT|private@example\.test|<(button|input|a)\b/);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else delete globalThis.sessionStorage;
  }
});

test("the startup logo never mounts protected content or overrides the server's role", async () => {
  const { ProtectedRoute } = await server.ssrLoadModule("/src/routes/ProtectedRoute.jsx");
  const originalSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const items = new Map();
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    items.set("alrm_loading_layout", "instructor");
    const render = state => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/instructor/class-requests"] }, React.createElement(SessionTestContext.Provider, { value: { user: null, loading: false, sessionError: "", ...state } }, React.createElement(ProtectedRoute, { allowedRoles: ["instructor"] }, React.createElement("p", null, "PROTECTED CONTENT")))));
    assert.doesNotMatch(render({ loading: true }), /PROTECTED CONTENT/);
    assert.doesNotMatch(render({}), /PROTECTED CONTENT/);
    const wrongRole = render({ user: { id: "verified-admin", role: "administrator" } });
    assert.doesNotMatch(wrongRole, /PROTECTED CONTENT/);
    assert.match(wrongRole, /403/);
    const instructor = { id: "verified-instructor", role: "instructor", program_id: "program-one", school_id_number: "FAC-2026-001" };
    assert.match(render({ user: instructor }), /PROTECTED CONTENT/);
  } finally {
    for (const [key, descriptor] of [["sessionStorage", originalSession], ["localStorage", originalLocal]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("verified SPA routes show their page skeleton without replaying the startup logo", async () => {
  const { ProtectedRoute } = await server.ssrLoadModule("/src/routes/ProtectedRoute.jsx");
  const Page = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorRequests/index.js")).default;
  const originalWindow = globalThis.window;
  const originalSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const items = new Map([["alrm_session_version", "verified-route-session"]]);
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  globalThis.window = { innerWidth: 1280, localStorage: storage };
  try {
    const instructor = { id: "verified-instructor", role: "instructor", program_id: "program-one", school_id_number: "FAC-2026-001", name: "Preview Instructor" };
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/instructor/class-requests"] },
      React.createElement(SessionTestContext.Provider, { value: {
        user: instructor,
        loading: false, sessionError: "",
      } }, React.createElement(ProtectedRoute, { allowedRoles: ["instructor"] }, React.createElement(Page)))));
    assert.match(html, /data-slot="table-page-skeleton"/);
    assert.match(html, /data-layout="courses"/);
    assert.doesNotMatch(html, /auth-loading|session-restore-skeleton|Loading ALRM System/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    for (const [key, descriptor] of [["sessionStorage", originalSession], ["localStorage", originalLocal]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

function mount(render) {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let value;
  let updates = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const dispatcher = {
    useSyncExternalStore(subscribe, snapshot) {
      const [value, setValue] = dispatcher.useState(() => snapshot?.() ?? null);
      dispatcher.useEffect(() => subscribe?.(() => setValue(snapshot?.() ?? null)), [subscribe, snapshot]);
      return value;
    },
    useContext() { return globalThis.__authTestContext; },
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => { updates++; slots[index].value = typeof next === "function" ? next(slots[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return dispatcher.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps };
        pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  function update() {
    cursor = 0;
    const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const previous = internals.H;
    internals.H = dispatcher;
    try { value = render(); } finally { internals.H = previous; }
    const effects = pending;
    pending = [];
    effects.forEach(effect => effect());
    return value;
  }
  update();
  return {
    get value() { return value; },
    get updates() { return updates; },
    async flush() { await new Promise(resolve => setTimeout(resolve, 0)); update(); await new Promise(resolve => setTimeout(resolve, 0)); return update(); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}


async function withCookieProvider(run, { hint = null } = {}) {
  const saved = ['window', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const items = new Map(hint ? [['alrm_session_version', hint]] : []);
  const storage = { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
  const calls = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: storage });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (path, options) => new Promise(resolve => calls.push({ path, options, resolve }));
  const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const client = await server.ssrLoadModule('/src/api/client.js');
  client.resetCsrfToken?.();
  let page;
  try {
    page = mount(() => AuthProvider({ children: null }));
    await run({ page, calls, items, client, state: () => page.value.props.value });
  } finally {
    page?.unmount();
    globalThis.fetch = previousFetch;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
const cookieUser = { id: 'verified-student', role: 'student', program_id: 'one', year_level: '1st', school_id_number: '2026-001' };

test('provider restores a cookie on startup with no marker and treats guest 401 normally', async () => {
  await withCookieProvider(async ({ page, calls, state }) => {
    assert.equal(state().loading, true);
    assert.equal(state().user, null);
    assert.equal(calls[0].path, '/api/me');
    assert.equal(calls[0].options.headers.has('Authorization'), false);
    calls[0].resolve(Response.json({ data: cookieUser }));
    await page.flush();
    assert.deepEqual(state().user, cookieUser);
    assert.equal(state().loading, false);
  });
  await withCookieProvider(async ({ page, calls, state }) => {
    calls[0].resolve(new Response('', { status: 401 }));
    await page.flush();
    assert.equal(state().user, null);
    assert.equal(state().sessionError, '');
    assert.equal(state().loading, false);
  }, { hint: 'forged-admin' });
});

test('provider preserves a verified user during outage and supports retry', async () => {
  await withCookieProvider(async ({ page, calls, state }) => {
    calls[0].resolve(Response.json({ data: cookieUser }));
    await page.flush();
    const refresh = state().refreshUser();
    calls.at(-1).resolve(new Response('', { status: 503 }));
    await refresh;
    await page.flush();
    assert.deepEqual(state().user, cookieUser);
    assert.match(state().sessionError, /try again/i);
    const retry = state().refreshUser();
    calls.at(-1).resolve(Response.json({ data: { ...cookieUser, name: 'Updated' } }));
    await retry;
    await page.flush();
    assert.equal(state().user.name, 'Updated');
    assert.equal(state().sessionError, '');
  });
});

test('another tab logging out invalidates a pending restoration without an existing marker', async () => {
  await withCookieProvider(async ({ page, calls, state, items }) => {
    const restoration = calls[0];
    const version = `expired:${crypto.randomUUID()}`;
    items.set('alrm_session_version', version);
    const event = new Event('storage');
    Object.assign(event, { key: 'alrm_session_version', newValue: version });
    window.dispatchEvent(event);
    await page.flush();
    assert.equal(state().loading, false);
    assert.equal(state().user, null);
    restoration.resolve(Response.json({ data: cookieUser }));
    await page.flush();
    assert.equal(state().user, null);
    assert.equal(state().sessionError, '');
  });
});

test('provider rejects legacy bearer completion and ignores stale restoration after cookie login', async () => {
  await withCookieProvider(async ({ page, calls, state, client, items }) => {
    assert.equal(typeof state().completeCookieLogin, 'function');
    await assert.rejects(state().completeCookieLogin({ data: { token: 'legacy-secret' } }), /confirm|cookie/i);
    const old = calls[0];
    const sessionVersion = client.markSessionChanged();
    const completion = state().completeCookieLogin({ data: { authenticated: true, user: cookieUser }, sessionVersion });
    calls.at(-1).resolve(Response.json({ data: cookieUser }));
    assert.deepEqual(await completion, cookieUser);
    old.resolve(new Response('', { status: 401 }));
    await page.flush();
    assert.deepEqual(state().user, cookieUser);
    assert.equal(items.has('auth_token'), false);
    assert.equal(items.get('alrm_session_version'), sessionVersion);
  });
});

test('logout awaits cookie clearance and late logout completion cannot erase a newer login', async () => {
  await withCookieProvider(async ({ page, calls, state, client, items }) => {
    calls[0].resolve(Response.json({ data: cookieUser }));
    await page.flush();
    items.set('pending_otp_login', 'pending');
    let completed = false;
    const logout = state().logout({ redirectToSignedOut: true }).then(() => { completed = true; });
    await page.flush();
    assert.equal(state().logoutDestination, '/signed-out', 'The route guard needs the destination before session-expiry notifications arrive');
    assert.equal(calls.at(-1).path, '/api/auth/csrf');
    calls.at(-1).resolve(Response.json({ success: true, data: { csrf_token: 'proof' } }));
    await page.flush();
    assert.equal(calls.at(-1).path, '/api/logout');
    assert.equal(calls.at(-1).options.headers.get('X-CSRF-Token'), 'proof');
    assert.equal(completed, false);
    assert.equal(items.get('pending_otp_login'), 'pending');
    calls.at(-1).resolve(Response.json({ success: true, data: { revoked: true } }));
    await logout;
    await page.flush();
    assert.equal(state().user, null);
    assert.equal(state().logoutDestination, '/signed-out');
    assert.equal(items.has('pending_otp_login'), false);
    const version = client.markSessionChanged();
    const login = state().completeCookieLogin({ data: { authenticated: true, user: cookieUser }, sessionVersion: version });
    calls.at(-1).resolve(Response.json({ data: cookieUser }));
    await login;
    await page.flush();
    assert.deepEqual(state().user, cookieUser);
  });
});

test('OTP APIs use protected cookie requests, accept authenticated exchange and never retry mutations', async () => {
  await withCookieProvider(async ({ page, calls, state, items }) => {
    calls[0].resolve(new Response('', { status: 401 }));
    await page.flush();
    const otp = await server.ssrLoadModule('/src/api/otp.js');
    const writes = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'include');
      assert.equal(options.headers.has('Authorization'), false);
      if (url === '/api/auth/csrf') return Response.json({ success: true, data: { csrf_token: 'signed-proof' } });
      assert.equal(options.headers.get('X-CSRF-Token'), 'signed-proof');
      writes.push([url, JSON.parse(options.body)]);
      return Response.json({ success: true, data: { authenticated: true, user: cookieUser } });
    };
    const exchange = await otp.exchangeOtpCode('one-time');
    assert.equal(exchange.data.authenticated, true);
    assert.equal(exchange.data.token, undefined);
    assert.equal(typeof exchange.sessionVersion, 'string');
    await otp.sendOtp({ token: 'ignored-legacy', pending: 'pending', userId: 'one', email: 'student@example.test' });
    await otp.verifyOtp({ token: 'ignored-legacy', pending: 'pending', userId: 'one', code: '123456' });
    assert.ok(writes.every(([, body]) => !('token' in body)));
    assert.equal(items.has('auth_token'), false);
    let attempts = 0;
    globalThis.fetch = async url => {
      if (url === '/api/auth/csrf') return Response.json({ success: true, data: { csrf_token: 'signed-proof' } });
      attempts++;
      return Response.json({ message: 'Upstream unavailable' }, { status: 502 });
    };
    await assert.rejects(otp.checkTrustedDevice({ pending: 'pending' }, { retries: 2, delayMs: 0 }), /unavailable/);
    assert.equal(attempts, 1);
    assert.equal(state().user, null);
  });
});

test('pending OTP state has a ten-minute lifetime and never retains obsolete pending bearer data', async () => {
  await withCookieProvider(async ({ calls, page, items }) => {
    calls[0].resolve(new Response('', { status: 401 }));
    await page.flush();
    const otp = await server.ssrLoadModule('/src/api/otp.js');
    items.set('pending_otp_token', 'obsolete-bearer');
    otp.setPendingLogin('short-lived-pending');
    otp.setPendingOtpSession({ token: 'do-not-store', email: 'student@example.test', userId: 'one' });
    assert.equal(items.has('pending_otp_token'), false);
    assert.equal(otp.getPendingLogin(), 'short-lived-pending');
    const now = Date.now;
    try {
      Date.now = () => now() + 600001;
      assert.equal(otp.getPendingLogin(), null);
      assert.equal(otp.getPendingOtpUserId(), null);
      assert.equal(otp.getPendingOtpEmail(), null);
    } finally { Date.now = now; }
  });
});

test('OAuth callback removes credential params before exchange and refuses legacy bearer URLs', async () => {
  await withCookieProvider(async ({ calls, page }) => {
    calls[0].resolve(new Response('', { status: 401 }));
    await page.flush();
    const { AuthCallback } = await server.ssrLoadModule('/src/pages/AuthCallback.jsx');
    const destinations = [];
    globalThis.__authTestNavigate = (path, options) => destinations.push([path, options]);
    const completed = [];
    globalThis.__authTestContext = { completeCookieLogin: async response => { completed.push(response); return cookieUser; } };
    window.location = { href: 'https://alrm.test/auth/callback?code=one-time&token=legacy#access_token=secret' };
    window.history = { state: { router: 'preserved' }, replaceState(state, _title, url) { window.location.href = new URL(url, window.location.href).href; assert.deepEqual(state, { router: 'preserved' }); } };
    globalThis.__authTestSearch = 'code=one-time';
    globalThis.fetch = async (url, options) => {
      assert.doesNotMatch(window.location.href, /code=|token=|secret/);
      if (url === '/api/auth/csrf') return Response.json({ success: true, data: { csrf_token: 'proof' } });
      assert.equal(url, '/api/auth/exchange');
      assert.equal(JSON.parse(options.body).code, 'one-time');
      return Response.json({ success: true, data: { authenticated: true, user: cookieUser } });
    };
    const callback = mount(() => AuthCallback());
    await callback.flush();
    assert.equal(completed.length, 1);
    assert.equal(completed[0].data.authenticated, true);
    assert.equal(destinations.at(-1)[0], '/dashboard');
    callback.unmount();
    globalThis.__authTestSearch = 'token=legacy-bearer';
    window.location.href = 'https://alrm.test/auth/callback?token=legacy-bearer';
    const legacy = mount(() => AuthCallback());
    await legacy.flush();
    assert.equal(completed.length, 1);
    const html = renderToStaticMarkup(legacy.value);
    assert.match(html, /one-time|code/i);
    assert.doesNotMatch(window.location.href, /token=/);
    legacy.unmount();
    delete globalThis.__authTestContext;
    delete globalThis.__authTestNavigate;
    delete globalThis.__authTestSearch;
  });
});
