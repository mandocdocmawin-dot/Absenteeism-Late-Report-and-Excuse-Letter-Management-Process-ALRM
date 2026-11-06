import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

const overall = {
  used: 8, limit: 83.2, total_semester_hours: 416, absence_percentage: 1.92,
  remaining_hours: 75.2, remaining_semester_percentage: 18.08, status: "safe",
};
const subjects = [{
  class_id: "class-one", subject_name: "Security", absences: 3, used_hours: 8,
  total_semester_hours: 80, absence_percentage: 10, ir_absence_limit: 3, status: "IR",
}];

test("dashboard attendance keeps overall and per-subject thresholds together", async () => {
  const { dashboardAttendance } = await server.ssrLoadModule("/src/pages/auth/student/useStudentDashboardResources.js");
  assert.deepEqual(dashboardAttendance({ threshold: overall, subject_thresholds: subjects }), { ...overall, subject_thresholds: subjects });
  assert.throws(() => dashboardAttendance({ threshold: overall, subject_thresholds: {} }), /unexpected response/i);
  assert.throws(() => dashboardAttendance({ threshold: overall, subject_thresholds: [null] }), /unexpected response/i);
});

test("student threshold shows the overall allowance without a subject list", async () => {
  const Threshold = (await server.ssrLoadModule("/src/pages/auth/student/dashboard/AttendanceThreshold.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Threshold, { threshold: { ...overall, subject_thresholds: subjects } }));

  for (const text of ["Overall Attendance", "Allowance used", "1.92%", "75.2 hours", "18.08%", "Overall status:", "Safe"]) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /role="progressbar"/);
  assert.doesNotMatch(html, /Subject attendance|Security|IR at 3 absences|Incident Report/);
  assert.doesNotMatch(html, /80%|NaN|Backend result/i);
});

test("student threshold handles no subjects and unavailable numbers honestly", async () => {
  const Threshold = (await server.ssrLoadModule("/src/pages/auth/student/dashboard/AttendanceThreshold.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Threshold, {
    threshold: { used: "invalid", limit: null, absence_percentage: undefined, remaining_hours: "", remaining_semester_percentage: null, status: "safe", subject_thresholds: [] },
  }));
  assert.doesNotMatch(html, /Subject attendance|No enrolled subjects available/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /NaN/);
});
