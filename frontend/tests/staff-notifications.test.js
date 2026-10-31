import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });
beforeEach(() => {
  globalThis.window = new EventTarget();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "test-session" } });
});
afterEach(() => { mock.restoreAll(); delete globalThis.window; delete globalThis.localStorage; });
async function load(path) {
  const url = new URL(`../src/${path}`, import.meta.url);
  assert.ok(existsSync(url), `Missing shared notification module: ${path}`);
  return import(url);
}

test("staff notifications use authenticated shared GET and PATCH endpoints", async () => {
  const api = await load("api/notifications.js");
  const calls = [];
  mockApiFetch(async (url, options) => {
    calls.push({ url: String(url), method: options.method || "GET", headers: options.headers, body: options.body });
    const data = calls.length === 1 ? [] : calls.length === 2 ? { id: "note/one", is_read: true } : null;
    return Response.json({ success: true, data });
  });
  assert.deepEqual(await api.getNotifications(), []);
  await api.markNotificationRead("note/one");
  await api.markAllNotificationsRead();
  assert.deepEqual(calls.map(call => [call.url, call.method]), [["/api/notifications", "GET"], ["/api/notifications/note%2Fone/read", "PATCH"], ["/api/notifications/read-all", "PATCH"]]);
  assert.ok(calls.every(call => call.headers.get("Authorization") === null));
  assert.ok(calls.every(call => call.body === undefined));
});

test("notification errors and unconfirmed read operations never become fake success", async () => {
  const api = await load("api/notifications.js");
  const fetch = mockApiFetch(async () => Response.json({ message: "Forbidden" }, { status: 403 }));
  await assert.rejects(api.getNotifications(), /Forbidden/);
  fetch.mock.mockImplementation(async () => Response.json({ success: true, data: {} }));
  await assert.rejects(api.getNotifications(), /unexpected/i);
  await assert.rejects(api.markNotificationRead("one"), /confirm/i);
  fetch.mock.mockImplementation(async () => Response.json({ success: false, message: "Could not save" }));
  await assert.rejects(api.markAllNotificationsRead(), /Could not save/);
});

test("notification preview and unread-count adapters validate their server responses", async () => {
  const api = await load("api/notifications.js");
  const calls = [];
  const fetch = mockApiFetch(async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/preview")) return Response.json({ success: true, data: { notifications: [{ id: "one" }], unread_count: 4 } });
    return Response.json({ success: true, data: { unread_count: 4 } });
  });
  assert.deepEqual(await api.getNotificationPreview(), { notifications: [{ id: "one" }], unreadCount: 4 });
  assert.equal(await api.getNotificationUnreadCount(), 4);
  assert.deepEqual(calls, ["/api/notifications/preview", "/api/notifications/unread-count"]);

  fetch.mock.mockImplementation(async (url) => Response.json({ success: true, data: String(url).endsWith("/preview") ? { notifications: [], unread_count: -1 } : { unread_count: 1.5 } }));
  await assert.rejects(api.getNotificationPreview(), /unexpected/i);
  await assert.rejects(api.getNotificationUnreadCount(), /unexpected/i);
});

test("preview loading caches per account and marks only returned unread notifications", async () => {
  const feed = await load("components/notifications/notificationFeed.js");
  const calls = [];
  mockApiFetch(async (url, options) => {
    const path = String(url);
    calls.push([path, options.method || "GET"]);
    if (path.endsWith("/preview")) return Response.json({ success: true, data: { notifications: [
      { id: "unread", is_read: false },
      { id: "read", is_read: true },
    ], unread_count: 3 } });
    return Response.json({ success: true, data: { id: "unread", is_read: true } });
  });

  const result = await feed.loadNotificationPreview("account-one");
  assert.deepEqual(calls, [["/api/notifications/preview", "GET"], ["/api/notifications/unread/read", "PATCH"]]);
  assert.equal(result.notifications.find(item => item.id === "unread").is_read, true);
  assert.equal(result.unreadCount, 2);
  assert.deepEqual(feed.getCachedNotificationPreview("account-one"), result);
  assert.equal(feed.getCachedNotificationPreview("account-two"), null);
});

test("preview read failure keeps loaded records visible with a read error", async () => {
  const feed = await load("components/notifications/notificationFeed.js");
  mockApiFetch(async (url) => String(url).endsWith("/preview")
    ? Response.json({ success: true, data: { notifications: [{ id: "cannot-read", is_read: false }], unread_count: 1 } })
    : Response.json({ success: false, message: "Read unavailable" }, { status: 503 }));

  const result = await feed.loadNotificationPreview("read-failure-account");
  assert.deepEqual(result.notifications.map(item => item.id), ["cannot-read"]);
  assert.equal(result.unreadCount, 1);
  assert.match(result.readError, /Read unavailable/);
  assert.deepEqual(feed.getCachedNotificationPreview("read-failure-account"), result);
});

test("full notification loading includes the authoritative unread count", async () => {
  const feed = await load("components/notifications/notificationFeed.js");
  const calls = [];
  mockApiFetch(async (url) => {
    const path = String(url);
    calls.push(path);
    if (path.endsWith("/unread-count")) return Response.json({ success: true, data: { unread_count: 6 } });
    return Response.json({ success: true, data: [{ id: "full" }] });
  });

  const result = await feed.loadNotificationFeed("student", "full-account");
  assert.deepEqual(new Set(calls), new Set(["/api/notifications", "/api/notifications/unread-count"]));
  assert.equal(result.unreadCount, 6);
  assert.deepEqual(result.notifications, [{ id: "full" }]);
});

test("an unread-count failure does not discard a successfully loaded full feed", async () => {
  const feed = await load("components/notifications/notificationFeed.js");
  mockApiFetch(async (url) => String(url).endsWith("/unread-count")
    ? Response.json({ success: false, message: "Count unavailable" }, { status: 503 })
    : Response.json({ success: true, data: [{ id: "unread", is_read: false }, { id: "read", is_read: true }] }));

  const result = await feed.loadNotificationFeed("student", "count-failure-account");
  assert.deepEqual(result.notifications.map(item => item.id), ["unread", "read"]);
  assert.equal(result.unreadCount, 1);
  assert.match(result.warning, /count/i);
});

test("API resources can stay idle and retain cached data until enabled", async () => {
  const { initialApiResourceState } = await load("hooks/useApiResource.js");
  const cached = { notifications: [{ id: "cached" }] };
  assert.deepEqual(initialApiResourceState(false, cached), { data: cached, error: "", loading: false });
  assert.deepEqual(initialApiResourceState(true, cached), { data: cached, error: "", loading: true });
});

test("notification resource options keep preview lazy and full-page cached data active", async () => {
  const { notificationResourceOptions } = await server.ssrLoadModule("/src/components/notifications/useServerNotifications.js");
  const cached = { notifications: [{ id: "cached" }], unreadCount: 1 };
  assert.deepEqual(notificationResourceOptions(true, false, cached), { enabled: false, initialData: cached });
  assert.deepEqual(notificationResourceOptions(false, false, cached), { enabled: true, initialData: cached });
});

test("email preference writes use the authenticated profile endpoint and require a confirmed boolean", async () => {
  const api = await load("api/notifications.js");
  const calls = [];
  const fetch = mockApiFetch(async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: JSON.parse(options.body), auth: options.headers.get("Authorization") });
    return Response.json({ success: true, data: { email_notifications_enabled: true } });
  });
  assert.equal(await api.saveEmailNotificationPreference(true), true);
  assert.deepEqual(calls, [{ url: "/api/me/notification-preferences", method: "PATCH", body: { email_notifications_enabled: true }, auth: null }]);
  fetch.mock.mockImplementation(async () => Response.json({ message: "The route could not be found." }, { status: 404 }));
  await assert.rejects(api.saveEmailNotificationPreference(false), /route could not be found/i);
  fetch.mock.mockImplementation(async () => Response.json({ success: true, data: { email_notifications_enabled: "false" } }));
  await assert.rejects(api.saveEmailNotificationPreference(false), /confirm/i);
});

test("an unresponsive email preference request is cancelled instead of locking the switch indefinitely", async () => {
  const api = await load("api/notifications.js");
  const controller = new AbortController();
  mock.method(AbortSignal, "timeout", milliseconds => {
    if (milliseconds === 10000) return new AbortController().signal;
    assert.equal(milliseconds, 15000);
    return controller.signal;
  });
  mockApiFetch(async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    if (options.signal.aborted) throw options.signal.reason;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
  });
  const saving = api.saveEmailNotificationPreference(false);
  controller.abort(new DOMException("Request timed out", "TimeoutError"));
  await assert.rejects(saving, { name: "TimeoutError" });
});

test("staff feeds honor the saved request and threshold preferences without inventing decisions", async () => {
  const { notificationActivity } = await load("components/notifications/notificationData.js");
  const rows = [
    { id: "request", request_id: "r/one", type: "new_request", message: "Request updated", date_sent: "2026-10-22T08:00:00Z", is_read: true, channel: "in_app" },
    { id: "warning", request_id: "r/two", type: "threshold_warning", message: "Attendance warning", date_sent: "2026-10-23T08:00:00Z", is_read: false, channel: "in_app" },
    { id: "email", type: "request_decision", date_sent: "2026-10-23", channel: "email" },
    { id: "invalid", date_sent: "not-a-date" },
  ];
  const all = notificationActivity(rows, "instructor", { requestUpdates: true, thresholdAlerts: true });
  assert.deepEqual(all.map(item => item.id), ["warning", "request"]);
  assert.equal(all[1].href, "/instructor/class-requests?request=r%2Fone");
  assert.equal(all[1].isRead, true);
  assert.equal(all[1].status, undefined);
  assert.deepEqual(notificationActivity(rows, "instructor", { requestUpdates: false, thresholdAlerts: true }).map(item => item.id), ["warning"]);
  assert.deepEqual(notificationActivity(rows, "instructor", { requestUpdates: true, thresholdAlerts: false }).map(item => item.id), ["request"]);
  assert.equal(notificationActivity(rows, "instructor", { requestUpdates: false, thresholdAlerts: false }).length, 0);
});

test("staff notification UI reuses the student controls with correct destinations and server read labels", async () => {
  const Header = (await server.ssrLoadModule("/src/pages/auth/student/notifications/NotificationHeader.jsx")).default;
  const nodes = [];
  function visit(node) { if (!React.isValidElement(node)) return; nodes.push(node); React.Children.forEach(node.props.children, visit); }
  visit(Header({ notificationsPath: "/notifications", readStatusTitle: "Saved to your account" }));
  assert.ok(nodes.some(node => node.props.render?.props.to === "/notifications"));
  const View = (await server.ssrLoadModule("/src/pages/auth/student/notifications/NotificationsView.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(View, { activity: [{ id: "one", href: "/instructor/class-requests?request=one", message: "New class request", date: "2026-10-23" }], readStatusTitle: "Saved to your account", unreadTitle: "Unread in your account", reload() {} })));
  assert.match(html, /href="\/instructor\/class-requests\?request=one"/);
  assert.match(html, /Saved to your account/);
  assert.doesNotMatch(html, /href="\/student\/records/);
});

test("the instructor inbox keeps backend notifications from students, program heads and administrators", async () => {
  const { notificationActivity } = await load("components/notifications/notificationData.js");
  const rows = ["Student follow-up", "Program head notice", "Administrator notice"].map((message, index) => ({ id: `notice-${index}`, type: "request_update", message, date_sent: "2026-10-23T08:00:00Z", channel: "in_app", is_read: false }));
  const activity = notificationActivity(rows, "instructor", { requestUpdates: true, thresholdAlerts: true });
  assert.deepEqual(activity.map(item => item.message), rows.map(item => item.message));
  assert.ok(activity.every(item => item.href === "/instructor/class-requests"));
});

test("role-event notifications open the existing page that handles each interaction", async () => {
  const { notificationActivity } = await load("components/notifications/notificationData.js");
  const preferences = { requestUpdates: true, thresholdAlerts: true };
  const activity = (role, record) => notificationActivity([{ id: record.type, message: record.type, date_sent: "2026-10-28T08:00:00Z", is_read: false, ...record }], role, preferences)[0];

  assert.equal(activity("instructor", { type: "request_followup", request_id: "request/one" }).href, "/instructor/class-requests?request=request%2Fone");
  assert.equal(activity("admin", { type: "pending_staff_approval" }).href, "/user-management");
  assert.equal(activity("instructor", { type: "class_assignment" }).href, "/instructor/class-records");
  assert.equal(activity("program_head", { type: "program_head_assignment" }).href, "/program-head/instructors");
  assert.equal(activity("student", { type: "account_status_changed" }).href, "/settings");
  assert.equal(activity("program_head", { type: "threshold_critical", request_id: "request/two" }).href, "/program-head/activity-log?tab=flagged");
  assert.equal(activity("program_head", { type: "ir_escalation", request_id: "request/three" }).href, "/program-head/activity-log?tab=flagged");
  assert.equal(notificationActivity([{ id: "critical", type: "threshold_critical", user_id: "head", message: "Critical attendance threshold", date_sent: "2026-10-29T08:00:00Z" }], "program_head", { requestUpdates: true, thresholdAlerts: false }, "head").length, 0);
});

test("instructor feeds exclude personal student results but include the backend's email-channel new-request event", async () => {
  const { notificationActivity } = await load("components/notifications/notificationData.js");
  const rows = [
    { id: "personal", type: "request_decision", message: "Your absence request was marked invalid", date_sent: "2026-10-23", channel: "in_app" },
    { id: "personal-email", type: "request_updated", message: "Your instructor has taken action", date_sent: "2026-10-23", channel: "email" },
    { id: "incoming", type: "new_request", message: "A student submitted a new absence request", request_id: "incoming-request", date_sent: "2026-10-23", channel: "email" },
  ];
  const preferences = { requestUpdates: true, thresholdAlerts: true };
  assert.deepEqual(notificationActivity(rows, "instructor", preferences).map(item => item.id), ["incoming"]);
  assert.ok(notificationActivity(rows, "student", preferences).some(item => item.id === "personal"));
});

test("role-specific events and recipients cannot cross into another role's inbox", async () => {
  const { notificationActivity } = await load("components/notifications/notificationData.js");
  const types = ["request_decision", "request_updated", "new_request", "request_followup", "followup_flag", "threshold_warning", "threshold_critical", "ir_escalation", "pending_staff_approval", "class_assignment", "program_head_assignment", "account_role_changed", "account_status_changed", "school_notice"];
  const rows = types.map(type => ({ id: type, type, user_id: "owner", message: type, date_sent: "2026-10-23", channel: "in_app" }));
  const preferences = { requestUpdates: true, thresholdAlerts: true };
  const visible = role => notificationActivity(rows, role, preferences, "owner").map(item => item.id);
  assert.deepEqual(visible("student"), ["request_decision", "request_updated", "account_role_changed", "account_status_changed", "school_notice"]);
  assert.deepEqual(visible("instructor"), ["new_request", "request_followup", "threshold_warning", "threshold_critical", "ir_escalation", "class_assignment", "program_head_assignment", "account_role_changed", "account_status_changed", "school_notice"]);
  assert.deepEqual(visible("program_head"), ["followup_flag", "threshold_warning", "threshold_critical", "ir_escalation", "program_head_assignment", "account_role_changed", "account_status_changed", "school_notice"]);
  assert.deepEqual(visible("administrator"), ["pending_staff_approval", "account_role_changed", "account_status_changed", "school_notice"]);
  assert.equal(notificationActivity(rows, "instructor", preferences, "another-user").length, 0);
});

test("an instructor's absence notification is retained alongside late notifications regardless of delivery channel", async () => {
  const { notificationActivity } = await load("components/notifications/notificationData.js");
  const rows = [
    { id: "absence", user_id: "teacher", request_id: "absence-one", type: "new_request", message: "A student submitted a new absence request", date_sent: "2026-10-23T08:00:00Z", channel: "email" },
    { id: "late", user_id: "teacher", request_id: "late-one", type: "new_request", message: "Another student submitted a new late request", date_sent: "2026-10-22T08:00:00Z", channel: "in_app" },
    { id: "other-instructor", user_id: "another-teacher", type: "new_request", message: "Another class request", date_sent: "2026-10-23T09:00:00Z" },
  ];
  const activity = notificationActivity(rows, "instructor", { requestUpdates: true, thresholdAlerts: true }, "teacher");
  assert.deepEqual(activity.map(item => item.id), ["absence", "late"]);
  assert.equal(activity[0].href, "/instructor/class-requests?request=absence-one");
  assert.deepEqual(notificationActivity([], "instructor", { requestUpdates: true }, "teacher"), []);
});

test("preferences are separated by account role without losing existing student preferences", async () => {
  const { notificationPreferenceKey } = await server.ssrLoadModule("/src/hooks/useNotificationPreferences.js");
  assert.equal(notificationPreferenceKey("one", "student"), "alrm:student-preferences:one");
  assert.notEqual(notificationPreferenceKey("one", "instructor"), notificationPreferenceKey("one", "student"));
  assert.notEqual(notificationPreferenceKey("one", "instructor"), notificationPreferenceKey("one", "admin"));
  assert.equal(notificationPreferenceKey("one", "program_head"), notificationPreferenceKey("one", "program"));
});

test("all staff shells have a functional bell and the full notification page is protected", async () => {
  for (const path of ["pages/auth/instructor/InstructorPageLayout.jsx", "pages/auth/admin/AdminPageLayout.jsx", "components/navigation/DashboardPageLayout/DashboardHeader.jsx"]) {
    const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
    assert.match(source, /<NotificationBell user=\{user\}/);
  }
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/notifications" element=\{<ProtectedRoute><Notifications/);
  assert.match(app, /<InstructorRequests\s*\/>/);
});

test("settings remove Account & Security and use the working shared preference controls", async () => {
  const source = await readFile(new URL("../src/pages/auth/Settings.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /SecurityCard|Account & Security|Change Password|Manage Notifications/);
  assert.match(source, /<NotificationPreferences\s/);
  assert.ok(existsSync(new URL("../src/components/notifications/NotificationPreferences.jsx", import.meta.url)));
  const Preferences = (await server.ssrLoadModule("/src/components/notifications/NotificationPreferences.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Preferences, { userId: "instructor-one", role: "instructor" }));
  assert.match(html, /Request activity updates/);
  assert.match(html, /Attendance threshold alerts/);
  assert.match(html, /Email notifications/);
  assert.match(html, /id="notification-preference-email"/);
  assert.doesNotMatch(html, /School-managed/);
});

test("preference writes preserve rapid changes, existing settings, and account-role isolation", async () => {
  const { default: usePreferences, notificationPreferenceKey } = await server.ssrLoadModule("/src/hooks/useNotificationPreferences.js");
  const values = new Map();
  window.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let settings;
  function Probe({ id = "one", role = "student" }) { settings = usePreferences(id, role); return null; }
  const render = props => renderToStaticMarkup(React.createElement(Probe, props));
  render();
  settings.updatePreference("requestUpdates", false);
  settings.updatePreference("thresholdAlerts", false);
  const studentKey = notificationPreferenceKey("one", "student");
  assert.deepEqual(JSON.parse(values.get(studentKey)), { requestUpdates: false, thresholdAlerts: false });
  settings.updatePreference("requestUpdates", true);
  assert.deepEqual(JSON.parse(values.get(studentKey)), { requestUpdates: true, thresholdAlerts: false });
  render({ role: "instructor" });
  settings.updatePreference("thresholdAlerts", false);
  assert.deepEqual(JSON.parse(values.get(notificationPreferenceKey("one", "instructor"))), { requestUpdates: true, thresholdAlerts: false });
  render({ id: "two" });
  settings.updatePreference("requestUpdates", false);
  assert.deepEqual(JSON.parse(values.get(notificationPreferenceKey("two", "student"))), { requestUpdates: false, thresholdAlerts: true });
  const before = [...values];
  settings.updatePreference("email", true);
  settings.updatePreference("requestUpdates", "false");
  assert.deepEqual([...values], before, "unsupported email and malformed changes must never be saved");
});

test("the reference layout has accessible controls and uses the server's email preference", async () => {
  const Preferences = (await server.ssrLoadModule("/src/components/notifications/NotificationPreferences.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Preferences, { user: { id: "student-one", email_notifications_enabled: true } }));
  assert.match(html, /Excuse letter status updates/);
  assert.match(html, /Get notified immediately when an instructor approves, denies, or notes your excuse letter\./);
  assert.match(html, /Send copies of official portal notifications and clinic clearances to your registered email\./);
  assert.match(html, /20% absence threshold/);
  assert.doesNotMatch(html, /Request and threshold preferences are saved automatically/);
  for (const name of ["requestUpdates", "thresholdAlerts", "email"]) assert.match(html, new RegExp(`for="student-preference-${name}"`));
  const emailControl = html.match(/<span\b[^>]*aria-label="Email notifications"[^>]*>/)?.[0];
  assert.ok(emailControl);
  assert.match(emailControl, /aria-checked="true"/);
  assert.doesNotMatch(emailControl, /aria-disabled="true"/);
  assert.equal((html.match(/role="switch"/g) || []).length, 3);
  const unavailable = renderToStaticMarkup(React.createElement(Preferences, { user: { id: "student-one" } }));
  assert.match(unavailable.match(/<span\b[^>]*aria-label="Email notifications"[^>]*>/)?.[0] || "", /aria-disabled="true"/);
});

test("a student preview cannot load or display its student inbox inside the instructor bell", async () => {
  const Bell = (await server.ssrLoadModule("/src/components/notifications/NotificationBell.jsx")).default;
  const fetch = mockApiFetch(async () => { throw new Error("Preview must not load a different role's inbox"); });
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Bell, { user: { id: "student-preview", role: "student" }, audience: "instructor" })));
  assert.match(html, /instructor account required/i);
  assert.equal(fetch.mock.callCount(), 0);
  const source = await readFile(new URL("../src/components/notifications/NotificationBell.jsx", import.meta.url), "utf8");
  assert.match(source, /normalizeRole\(user\.role\) !== normalizeRole\(audience\)/);
});
