import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server, useNotifications;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "account-feed-fixture", enforce: "pre", transform(code, id) {
      const path = id.replaceAll("\\", "/");
      if (path.endsWith("/src/hooks/useApiResource.js")) return `export function useApiResource() { return globalThis.__accountFeedResource; }`;
      if (path.endsWith("/src/hooks/useNotificationPreferences.js")) return `export default function useNotificationPreferences() { return { preferences: { requestUpdates: false, thresholdAlerts: false } }; }`;
      if (path.endsWith("/src/pages/auth/student/notifications/useNotificationReadState.js")) return `export default function useNotificationReadState() { return { readIds: new Set() }; }`;
    },
  }] });
  useNotifications = (await server.ssrLoadModule("/src/components/notifications/useServerNotifications.js")).default;
});
after(async () => { delete globalThis.__accountFeedResource; await server?.close(); });

test("account preview retains historical records and uses unread total independently of current alert settings", () => {
  for (const unreadCount of [0, 4]) {
    globalThis.__accountFeedResource = { data: { notifications: [
      { id: "old", user_id: "account", type: "request_decision", message: "Earlier decision", date_sent: "2026-11-02T08:00:00Z", is_read: true },
    ], unreadCount }, loading: false, error: "", reload() {} };
    let feed;
    function Probe() { feed = useNotifications({ id: "account", role: "administrator" }, { preview: true }); return null; }
    renderToStaticMarkup(React.createElement(Probe));
    assert.equal(feed.unreadCount, unreadCount);
    assert.equal(feed.activity.length, 1);
    assert.equal(feed.activity[0].message, "Earlier decision");
    assert.equal(feed.activity[0].isRead, true);
  }
});
