import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server, Page, AuthContext, ResourceContext;
let pending, resources;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const user = { id: "student-one", name: "Ana Santos", school_id_number: "2026-001", year_level: "1st", program: { program_name: "BS Information Systems" } };
const requests = [{ id: "request-one", type: "absence", status: "approved", subjects_missed: "Mathematics", date_submitted: "2026-10-20T09:00:00Z", date_reviewed: "2026-10-21T09:00:00Z" }];
const attendance = [{ class_id: "class-one", subject_name: "Mathematics", tracker: { converted_absences: "2" } }];
const classes = [{ class_id: "class-one", section: "A", semester: "1st", school_year: "2026-2027" }];

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false }, appType: "custom",
    plugins: [{
      name: "student-progressive-resource-context", enforce: "pre",
      transform(code, id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/src/context/AuthContext.jsx")) return `${code}\nexport { AuthContext as TestAuthContext };`;
        // SSR does not run effects. Supply the resource lifecycle at that boundary;
        // keep dashboard components, endpoint loaders and validation real.
        if (path.endsWith("/src/hooks/useApiResource.js")) return `
          import { createContext, useContext } from "react";
          export const TestResourceContext = createContext(null);
          export function useApiResource(load, key) {
            return useContext(TestResourceContext)(load, key);
          }`;
        // Isolate content from the header bell's separate notification requests.
        if (path.endsWith("/student/StudentPageLayout.jsx")) return `
          import { createElement } from "react";
          export default function Layout({ children }) { return createElement("main", null, children); }`;
      },
    }],
  });
  ({ TestAuthContext: AuthContext } = await server.ssrLoadModule("/src/context/AuthContext.jsx"));
  ({ TestResourceContext: ResourceContext } = await server.ssrLoadModule("/src/hooks/useApiResource.js"));
  ({ default: Page } = await server.ssrLoadModule("/src/pages/auth/student/StudentDashboard.jsx"));
});
after(async () => { await server?.close(); });
beforeEach(() => {
  resources = new Map();
  pending = new Map();
  mock.method(globalThis, "fetch", (url) => new Promise((resolve) => {
    pending.set(new URL(url, "http://localhost").pathname, resolve);
  }));
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "test-token" } });
});
afterEach(() => {
  mock.restoreAll();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

function useResource(load, key) {
  if (!resources.has(load)) {
    const state = { data: null, error: "", loading: true };
    const start = () => {
      state.loading = true;
      state.error = "";
      state.promise = Promise.resolve().then(() => load(key)).then(
        (data) => Object.assign(state, { data, error: "", loading: false }),
        (error) => Object.assign(state, { data: null, error: error.message, loading: false }),
      );
    };
    state.reload = start;
    resources.set(load, state);
    start();
  }
  return resources.get(load);
}

function render(account = user) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/dashboard#recent-notifications"] },
    React.createElement(AuthContext.Provider, { value: { user: account, loading: !account } },
      React.createElement(ResourceContext.Provider, { value: useResource }, React.createElement(Page)))));
}

async function start() {
  const html = render();
  await setImmediate();
  assert.deepEqual([...pending.keys()].sort(), ["/api/attendance/summary", "/api/classes", "/api/requests"]);
  return html;
}

async function settle(path, data, status = 200) {
  assert.ok(pending.has(path), `No independent resource for ${path}`);
  pending.get(path)(Response.json(status === 200 ? { success: true, data } : { message: data }, { status }));
  pending.delete(path);
  await setImmediate();
  return render();
}

test("verified name and action show immediately with one status and no fake metrics", async () => {
  const html = await start();
  assert.match(html, /Welcome, Ana Santos!/);
  assert.match(html, /Submit excuse letter/);
  assert.match(html, /data-slot="dashboard-skeleton"/);
  assert.match(html, /data-variant="student"/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 3);
  assert.doesNotMatch(html, /Absences Recorded|Good Standing|No recent request updates/);
});

test("requests reveal recorded metrics and notifications while attendance and classes wait", async () => {
  await start();
  const html = await settle("/api/requests", requests);
  assert.match(html, /Absences Recorded/);
  assert.match(html, />1<\/p>/);
  assert.match(html, /Lates Recorded/);
  assert.match(html, /Mathematics approved/);
  assert.match(html, /data-slot="threshold-placeholder"/);
  assert.doesNotMatch(html, /Across 0 enrolled|Good Standing/);
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 1);
});

test("attendance gauge reveals independently and stays visible when classes finish", async () => {
  await start();
  let html = await settle("/api/attendance/summary", attendance);
  assert.match(html, /Cautionary Standing/);
  assert.doesNotMatch(html, /data-slot="threshold-placeholder"/);
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 2);
  html = await settle("/api/classes", classes);
  assert.match(html, /Cautionary Standing/);
  assert.match(html, /1st Semester A.Y. 2026-2027/);
  assert.match(html, /data-slot="notification-placeholder"/);
});

test("each endpoint failure leaves successful components and offers only one retry alert", async () => {
  for (const failed of ["/api/requests", "/api/attendance/summary", "/api/classes"]) {
    resources.clear();
    pending.clear();
    await start();
    for (const [path, data] of [["/api/requests", requests], ["/api/attendance/summary", attendance], ["/api/classes", classes]]) {
      await settle(path, path === failed ? "Endpoint unavailable" : data, path === failed ? 503 : 200);
    }
    let html = render();
    assert.match(html, /Welcome, Ana Santos!/);
    assert.match(html, /Endpoint unavailable/);
    assert.match(html, /Retry/);
    assert.equal((html.match(/role="alert"/g) || []).length, 1, failed);
    assert.doesNotMatch(html, /role="status"|data-slot="metric-placeholder"/);
    if (failed !== "/api/attendance/summary") assert.match(html, /Cautionary Standing/);
    if (failed !== "/api/requests") assert.match(html, /Mathematics approved/);
    const resource = [...resources.values()].find((entry) => entry.error);
    resource.reload();
    html = render();
    if (failed !== "/api/attendance/summary") assert.match(html, /Cautionary Standing/);
    if (failed !== "/api/requests") assert.match(html, /Mathematics approved/);
    await setImmediate();
    await settle(failed, failed === "/api/requests" ? requests : failed === "/api/classes" ? classes : attendance);
    assert.doesNotMatch(render(), /role="alert"|role="status"|data-slot="skeleton"/);
  }
});

test("malformed arrays and invalid tracker numbers become unavailable, never zero or NaN", async () => {
  for (const [path, data] of [
    ["/api/requests", {}], ["/api/requests", [null]],
    ["/api/requests", [{ id: "bad", type: "unknown", status: "pending" }]],
    ["/api/attendance/summary", [{ class_id: "class-one", tracker: { converted_absences: "invalid" } }]],
    ["/api/attendance/summary", [{ class_id: "class-one", tracker: { converted_absences: -1 } }]],
    ["/api/attendance/summary", [null]], ["/api/classes", [null]],
    ["/api/classes", [{ class_id: "class-one", semester: {} }]],
  ]) {
    resources.clear();
    pending.clear();
    await start();
    const html = await settle(path, data);
    assert.match(html, /unavailable|unexpected/i, path);
    assert.match(html, /Retry/);
    assert.equal((html.match(/role="alert"/g) || []).length, 1);
    assert.doesNotMatch(html, /NaN|Good Standing|Across 0 enrolled/);
  }
});

test("simultaneous failures show one alert per endpoint and no invented totals or standing", async () => {
  await start();
  for (const path of [...pending.keys()]) await settle(path, "Endpoint unavailable", 503);
  const html = render();
  assert.equal((html.match(/role="alert"/g) || []).length, 3);
  assert.equal((html.match(/Endpoint unavailable/g) || []).length, 3);
  assert.match(html, /Absences Recorded/);
  assert.match(html, /Lates Recorded/);
  assert.doesNotMatch(html, />0<\/p>|Good Standing|No recent request updates|role="status"|data-slot="skeleton"/);
});

test("empty successes settle honestly without keeping placeholders", async () => {
  await start();
  for (const path of [...pending.keys()]) await settle(path, []);
  const html = render();
  assert.match(html, /Across 0 enrolled courses/);
  assert.match(html, /No Attendance Recorded/);
  assert.match(html, /No recent request updates/);
  assert.doesNotMatch(html, /role="status"|role="alert"|data-slot="skeleton"/);
});

test("without a verified user only the neutral student skeleton renders and no resources start", async () => {
  const html = render(null);
  await setImmediate();
  assert.match(html, /data-slot="dashboard-skeleton"/);
  assert.match(html, /data-variant="student"/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.doesNotMatch(html, /Welcome|Student ID|Submit excuse letter/);
  assert.equal(resources.size, 0);
  assert.equal(pending.size, 0);
});
