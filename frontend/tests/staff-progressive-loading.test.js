import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let AuthProvider;
let clearResourceCache;
const originalWindow = globalThis.window;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalFetch = globalThis.fetch;
before(async () => {
  globalThis.window = { setTimeout, clearTimeout, localStorage: { getItem: () => null } };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  ({ AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx"));
  ({ clearResourceCache } = await server.ssrLoadModule("/src/api/resourceCache.js"));
});
beforeEach(() => clearResourceCache());
after(async () => {
  await server?.close();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

// Exercise real hook/effect code without adding a DOM or renderer dependency.
function mount(render) {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let value;
  let updates = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const dispatcher = {
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
    html() { update(); return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AuthProvider, null, value))); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

function network() {
  const calls = [];
  globalThis.fetch = (input, options = {}) => {
    const path = new URL(input, "http://localhost").pathname;
    if (path === "/api/auth/csrf") return Promise.resolve(Response.json({ success: true, data: { csrf_token: "test-csrf-proof" } }));
    return new Promise(resolve => calls.push({ path, options, resolve }));
  };
  return {
    calls,
    reply(path, data, status = 200) {
      const call = calls.find(call => call.path === `/api/${path}` && !call.done);
      assert.ok(call, `Expected pending request for ${path}`);
      call.done = true;
      call.resolve(Response.json(status === 200 ? { data } : { message: data }, { status }));
    },
  };
}

function elements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...elements(node.props.children, predicate)];
}
const button = (page, text) => elements(page.value, node => node.props.children === text)[0];
const phData = { total_classes: 7, total_students: 123, program_name: "Information Systems" };
const adminData = { total_programs: 9, total_classes: 12, total_students: 123, total_instructors: 4, total_program_heads: 2, pending_requests: 3, warning_count: 1, ir_count: 0 };
const flags = [{ id: "flag-one", status: "open", request: { enrollment: { student: { id: "student-one", name: "Test Student" } } } }];
const users = [{ id: "instructor-one", name: "Test Instructor", email: "test@example.test", role: "instructor", status: "active" }];
const programs = [{ id: "program-one", program_name: "Test Program" }];
const classes = [{ id: "class-one", subject_name: "Test Subject" }];
const phPath = "/src/pages/auth/programHead/ProgramHeadDashboard.jsx";
const adminPath = "/src/pages/auth/admin/AdminDashboard.jsx";

test("program head publishes dashboard, requests and flags independently with one loading status", async () => {
  const { ProgramHeadDashboard } = await server.ssrLoadModule(phPath);
  const api = network();
  const page = mount(() => ProgramHeadDashboard({}));
  try {
    let html = page.html();
    assert.match(html, /data-slot="dashboard-skeleton"/);
    assert.match(html, /data-variant="program"/);
    assert.match(html, /aria-busy="true"/);
    assert.equal((html.match(/role="status"/g) || []).length, 1);
    await page.flush();
    api.reply("program-head/dashboard", phData);
    await page.flush();
    html = page.html();
    assert.match(html, />123</);
    assert.match(html, /activity-chart-placeholder/);
    assert.doesNotMatch(html, /No escalated students/);
    api.reply("program-head/requests", []);
    await page.flush();
    html = page.html();
    assert.match(html, /Absences and tardiness/);
    assert.doesNotMatch(html, /activity-chart-placeholder/);
    assert.equal((html.match(/role="status"/g) || []).length, 1);
    api.reply("program-head/students/flagged", flags);
    await page.flush();
    assert.match(page.html(), /Test Student/);
    assert.doesNotMatch(page.html(), /role="status"/);
  } finally { page.unmount(); }
});

test("program request failures stay local and retry refreshes the dashboard resources", async () => {
  const { ProgramHeadDashboard } = await server.ssrLoadModule(phPath);
  const api = network();
  const page = mount(() => ProgramHeadDashboard({}));
  try {
    await page.flush();
    api.reply("program-head/dashboard", phData);
    api.reply("program-head/students/flagged", flags);
    api.reply("program-head/requests", "Requests offline", 503);
    await page.flush();
    assert.match(page.html(), /Requests offline/);
    assert.match(page.html(), /Test Student/);
    assert.doesNotMatch(page.html(), /Absences and tardiness/);
    button(page, "Retry loading").props.onClick();
    await page.flush();
    assert.match(page.html(), /data-slot="dashboard-skeleton"/);
    api.reply("program-head/dashboard", phData);
    api.reply("program-head/students/flagged", flags);
    api.reply("program-head/requests", []);
    await page.flush();
    assert.match(page.html(), /Test Student/);
    assert.match(page.html(), />123</);
    assert.match(page.html(), /Absences and tardiness/);
  } finally { page.unmount(); }
});

test("program refresh rejects superseded responses and non-dashboard views ignore unrelated loading", async () => {
  const { useProgramHeadRecords } = await server.ssrLoadModule("/src/pages/auth/programHead/useProgramHeadRecords.js");
  const api = network();
  const hook = mount(() => useProgramHeadRecords());
  try {
    await hook.flush();
    hook.value.refresh();
    await hook.flush();
    api.reply("program-head/dashboard", { total_students: 999 });
    await hook.flush();
    assert.notEqual(hook.value.dashboard?.total_students, 999);
    api.reply("program-head/dashboard", phData);
    await hook.flush();
    assert.equal(hook.value.dashboard.total_students, 123);
    assert.equal(hook.value.resourceLoading.dashboard, false);
    assert.equal(hook.value.resourceLoading.requests, true);
  } finally { hook.unmount(); }
  clearResourceCache();
  const { ProgramHeadDashboard } = await server.ssrLoadModule(phPath);
  const only = network();
  const page = mount(() => ProgramHeadDashboard({ view: "flagged" }));
  try {
    await page.flush();
    only.reply("program-head/students/flagged", []);
    await page.flush();
    assert.doesNotMatch(page.html(), /role="status"/);
    assert.match(page.html(), /No/);
  } finally { page.unmount(); }
});

test("admin dashboard loads only its summary resource", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({}));
  try {
    const initial = page.html();
    assert.match(initial, /data-slot="dashboard-skeleton"/);
    assert.match(initial, /data-variant="admin"/);
    assert.match(initial, /aria-busy="true"/);
    assert.equal((initial.match(/role="status"/g) || []).length, 1);
    await page.flush();
    api.reply("admin/dashboard", adminData);
    await page.flush();
    assert.match(page.html(), />123</);
    assert.match(page.html(), /Absences and Tardiness by Department/);
    assert.match(page.html(), /Quick Access/);
    assert.doesNotMatch(page.html(), /approval-placeholder|Create class|Staff role assignment/);
    assert.deepEqual(api.calls.filter(call => !call.done).map(call => call.path), []);
    assert.equal(api.calls.filter(call => call.options.method === "POST").length, 0);
    assert.doesNotMatch(page.html(), /Loading administrator data/);
  } finally { page.unmount(); }
});

test("admin dashboard failure does not fabricate metric zeros and retry recovers", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({}));
  try {
    await page.flush();
    api.reply("admin/dashboard", "Metrics offline", 503);
    await page.flush();
    const html = page.html();
    assert.match(html, /Metrics offline/);
    assert.match(html, /Quick Access/);
    assert.doesNotMatch(html, />0</);
    page.value.props.onRetry();
    await page.flush();
    assert.match(page.html(), /Quick Access/);
    api.reply("admin/dashboard", adminData);
    await page.flush();
    assert.match(page.html(), />123</);
  } finally { page.unmount(); }
});

test("admin users view and role mutation reload do not wait to publish unrelated widgets", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "users" }));
  try {
    await page.flush();
    api.reply("admin/users", users);
    await page.flush();
    assert.match(page.html(), /Test Instructor/);
    assert.doesNotMatch(page.html(), /role="status"/);
    const select = elements(page.value, node => node.type === "select")[0];
    select.props.onChange({ target: { value: "program_head" } });
    await page.flush();
    button(page, "Assign role").props.onClick();
    await page.flush();
    api.reply("admin/users/instructor-one/role", { ...users[0], role: "program_head" });
    await page.flush();
    assert.equal(api.calls.filter(call => call.path === "/api/admin/users").length, 2);
    assert.match(page.html(), /Test Instructor/);
    api.reply("admin/users", [{ ...users[0], role: "program_head" }]);
    await page.flush();
    assert.match(page.html(), /Staff role assigned/);
    assert.equal(api.calls.some(call => call.path === "/api/admin/dashboard"), false);
  } finally { page.unmount(); }
});

test("program flag failure leaves the request chart usable without claiming no students are at risk", async () => {
  const { ProgramHeadDashboard } = await server.ssrLoadModule(phPath);
  const api = network();
  const page = mount(() => ProgramHeadDashboard({}));
  try {
    await page.flush();
    api.reply("program-head/requests", []);
    api.reply("program-head/students/flagged", "Flags offline", 503);
    await page.flush();
    const html = page.html();
    assert.match(html, /Absences and tardiness/);
    assert.match(html, /Flags offline/);
    assert.doesNotMatch(html, /No escalated students|>0</);
    assert.match(html, /metric-placeholder/);
  } finally { page.unmount(); }
});

test("admin dashboard retry ignores the superseded response", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({}));
  try {
    await page.flush();
    page.value.props.onRetry();
    await page.flush();
    api.reply("admin/dashboard", { total_students: 999 });
    await page.flush();
    assert.doesNotMatch(page.html(), />999</);
    assert.match(page.html(), /metric-placeholder|data-slot="skeleton"/);
    api.reply("admin/dashboard", adminData);
    await page.flush();
    assert.match(page.html(), />123</);
    assert.doesNotMatch(page.html(), /metric-placeholder/);
  } finally { page.unmount(); }
});

test("Manage Classes shows current create and edit actions without deletion", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "classes" }));
  try {
    await page.flush();
    api.reply("admin/programs", programs);
    api.reply("admin/classes", classes);
    await page.flush();
    const html = page.html();
    assert.match(html, /Existing Classes/);
    assert.match(html, /Test Subject/);
    assert.match(html, /Create Class/);
    assert.match(html, />Edit<\/button>/);
    assert.doesNotMatch(html, />Delete<\/button>/);
  } finally { page.unmount(); }
});

test("Manage Class uses actual contact hours for both class-hour values", async () => {
  const { ClassHours } = await server.ssrLoadModule(adminPath);
  assert.equal(typeof ClassHours, "function");
  const html = renderToStaticMarkup(React.createElement(ClassHours, { item: { credit_units: 1, weekly_hours: 3 } }));
  assert.match(html, /Academic units:<\/dt> <dd[^>]*>3<\/dd>/);
  assert.match(html, /Class\/contact hours:<\/dt> <dd[^>]*>3 hours<\/dd>/);
  assert.doesNotMatch(html, /weekly|>1<\/dd>/i);
});

test("Manage Class create button uses the standard admin action size", async () => {
  const { CreateClassButton } = await server.ssrLoadModule(adminPath);
  assert.equal(typeof CreateClassButton, "function");
  const html = renderToStaticMarkup(React.createElement(CreateClassButton));
  assert.match(html, /class="[^"]*h-10[^"]*px-4[^"]*"/);
});

test("admin program failure leaves classes visible and report options recover without dashboard data", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "classes" }));
  try {
    await page.flush();
    api.reply("admin/classes", classes);
    api.reply("admin/programs", "Programs offline", 503);
    await page.flush();
    const html = page.html();
    assert.match(html, /Test Subject/);
    assert.match(html, /Programs offline/);
    assert.match(html, /Create Class/);
    assert.doesNotMatch(html, /role="status"/);
  } finally { page.unmount(); }

  const reportApi = network();
  const report = mount(() => AdminDashboard({ view: "reports" }));
  try {
    await report.flush();
    reportApi.reply("admin/programs", programs);
    await report.flush();
    assert.match(report.html(), /Generate requests report/);
    assert.doesNotMatch(report.html(), /role="status"/);
    assert.match(report.html(), />Generate<\/button>/);
    assert.doesNotMatch(report.html(), />Download<\/button>/);
  } finally { report.unmount(); }
});

test("administrator program creation retains its payload and awaits scoped reload resources", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "programs" }));
  const settle = async () => {
    api.reply("admin/users", users);
    api.reply("admin/programs", programs);
    await page.flush();
  };
  const fill = (name, value) => {
    const field = elements(page.value, node => node.props.name === name)[0];
    field.props.onChange({ target: { name, value } });
  };
  try {
    await page.flush();
    await settle();
    const payload = { program_name: "New Program", program_head_id: "instructor-one" };
    for (const [name, value] of Object.entries(payload)) fill(name, value);
    await page.flush();
    const form = elements(page.value, node => node.type === "form")[0];
    const action = form.props.onSubmit({ preventDefault() {} });
    await page.flush();
    const create = api.calls.find(call => call.options.method === "POST");
    assert.deepEqual(JSON.parse(create.options.body), payload);
    api.reply("admin/programs", programs[0]);
    await page.flush();
    assert.equal(button(page, "Create").props.disabled, true);
    api.reply("admin/users", users);
    await page.flush();
    // Working state survives partial reload completion.
    assert.equal(button(page, "Create").props.disabled, true);
    api.reply("admin/programs", programs);
    await action;
    await page.flush();
    assert.equal(elements(page.value, node => node.props.name === "program_name")[0].props.value, "");
    assert.match(page.html(), /Program created/);
    assert.equal(api.calls.some(call => call.options.method === "DELETE"), false);
  } finally { page.unmount(); }
});
