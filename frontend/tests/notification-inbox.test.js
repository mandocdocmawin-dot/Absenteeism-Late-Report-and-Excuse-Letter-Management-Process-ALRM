import test from "node:test";
import assert from "node:assert/strict";
import { notificationActivity } from "../src/components/notifications/notificationData.js";

test("account inbox retains old read and unread notices despite disabled alert preferences or changed roles", () => {
  const records = [
    { id: "old", user_id: "owner", type: "request_decision", message: "Your earlier request was approved.", date_sent: "2026-10-01T08:00:00Z", is_read: true },
    { id: "new", user_id: "owner", type: "threshold_warning", message: "Attendance warning", date_sent: "2026-11-03T08:00:00Z", is_read: false },
    { id: "other", user_id: "other", message: "Private", date_sent: "2026-11-03T08:00:00Z" },
  ];
  const activity = notificationActivity(records, "instructor", { requestUpdates: false, thresholdAlerts: false }, "owner", { inbox: true });
  assert.deepEqual(activity.map(item => item.id), ["new", "old"]);
  assert.equal(activity[1].isRead, true);
  assert.equal(activity[0].isRead, false);
});
