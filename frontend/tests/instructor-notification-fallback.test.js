import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { notificationActivity } from "../src/components/notifications/notificationData.js";
import { getReadNotificationIds } from "../src/pages/auth/student/notifications/notificationReadStore.js";

const user = { id: "instructor-one", role: "instructor" };
const preferences = { requestUpdates: true, thresholdAlerts: true };
const request = { id: "missing-absence", type: "absence", status: "pending", subjects_missed: "Old subject name", date_submitted: "2026-10-15T02:34:33Z", enrollment: { student: { name: "Marwin" }, class: { instructor_id: user.id, subject_name: "Financial Literacy and Personal Management" } } };
const note = { id: "server-note", user_id: user.id, request_id: "late-one", type: "new_request", message: "Another student submitted a new late request.", date_sent: "2026-10-21T22:37:41Z", is_read: true, channel: "email" };
let server;
let values;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });
beforeEach(() => {
  values = new Map([["auth_token", "test-token"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = new EventTarget();
  window.localStorage = storage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
});
afterEach(() => { mock.restoreAll(); delete globalThis.window; delete globalThis.localStorage; });
const dataModule = () => import("../src/components/notifications/notificationData.js");
const feedModule = () => import("../src/components/notifications/notificationFeed.js");

test("missing absence activity appears alongside existing late notifications using actual class data", async () => {
  const { mergeRequestActivity } = await dataModule();
  const existing = notificationActivity([note], user.role, preferences, user.id);
  const activity = mergeRequestActivity(existing, [request], user);
  assert.deepEqual(activity.map(item => item.requestId), ["late-one", "missing-absence"]);
  assert.equal(activity[1].message, "Marwin submitted a new absence request for Financial Literacy and Personal Management.");
  assert.equal(activity[1].date, request.date_submitted);
  assert.equal(activity[1].href, "/instructor/class-requests?request=missing-absence");
  assert.equal(activity[1].source, "request");
  assert.equal(activity[1].isRead, false);
});

test("server new-request notifications replace fallback entries without losing unrelated events", async () => {
  const { mergeRequestActivity } = await dataModule();
  const incoming = { ...note, request_id: request.id };
  const warning = { ...note, id: "warning", type: "threshold_warning", request_id: request.id };
  const notices = notificationActivity([incoming, { ...incoming, id: "duplicate" }, warning], user.role, preferences, user.id);
  assert.deepEqual(mergeRequestActivity(notices, [request, request], user).map(item => item.id), ["server-note", "warning"]);
  const thresholdOnly = notificationActivity([warning], user.role, preferences, user.id);
  assert.equal(mergeRequestActivity(thresholdOnly, [request], user).length, 2);
});

test("fallbacks remain instructor-scoped and skip malformed, unsupported and duplicate requests", async () => {
  const { mergeRequestActivity } = await dataModule();
  const rows = [request, request, { ...request, id: "other-class", enrollment: { ...request.enrollment, class: { ...request.enrollment.class, instructor_id: "other-instructor" } } }, { ...request, id: "bad-date", date_submitted: "invalid" }, { ...request, id: "bad-type", type: "other" }, { ...request, id: "no-student", enrollment: { class: request.enrollment.class } }];
  assert.equal(mergeRequestActivity([], rows, user).length, 1);
  for (const role of ["student", "program_head", "admin"]) assert.deepEqual(mergeRequestActivity([], rows, { ...user, role }), []);
});

test("fallback read status survives reloads per instructor, and server read state stays authoritative", async () => {
  const { mergeRequestActivity } = await dataModule();
  const { markFeedRead } = await feedModule();
  const fetch = mockApiFetch(async () => { throw new Error("No server notification exists for this entry"); });
  const [item] = mergeRequestActivity([], [request], user);
  await markFeedRead(user.id, [item]);
  const readIds = getReadNotificationIds(`instructor:${user.id}`, window.localStorage);
  assert.equal(mergeRequestActivity([], [request], user, readIds)[0].isRead, true);
  assert.equal(getReadNotificationIds("instructor:other", window.localStorage).size, 0);
  assert.equal(getReadNotificationIds(user.id, window.localStorage).size, 0);
  const incoming = notificationActivity([{ ...note, request_id: request.id, is_read: false }], user.role, preferences, user.id);
  assert.equal(mergeRequestActivity(incoming, [request], user, readIds)[0].isRead, false);
  assert.equal(fetch.mock.callCount(), 0);
});

test("mixed read operations PATCH real notification IDs only and save request activity locally", async () => {
  const { mergeRequestActivity } = await dataModule();
  const { markFeedRead } = await feedModule();
  const calls = [];
  mockApiFetch(async (url, options) => {
    calls.push([String(url), options.method]);
    return Response.json({ success: true, data: { id: note.id, is_read: true } });
  });
  const activity = mergeRequestActivity(notificationActivity([note], user.role, preferences, user.id), [request], user);
  await markFeedRead(user.id, activity);
  assert.deepEqual(calls, [["/api/notifications/server-note/read", "PATCH"]]);
  assert.ok(getReadNotificationIds(`instructor:${user.id}`, window.localStorage).has(activity[1].id));
  calls.length = 0;
  await markFeedRead(user.id, activity, true);
  assert.deepEqual(calls, [["/api/notifications/read-all", "PATCH"]]);
});

test("failed server reads and blocked storage never claim fallback read success", async () => {
  const { mergeRequestActivity } = await dataModule();
  const { markFeedRead } = await feedModule();
  const [item] = mergeRequestActivity([], [request], user);
  mockApiFetch(async () => Response.json({ message: "Could not save" }, { status: 503 }));
  await assert.rejects(markFeedRead(user.id, [item, { id: "server" }]), /Could not save/);
  assert.equal(getReadNotificationIds(`instructor:${user.id}`, window.localStorage).size, 0);
  window.localStorage.setItem = () => { throw new Error("Storage blocked"); };
  await assert.rejects(markFeedRead(user.id, [item]), /Storage blocked/);
});

test("feed loading fetches role-appropriate endpoints and preserves partial results", async () => {
  const { loadNotificationFeed } = await feedModule();
  const calls = [];
  const fetch = mockApiFetch(async (url, options) => {
    calls.push(String(url));
    assert.equal(options.headers.get("Authorization"), null);
    if (String(url).endsWith("/unread-count")) return Response.json({ success: true, data: { unread_count: 1 } });
    return Response.json({ success: true, data: String(url).endsWith("/notifications") ? [note] : [request] });
  });
  const result = await loadNotificationFeed("instructor");
  assert.deepEqual(result.notifications, [note]);
  assert.deepEqual(result.requests, [request]);
  assert.equal(result.warning, "");
  assert.deepEqual(calls.sort(), ["/api/instructor/requests", "/api/notifications", "/api/notifications/unread-count"]);
  calls.length = 0;
  await loadNotificationFeed("administrator");
  assert.deepEqual(calls.sort(), ["/api/admin/audit-logs?page=1&per_page=100", "/api/notifications", "/api/notifications/unread-count"]);
  fetch.mock.mockImplementation(async url => String(url).endsWith("/notifications") ? Response.json({ message: "Notifications unavailable" }, { status: 503 })
    : String(url).endsWith("/unread-count") ? Response.json({ success: true, data: { unread_count: 0 } }) : Response.json({ success: true, data: [request] }));
  const partial = await loadNotificationFeed("instructor");
  assert.deepEqual(partial.requests, [request]);
  assert.match(partial.warning, /notifications/i);
  fetch.mock.mockImplementation(async url => String(url).endsWith("/notifications") ? Response.json({ success: true, data: [note] })
    : String(url).endsWith("/unread-count") ? Response.json({ success: true, data: { unread_count: 1 } }) : Response.json({ success: true, data: {} }));
  const malformed = await loadNotificationFeed("instructor");
  assert.deepEqual(malformed.notifications, [note]);
  assert.match(malformed.warning, /request/i);
  fetch.mock.mockImplementation(async () => Response.json({ message: "Service unavailable" }, { status: 503 }));
  await assert.rejects(loadNotificationFeed("instructor"), /Service unavailable/);
});

test("fallback entries disclose browser-local reads and partial errors do not hide valid activity", async () => {
  const { mergeRequestActivity } = await dataModule();
  const Panel = (await server.ssrLoadModule("/src/pages/auth/student/notifications/NotificationPanel.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Panel, { activity: mergeRequestActivity([], [request], user), readIds: new Set(), unreadTitle: "Unread in your account", warning: "Notifications could not be loaded.", onRefresh() {} })));
  assert.match(html, /Marwin submitted/);
  assert.match(html, /Notifications could not be loaded/);
  assert.match(html, /Unread request activity on this browser/);
  assert.match(html, /read status is saved on this browser/i);
});
