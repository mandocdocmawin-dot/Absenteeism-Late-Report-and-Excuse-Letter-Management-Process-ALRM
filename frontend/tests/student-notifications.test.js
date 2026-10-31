import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
});
after(async () => { await server?.close(); });
beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "test-token" } });
});
afterEach(() => { mock.restoreAll(); delete globalThis.localStorage; });

async function loadActivity() {
  const { loadRequestActivity } = await import("../src/pages/auth/student/notifications/notificationData.js");
  return loadRequestActivity();
}

test("bell activity excludes the student's submission and appears after an instructor decision", async () => {
  const record = { id: "request-1", type: "absence", subjects_missed: "Math", status: "pending", date_submitted: "2026-10-18T09:00:00Z" };
  mockApiFetch(async (url, options) => {
    assert.ok(String(url).endsWith("/api/requests"));
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.headers.get("Authorization"), null);
    return Response.json({ success: true, data: [record] });
  });
  assert.deepEqual(await loadActivity(), []);
  record.status = "approved";
  record.date_reviewed = "2026-10-19T09:00:00Z";
  const refreshed = await loadActivity();
  assert.equal(refreshed[0].id, "request-1-reviewed");
  assert.match(refreshed[0].message, /Math approved/);
});

test("bell activity distinguishes no updates from backend failures and malformed data", async () => {
  mockApiFetch(async () => Response.json({ success: true, data: [] }));
  assert.deepEqual(await loadActivity(), []);
  mockApiFetch(async () => Response.json({ message: "Service unavailable" }, { status: 503 }));
  await assert.rejects(loadActivity(), /Service unavailable/);
  mockApiFetch(async () => Response.json({ success: true, data: {} }));
  await assert.rejects(loadActivity(), /unexpected/i);
});

async function renderPanel(props) {
  const Panel = (await server.ssrLoadModule("/src/pages/auth/student/notifications/NotificationPanel.jsx")).default;
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Panel, { onRefresh() {}, onClose() {}, ...props })));
}

test("notification entries link to the specific request, not a generic dashboard", async () => {
  const html = await renderPanel({ activity: [{ id: "event", requestId: "request /1", message: "Math approved.", status: "approved", date: "2026-10-19T09:00:00Z" }] });
  assert.match(html, /href="\/student\/records\?request=request%20%2F1"/);
  assert.match(html, /Math approved/);
  assert.match(html, /<time/);
});

test("notification panel keeps cached entries visible during refresh", async () => {
  const activity = [{ id: "event", requestId: "r", message: "Old update", date: "2026-10-19" }];
  const loading = await renderPanel({ loading: true, activity });
  assert.doesNotMatch(loading, /role="status"/);
  assert.match(loading, /Old update/);
});

test("notification panel shows initial loading, retryable errors, and empty results", async () => {
  const activity = [{ id: "event", requestId: "r", message: "Old update", date: "2026-10-19" }];
  const initial = await renderPanel({ loading: true, activity: [] });
  assert.match(initial, /role="status"/);
  const failed = await renderPanel({ error: "Cannot load requests", activity });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /Old update/);
  assert.match(await renderPanel({ activity: [] }), /No recent request updates/);
});

test("mark all read persists per account and does not mark later decisions as read", async () => {
  const { getReadNotificationIds, markNotificationsRead } = await import("../src/pages/auth/student/notifications/notificationReadStore.js");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  markNotificationsRead("student-1", ["r1-submitted", "r2-submitted"], storage);
  assert.deepEqual([...getReadNotificationIds("student-1", storage)], ["r1-submitted", "r2-submitted"]);
  assert.equal(getReadNotificationIds("student-2", storage).size, 0);
  assert.equal(getReadNotificationIds("student-1", storage).has("r1-reviewed"), false);
  markNotificationsRead("student-1", ["r1-submitted", "r1-reviewed"], storage);
  assert.equal(getReadNotificationIds("student-1", storage).size, 3);
});

test("unread notification markers disappear only for acknowledged event IDs", async () => {
  const activity = [
    { id: "r1-submitted", requestId: "r1", message: "Math submitted", status: "pending", date: "2026-10-18" },
    { id: "r1-reviewed", requestId: "r1", message: "Math approved", status: "approved", date: "2026-10-19" },
  ];
  const unread = await renderPanel({ activity, readIds: new Set() });
  assert.equal((unread.match(/Unread on this browser/g) || []).length, 2);
  const partial = await renderPanel({ activity, readIds: new Set(["r1-submitted"]) });
  assert.equal((partial.match(/Unread on this browser/g) || []).length, 1);
  const read = await renderPanel({ activity, readIds: new Set(activity.map((item) => item.id)) });
  assert.doesNotMatch(read, /Unread on this browser/);
  assert.match(read, /Math approved/);
});

test("notification read storage tolerates corrupt data without silently claiming a failed save", async () => {
  const { getReadNotificationIds, markNotificationsRead } = await import("../src/pages/auth/student/notifications/notificationReadStore.js");
  const storage = { getItem: () => "broken JSON", setItem() { throw new Error("Storage blocked"); } };
  assert.equal(getReadNotificationIds("student-1", storage).size, 0);
  assert.throws(() => markNotificationsRead("student-1", ["event"], storage), /Storage blocked/);
  assert.equal(getReadNotificationIds("student-1", storage).has("event"), false);
});

test("notification menu links navigate to existing settings and notification destinations", async () => {
  const Header = (await server.ssrLoadModule("/src/pages/auth/student/notifications/NotificationHeader.jsx")).default;
  let marked = false;
  let closed = false;
  const tree = Header({ onClose: () => { closed = true; }, canMarkAll: true, onMarkAll: () => { marked = true; } });
  const nodes = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    nodes.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(tree);
  const links = nodes.filter((node) => node.props.render?.props.to);
  assert.deepEqual(links.map((node) => node.props.render.props.to), ["/settings", "/student/notifications"]);
  links[0].props.onClick();
  assert.equal(closed, true);
  const markAll = nodes.find((node) => React.Children.toArray(node.props.children).includes("Mark all as read"));
  assert.equal(markAll.props.disabled, false);
  markAll.props.onClick();
  assert.equal(marked, true);
});

test("notification page loads activity beyond the dropdown preview", async () => {
  const records = Array.from({ length: 9 }, (_, index) => ({
    id: `r${index}`, type: "late", status: "approved", subjects_missed: "Math",
    date_submitted: `2026-10-${String(index + 1).padStart(2, "0")}`,
    date_reviewed: `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
  }));
  mockApiFetch(async () => Response.json({ success: true, data: records }));
  const activity = await loadActivity();
  assert.equal(activity.length, 9);
  assert.equal(activity[0].requestId, "r8");
  assert.equal(activity[8].requestId, "r0");
});

test("notification page unread filter preserves history while showing only unread events", async () => {
  const View = (await server.ssrLoadModule("/src/pages/auth/student/notifications/NotificationsView.jsx")).default;
  const props = {
    activity: [
      { id: "r-submitted", requestId: "r", message: "Math submitted", status: "pending", date: "2026-10-18" },
      { id: "r-reviewed", requestId: "r", message: "Math approved", status: "approved", date: "2026-10-19" },
    ],
    readIds: new Set(["r-submitted"]), canMarkAll: true, onFilterChange() {}, markAllRead() {}, markRead() {}, reload() {},
  };
  const render = (filter, overrides = {}) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(View, { ...props, filter, ...overrides })));
  const all = render("all");
  assert.match(all, /Math submitted/);
  assert.match(all, /Math approved/);
  assert.match(all, /href="\/settings"/);
  const unread = render("unread");
  assert.doesNotMatch(unread, /Math submitted/);
  assert.match(unread, /Math approved/);
  assert.doesNotMatch(unread, /View all notifications/);
  const read = render("unread", { readIds: new Set(["r-submitted", "r-reviewed"]) });
  assert.match(read, /No unread notifications/);
  assert.match(render("all", { readIds: new Set(["r-submitted", "r-reviewed"]) }), /Math approved/);
});
