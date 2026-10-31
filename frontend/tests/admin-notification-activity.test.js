import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { mockApiFetch } from "./helpers/mockApiFetch.js";
import { getReadNotificationIds } from "../src/pages/auth/student/notifications/notificationReadStore.js";

const user = { id: "admin-one", role: "administrator" };
const programUser = { id: "program-one", role: "program_head" };
const oldLog = { id: "audit-old", action: "submitted_request", description: "Submitted a request", timestamp: "2026-10-28T08:00:00+08:00", actor: { id: "student-one", name: "Alex Student", role: "student" }, request: { id: "request-one", type: "absence", student: { id: "student-one", name: "Alex Student" }, class: { id: "class-one", subject_name: "Information Management" } } };
const newLog = { ...oldLog, id: "audit-new", action: "decided_request_approved", description: "Approved a request", timestamp: "2026-10-30T08:00:00+08:00", actor: { id: "instructor-one", name: "Jamie Instructor", role: "instructor" } };
let values;

beforeEach(() => {
  values = new Map([["auth_token", "test-token"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = new EventTarget();
  window.localStorage = storage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
});
afterEach(() => { mock.restoreAll(); delete globalThis.window; delete globalThis.localStorage; });

test("admin feed loads audit logs and keeps the first successful batch read", async () => {
  const { loadNotificationFeed } = await import("../src/components/notifications/notificationFeed.js");
  const calls = [];
  mockApiFetch(async url => {
    const path = new URL(String(url), "https://example.test").pathname;
    calls.push(path);
    if (path === "/api/notifications/unread-count") return Response.json({ success: true, data: { unread_count: 0 } });
    return Response.json({ success: true, data: path === "/api/admin/audit-logs" ? [oldLog] : [] });
  });

  const feed = await loadNotificationFeed(user.role, user.id);

  assert.deepEqual(calls.sort(), ["/api/admin/audit-logs", "/api/notifications", "/api/notifications/unread-count"]);
  assert.deepEqual(feed.auditLogs, [oldLog]);
  assert.deepEqual([...feed.auditReadIds], ["audit-log:audit-old"]);
});

test("a failed audit request does not baseline unseen activity before recovery", async () => {
  const { loadNotificationFeed } = await import("../src/components/notifications/notificationFeed.js");
  let failing = true;
  mockApiFetch(async url => {
    const path = new URL(String(url), "https://example.test").pathname;
    if (path === "/api/admin/audit-logs" && failing) return Response.json({ message: "Audit unavailable" }, { status: 503 });
    return Response.json({ success: true, data: path === "/api/admin/audit-logs" ? [oldLog] : [] });
  });

  const partial = await loadNotificationFeed(user.role, user.id);
  failing = false;
  const recovered = await loadNotificationFeed(user.role, user.id);

  assert.match(partial.warning, /activity log/i);
  assert.deepEqual([...recovered.auditReadIds], ["audit-log:audit-old"]);
});

test("admin activity after the initial audit baseline arrives unread", async () => {
  const { mergeAdminAuditActivity } = await import("../src/components/notifications/notificationData.js");
  const activity = mergeAdminAuditActivity([], [oldLog, newLog], user, new Set(["audit-log:audit-old"]));
  assert.deepEqual(activity.map(item => [item.id, item.isRead]), [["audit-log:audit-new", false], ["audit-log:audit-old", true]]);
  assert.equal(activity[0].href, "/activity-log");
  assert.equal(activity[0].message, "Jamie Instructor approved a request for Alex Student in Information Management.");
});

test("program-head feed loads its scoped audit endpoint and baselines existing rows", async () => {
  const { loadNotificationFeed } = await import("../src/components/notifications/notificationFeed.js");
  const calls = [];
  mockApiFetch(async url => {
    const path = new URL(String(url), "https://example.test").pathname;
    calls.push(path);
    if (path === "/api/notifications/unread-count") return Response.json({ success: true, data: { unread_count: 0 } });
    return Response.json({ success: true, data: path === "/api/program-head/audit-logs" ? [oldLog] : [] });
  });

  const feed = await loadNotificationFeed(programUser.role, programUser.id);

  assert.deepEqual(calls.sort(), ["/api/notifications", "/api/notifications/unread-count", "/api/program-head/audit-logs"]);
  assert.deepEqual(feed.auditLogs, [oldLog]);
  assert.deepEqual([...feed.auditReadIds], ["audit-log:audit-old"]);
});

test("new program-head audit activity links to the program activity log", async () => {
  const { mergeProgramAuditActivity } = await import("../src/components/notifications/notificationData.js");
  const [item] = mergeProgramAuditActivity([], [newLog], programUser, new Set());
  assert.equal(item.isRead, false);
  assert.equal(item.href, "/program-head/activity-log");
  assert.equal(item.readKey, `program-activity:${programUser.id}`);
});

test("server notifications replace matching activity-log notifications for every audit action", async () => {
  const { mergeProgramAuditActivity } = await import("../src/components/notifications/notificationData.js");
  const cases = [
    ["submitted_request", "Submitted a request", "Alex Student submitted a request"],
    ["updated_request", "Updated a request", "Alex Student updated a request"],
    ["cancelled_request", "Cancelled a request", "Alex Student cancelled a request"],
    ["followed_up_request", "Followed up a request", "Alex Student followed up a request"],
    ["decided_request_approved", "Approved a request", "Jamie Instructor approved a request"],
    ["decided_request_noted", "Noted a request", "Jamie Instructor noted a request"],
    ["decided_request_invalid", "Marked a request invalid", "Jamie Instructor marked a request invalid"],
    ["resolved_followup_flag", "Resolved a follow-up", "Jamie Instructor resolved a follow-up"],
  ];
  for (const [action, description, message] of cases) {
    const log = { ...oldLog, id: `audit-${action}`, action, description };
    const serverItem = { id: `server-${action}`, type: "school_notice", requestId: "request-one", message, date: oldLog.timestamp, isRead: false, href: "/program-head/requests" };
    assert.deepEqual(mergeProgramAuditActivity([serverItem], [log], programUser, new Set()), [serverItem], action);
  }
});

test("reading an admin audit notification stays local and never PATCHes a server notification", async () => {
  const { markFeedRead } = await import("../src/components/notifications/notificationFeed.js");
  const { mergeAdminAuditActivity } = await import("../src/components/notifications/notificationData.js");
  const fetch = mockApiFetch(async () => { throw new Error("Local activity must not call the server notification API"); });
  const [item] = mergeAdminAuditActivity([], [newLog], user, new Set());

  await markFeedRead(user.id, [item]);

  assert.equal(fetch.mock.callCount(), 0);
  assert.ok(getReadNotificationIds(`admin-activity:${user.id}`, window.localStorage).has(item.id));
});
