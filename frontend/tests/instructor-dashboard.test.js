import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
const root = "/src/pages/auth/instructor/dashboard/";
const load = name => server.ssrLoadModule(`${root}${name}`);
const course = { id: "class-one", subject_name: "Data Structure", section: "BSIS 3A", semester: "1st", school_year: "2026-2027", schedule: [{ day: "Mon", start: "09:00", end: "11:00" }] };
const now = new Date("2026-10-24T04:00:00Z");
function report(id, type = "absence", fields = {}) {
  return { id, type, status: "pending", date_submitted: "2026-10-24T01:00:00Z", enrollment: { student: { id: "student-one", name: "Alex Cruz" }, class: course }, ...fields };
}
const dashboard = { total_students: 142, total_classes: 4, pending_requests: [report("one"), report("two", "late")], flagged_students: [{ student: { id: "student-one", name: "Alex Cruz" }, class: "Data Structure", status: "warning", absences: 4 }] };
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });
afterEach(() => mock.restoreAll());

test("overview counts reported requests, deduplicates IDs, and preserves authoritative student and pending totals", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const rows = [report("one"), report("two", "late", { date_submitted: "2026-10-23T16:30:00Z" }), report("old", "absence", { status: "approved", date_submitted: "2026-10-20T04:00:00Z" }), report("past", "late", { date_submitted: "2026-10-18T04:00:00Z" })];
  const overview = buildInstructorOverview(dashboard, [...rows, rows[0], report("cancelled", "absence", { status: "cancelled" }), report("unsupported", "other")], now);
  assert.equal(overview.totalStudents, 142);
  assert.equal(overview.totalClasses, 4);
  assert.deepEqual(overview.today, { absences: 1, lates: 1 });
  assert.deepEqual(overview.pending, { absences: 1, lates: 1, total: 2 });
  assert.equal(overview.courses.length, 1);
  assert.equal(overview.courses[0].absences, 2);
  assert.equal(overview.courses[0].lates, 2);
  assert.equal(overview.courses[0].weeklyAbsences, 2);
  assert.equal(overview.courses[0].weeklyLates, 1);
  assert.equal(overview.courses[0].schedule, "Mon 9:00 AM-11:00 AM");
  assert.equal(rows[0].status, "pending");
});

test("reporting weeks start Monday in Philippine time, not the browser timezone", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const rows = [report("sunday", "absence", { date_submitted: "2026-10-25T15:59:00Z" }), report("monday", "late", { date_submitted: "2026-10-25T16:01:00Z" }), report("invalid", "absence", { date_submitted: "invalid" })];
  const overview = buildInstructorOverview(dashboard, rows, new Date("2026-10-25T16:30:00Z"));
  assert.equal(overview.week.start, "2026-10-26");
  assert.equal(overview.week.end, "2026-11-01");
  assert.deepEqual(overview.today, { absences: 0, lates: 1 });
  assert.equal(overview.courses[0].weeklyAbsences, 0);
  assert.equal(overview.courses[0].weeklyLates, 1);
});

test("previous weeks expose historical absences without changing today's metrics or semester totals", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const rows = [report("absence", "absence", { date_submitted: "2026-10-15T02:34:33Z" }), report("late-one", "late", { date_submitted: "2026-10-19T16:36:40Z" }), report("late-two", "late", { date_submitted: "2026-10-21T22:37:40Z" })];
  const current = buildInstructorOverview(dashboard, rows, now);
  const previous = buildInstructorOverview(dashboard, rows, now, -1);
  assert.equal(current.courses[0].weeklyAbsences, 0);
  assert.equal(current.courses[0].weeklyLates, 2);
  assert.equal(current.week.hasPrevious, true);
  assert.equal(current.week.hasNext, false);
  assert.equal(previous.week.start, "2026-10-12");
  assert.equal(previous.week.end, "2026-10-18");
  assert.equal(previous.courses[0].weeklyAbsences, 1);
  assert.equal(previous.courses[0].weeklyLates, 0);
  assert.equal(previous.courses[0].absences, 1);
  assert.deepEqual(previous.today, current.today);
  assert.equal(previous.week.hasPrevious, false);
  assert.equal(previous.week.hasNext, true);
});

test("same-named courses remain separate and missing totals or schedules are not fabricated", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const second = { ...course, id: "class-two", section: "BSIS 3B", schedule: [] };
  const overview = buildInstructorOverview({ pending_requests: [], flagged_students: [] }, [report("one"), report("two", "late", { enrollment: { student: { id: "student-two", name: "Jamie Cruz" }, class: second } })], now);
  assert.equal(overview.totalStudents, null);
  assert.equal(overview.totalClasses, null);
  assert.deepEqual(overview.courses.map(row => row.id), ["class-one", "class-two"]);
  assert.equal(overview.courses[1].schedule, "Not provided");
  assert.equal(overview.courses[1].absences, 0);
});

test("dashboard loading uses only the existing instructor APIs and rejects malformed or failed results", async () => {
  const { loadInstructorOverview } = await load("overviewData.js");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "isolated-dashboard-token" } });
  try {
    const calls = [];
    const fetch = mockApiFetch(async (url, options) => {
      const path = new URL(url, "http://localhost").pathname;
      calls.push(path);
      assert.equal(options.headers.get("Authorization"), null);
      assert.ok(!options.method || options.method === "GET");
      return Response.json({ success: true, data: path.endsWith("/dashboard") ? dashboard : [report("one")] });
    });
    const result = await loadInstructorOverview();
    assert.deepEqual(calls.sort(), ["/api/instructor/dashboard", "/api/instructor/requests"]);
    assert.equal(result.dashboard.total_students, 142);
    assert.equal(result.requests.length, 1);
    const history = Array.from({ length: 601 }, (_, index) => report(`history-${index}`));
    const pages = [];
    fetch.mock.mockImplementation(async input => {
      const url = new URL(input, "http://localhost");
      if (url.pathname.endsWith("/dashboard")) return Response.json({ success: true, data: dashboard });
      assert.equal(url.searchParams.get("per_page"), "100");
      const page = Number(url.searchParams.get("page") || 1);
      pages.push(page);
      return Response.json({ success: true, data: history.slice((page - 1) * 100, page * 100), meta: { page, per_page: 100, last_page: 7, total: 601 } });
    });
    const complete = await loadInstructorOverview();
    assert.equal(complete.requests.length, 601);
    assert.deepEqual(pages, [1, 2, 3, 4, 5, 6, 7]);
    fetch.mock.mockImplementation(async input => Response.json({ success: true, data: String(input).includes("/dashboard") ? dashboard : [], meta: { page: 0, last_page: 1 } }));
    await assert.rejects(loadInstructorOverview(), /pagination/i);
    fetch.mock.mockImplementation(async () => Response.json({ success: true, data: {} }));
    await assert.rejects(loadInstructorOverview(), /unexpected/i);
    fetch.mock.mockImplementation(async () => Response.json({ message: "Dashboard unavailable" }, { status: 503 }));
    await assert.rejects(loadInstructorOverview(), /Dashboard unavailable/);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
  }
});

test("the dashboard renders the supplied layout with report labels, real identity and working record/request links", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const Overview = (await load("InstructorOverview.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, { user: { name: "Ana Santos" }, overview: buildInstructorOverview(dashboard, [report("one"), report("two", "late")], now) })));
  for (const text of ["Welcome, Prof. Ana Santos!", "Total students", "Absence reports today", "Late reports today", "Pending requests", "Weekly Bar Chart", "Semester Summary Table", "Attendance Notice", "Data Structure", "BSIS 3A", "142", "Alex Cruz"]) assert.ok(html.includes(text), text);
  assert.match(html, /href="\/instructor\/class-records\/class-one"/);
  assert.match(html, /href="\/instructor\/class-requests/);
  assert.doesNotMatch(html, />Approve<|>Mark Invalid<|Requests for review/);
});

test("no reports or warnings display honest empty states and no invented courses", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const Overview = (await load("InstructorOverview.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, { user: { name: "Instructor" }, overview: buildInstructorOverview({ total_students: 0, total_classes: 0, pending_requests: [], flagged_students: [] }, [], now) })));
  assert.match(html, /No reported requests/);
  assert.match(html, /No attendance warnings/);
  assert.doesNotMatch(html, /Data Structure|Ana Santos|142/);
});

test("pending card selects the tab containing pending requests and keeps the pending filter", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const Overview = (await load("InstructorOverview.jsx")).default;
  for (const [pending_requests, expectedType] of [
    [[report("late-one", "late"), report("late-two", "late")], "late"],
    [[report("absence")], "absence"],
    [[report("absence"), report("late", "late")], "absence"],
    [[], "absence"],
  ]) {
    const overview = buildInstructorOverview({ ...dashboard, pending_requests }, [], now);
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, { overview })));
    const href = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>Pending requests<\/a>/)?.[1];
    assert.ok(href, "The pending card must expose a navigation link");
    const destination = new URL(href.replaceAll("&amp;", "&"), "http://localhost");
    assert.equal(destination.pathname, "/instructor/class-requests");
    assert.equal(destination.searchParams.get("status"), "pending");
    assert.equal(destination.searchParams.get("type"), expectedType);
  }
});

test("ready instructor totals and notices render while report-dependent sections keep their own placeholders", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const Overview = (await load("InstructorOverview.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, {
    user: { name: "Ana Santos" }, overview: buildInstructorOverview(dashboard, [], now), loading: { snapshot: false, reports: true },
  })));
  assert.match(html, /Welcome, Prof\. Ana Santos!/);
  assert.match(html, /142/);
  assert.match(html, /Alex Cruz/);
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 2);
  assert.match(html, /data-slot="activity-chart-placeholder"/);
  assert.match(html, /data-slot="semester-summary-placeholder"/);
  assert.doesNotMatch(html, /No reported requests/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
});

test("ready report charts and summaries do not wait for the instructor snapshot", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const Overview = (await load("InstructorOverview.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, {
    user: { name: "Ana Santos" }, overview: buildInstructorOverview({}, [report("one")], now), loading: { snapshot: true, reports: false },
  })));
  assert.match(html, /Weekly Bar Chart/);
  assert.match(html, /Semester Summary Table/);
  assert.match(html, /Data Structure/);
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 2);
  assert.match(html, /data-slot="attendance-notice-placeholder"/);
  assert.doesNotMatch(html, /No attendance warnings/);
});

test("a report failure keeps ready totals visible with a scoped retry rather than fake zero report counts", async () => {
  const { buildInstructorOverview } = await load("overviewData.js");
  const Overview = (await load("InstructorOverview.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, {
    user: { name: "Ana Santos" }, overview: buildInstructorOverview(dashboard, [], now), errors: { reports: "Reports unavailable" }, onRetryReports() {},
  })));
  assert.match(html, /142/);
  assert.match(html, /Reports unavailable/);
  assert.match(html, /Retry/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /No reported requests|No attendance warnings/);
  assert.equal((html.match(/role="alert"/g) || []).length, 1);
});
