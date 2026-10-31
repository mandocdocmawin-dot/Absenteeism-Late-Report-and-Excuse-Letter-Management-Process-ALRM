import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let AuthProvider;
const originalWindow = globalThis.window;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalFetch = globalThis.fetch;
before(async () => {
  globalThis.window = { setTimeout, clearTimeout, localStorage: { getItem: () => null } };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  ({ AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx"));
});
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

test("program request failures stay local, retry keeps resolved widgets and unmount blocks late updates", async () => {
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
    assert.match(page.html(), /Test Student/);
    assert.match(page.html(), />123</);
    api.reply("program-head/requests", []);
    await page.flush();
    assert.match(page.html(), /Absences and tardiness/);
    page.unmount();
    const count = page.updates;
    api.reply("program-head/dashboard", { total_students: 999 });
    await page.flush();
    assert.equal(page.updates, count);
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

test("admin metrics and pending approval widgets reveal independently", async () => {
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
    api.reply("admin/classes", classes);
    api.reply("admin/programs", programs);
    await page.flush();
    assert.match(page.html(), /Absences and Tardiness by Department/);
    assert.match(page.html(), /approval-placeholder/);
    assert.doesNotMatch(page.html(), /Create class|Staff role assignment/);
    assert.equal(api.calls.filter(call => call.options.method === "POST").length, 0);
    api.reply("admin/users", [{ ...users[0], status: "pending" }]);
    await page.flush();
    assert.match(page.html(), /Test Instructor/);
    assert.match(page.html(), /href="\/user-management\?tab=waiting/);
    assert.doesNotMatch(page.html(), /Loading administrator data/);
  } finally { page.unmount(); }
});

test("admin local failures do not fabricate metric zeros or empty lists and retry recovers", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({}));
  try {
    await page.flush();
    api.reply("admin/dashboard", "Metrics offline", 503);
    api.reply("admin/users", "Users offline", 503);
    api.reply("admin/programs", programs);
    api.reply("admin/classes", classes);
    await page.flush();
    const html = page.html();
    assert.match(html, /Metrics offline/);
    assert.match(html, /Users offline/);
    assert.match(html, /Quick Access/);
    assert.doesNotMatch(html, /No staff accounts|>0<|No classes found/);
    page.value.props.onRetry();
    await page.flush();
    assert.match(page.html(), /Quick Access/);
    api.reply("admin/dashboard", adminData);
    api.reply("admin/users", [{ ...users[0], status: "pending" }]);
    await page.flush();
    assert.match(page.html(), />123</);
    assert.match(page.html(), /Test Instructor/);
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
    page.unmount();
    const count = page.updates;
    api.reply("admin/dashboard", adminData);
    await page.flush();
    assert.equal(page.updates, count);
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

test("admin superseded responses cannot overwrite a newer reload", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({}));
  try {
    await page.flush();
    api.reply("admin/users", "Users offline", 503);
    await page.flush();
    page.value.props.onRetry();
    await page.flush();
    api.reply("admin/dashboard", { total_students: 999 });
    await page.flush();
    assert.doesNotMatch(page.html(), />999</);
    api.reply("admin/dashboard", adminData);
    await page.flush();
    assert.match(page.html(), />123</);
    assert.match(page.html(), /metric-placeholder|data-slot="skeleton"/);
  } finally { page.unmount(); }
});

test("Manage Classes shows existing classes without a create form", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "classes" }));
  try {
    await page.flush();
    api.reply("admin/dashboard", adminData);
    api.reply("admin/users", users);
    api.reply("admin/programs", programs);
    api.reply("admin/classes", classes);
    await page.flush();
    const html = page.html();
    assert.match(html, /Existing Classes/);
    assert.match(html, /Test Subject/);
    assert.doesNotMatch(html, /Create Class|Create class|name="subject_name"/);
  } finally { page.unmount(); }
});

test("admin program failure leaves classes visible and report options recover without dashboard data", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "classes" }));
  try {
    await page.flush();
    api.reply("admin/users", users);
    api.reply("admin/classes", classes);
    api.reply("admin/programs", "Programs offline", 503);
    await page.flush();
    const html = page.html();
    assert.match(html, /Test Subject/);
    assert.match(html, /Programs offline/);
    assert.doesNotMatch(html, /Create Class|Create class/);
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

test("administrator program creation and deletion retain their payloads and await all reload resources", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "programs" }));
  const settle = async () => {
    api.reply("admin/dashboard", adminData);
    api.reply("admin/users", users);
    api.reply("admin/programs", programs);
    api.reply("admin/classes", classes);
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
    api.reply("admin/dashboard", adminData);
    api.reply("admin/programs", programs);
    api.reply("admin/classes", classes);
    await action;
    await page.flush();
    assert.equal(elements(page.value, node => node.props.name === "program_name")[0].props.value, "");
    const buttons = elements(page.value, node => node.props.children === "Delete");
    buttons[0].props.onClick();
    await page.flush();
    const deletion = api.calls.find(call => call.path === "/api/admin/programs/program-one");
    assert.equal(deletion.options.method, "DELETE");
    api.reply("admin/programs/program-one", {});
    await page.flush();
    await settle();
    assert.match(page.html(), /Program deleted/);
  } finally { page.unmount(); }
});

test("Manage Classes keeps class deletion after removing creation", async () => {
  const { AdminDashboard } = await server.ssrLoadModule(adminPath);
  const api = network();
  const page = mount(() => AdminDashboard({ view: "classes" }));
  const settle = async () => {
    api.reply("admin/dashboard", adminData);
    api.reply("admin/users", users);
    api.reply("admin/programs", programs);
    api.reply("admin/classes", classes);
    await page.flush();
  };
  try {
    await page.flush();
    await settle();
    elements(page.value, node => node.props.children === "Delete")[0].props.onClick();
    await page.flush();
    const deletion = api.calls.find(call => call.path === "/api/admin/classes/class-one");
    assert.equal(deletion.options.method, "DELETE");
    api.reply("admin/classes/class-one", {});
    await page.flush();
    await settle();
    assert.match(page.html(), /Class deleted/);
    assert.doesNotMatch(page.html(), /Create Class|Create class/);
  } finally { page.unmount(); }
});

test("Manage confirms class deletion, preserves rejected rows, blocks duplicates and reloads after success", async () => {
  const { default: AdminManage } = await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx");
  const api = network();
  const page = mount(() => AdminManage());
  const settle = async records => {
    api.reply("admin/classes", records);
    api.reply("admin/programs", programs);
    api.reply("admin/users", users);
    await page.flush();
  };
  try {
    await page.flush(); await settle(classes);
    assert.equal(button(page, "Remove").props.disabled, false);
    button(page, "Remove").props.onClick(); await page.flush();
    assert.equal(api.calls.filter(call => call.options.method === "DELETE").length, 0);
    const confirmation = () => elements(page.value, node => node.props.open === true && node.props.onOpenChange)[0];
    confirmation().props.onOpenChange(false); await page.flush();
    assert.equal(confirmation(), undefined);
    button(page, "Remove").props.onClick(); await page.flush();
    const confirm = button(page, "Remove class");
    const rejected = confirm.props.onClick();
    confirm.props.onClick();
    await page.flush();
    assert.equal(api.calls.filter(call => call.options.method === "DELETE").length, 1);
    assert.equal(button(page, "Remove").props.disabled, true);
    confirmation().props.onOpenChange(false); await page.flush();
    assert.ok(confirmation(), "cannot dismiss while removing");
    api.reply("admin/classes/class-one", "Cannot delete a class that still has enrollments.", 409);
    await rejected; await page.flush();
    assert.match(page.html(), /Test Subject/);
    assert.ok(elements(page.value, node => node.props.role === "alert").some(node => String(node.props.children).includes("still has enrollments")));
    const success = button(page, "Remove class").props.onClick();
    await page.flush();
    api.reply("admin/classes/class-one", {});
    await page.flush(); await settle([]); await success; await page.flush();
    assert.match(page.html(), /Class removed\./);
    assert.doesNotMatch(page.html(), /Test Subject/);
    assert.equal(confirmation(), undefined);
  } finally { page.unmount(); }
});
