import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createServer } from "vite";

const root = "/src/pages/auth/instructor/InstructorRequests/";
let server;
let originalStorage;
let originalWindow;
const course = { id: "class-a", subject_name: "Programming", program_id: "BSIS", section: "A", year_level: 2 };
function request(id, fields = {}) {
  return { id, type: "absence", status: "pending", date_submitted: "2026-10-20", start_date_of_absence: "2026-10-19", enrollment: { student: { id: "s1", name: "Alex Cruz" }, class: course }, ...fields };
}
const load = name => server.ssrLoadModule(`${root}${name}`);
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });
beforeEach(() => {
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "instructor-session" } });
  globalThis.window = new EventTarget();
});
afterEach(() => {
  mock.restoreAll();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("filters type, actual class ID, name and backend status, then sorts newest submission first", async () => {
  const { filterRequests, groupRequests } = await load("requestData.js");
  const otherClass = { ...course, id: "class-b", section: "B" };
  const rows = [request("old"), request("new", { date_submitted: "2026-10-23" }), request("late", { type: "late" }), request("invalid", { status: "invalid" }), request("other", { enrollment: { student: { name: "Alex Cruz" }, class: otherClass } })];
  const options = { type: "absence", subject: "class-a", search: "  ALEX  ", status: "pending" };
  assert.deepEqual(filterRequests(rows, options).map(row => row.id), ["new", "old"]);
  assert.deepEqual(filterRequests(rows, { ...options, status: "invalid" }).map(row => row.id), ["invalid"]);
  assert.deepEqual(filterRequests(rows, { ...options, type: "late" }).map(row => row.id), ["late"]);
  assert.equal(groupRequests(rows).length, 2);
  assert.deepEqual(groupRequests(rows).map(group => group.id), ["class-a", "class-b"]);
  assert.equal(rows[0].id, "old");
});

test("course list keeps the same subject in separate programs and class IDs", async () => {
  const { requestCourses } = await load("requestData.js");
  const shared = { ...course, subject_name: "Critical Thinking", year_level: "3rd" };
  const records = [
    request("bsa", { enrollment: { student: { id: "s1", name: "Alex" }, class: { ...shared, id: "class-bsa", program_id: "p-bsa" } } }),
    request("bsis", { enrollment: { student: { id: "s2", name: "Bea" }, class: { ...shared, id: "class-bsis", program_id: "p-bsis" } } }),
  ];
  const programs = [{ id: "p-bsa", program_name: "Bachelor of Science in Accountancy" }, { id: "p-bsis", program_name: "Bachelor of Science in Information Systems" }];
  assert.deepEqual(requestCourses(records, programs).map(({ id, subjectName, program, year }) => ({ id, subjectName, program, year })), [
    { id: "class-bsa", subjectName: "Critical Thinking", program: "BSA", year: "3" },
    { id: "class-bsis", subjectName: "Critical Thinking", program: "BSIS", year: "3" },
  ]);
});

test("class request courses have separate View links and no student-count column", async () => {
  const Table = (await load("RequestCoursesTable.jsx")).default;
  const courses = [
    { id: "class-bsa", subjectName: "Critical Thinking", program: "BSA", year: "3" },
    { id: "class-bsis", subjectName: "Critical Thinking", program: "BSIS", year: "3" },
  ];
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Table, { courses, search: "?type=late&status=pending" })));
  assert.match(html, /href="\/instructor\/class-requests\/class-bsa\?type=late&amp;status=pending"/);
  assert.match(html, /href="\/instructor\/class-requests\/class-bsis\?type=late&amp;status=pending"/);
  assert.equal((html.match(/>Critical Thinking<\/td>/g) || []).length, 2);
  assert.doesNotMatch(html, /Number of Students/);
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/instructor\/class-requests\/:classId"/);
});

test("occurrence dates never invent late dates and submission falls back to creation", async () => {
  const { occurrenceDate, submittedDate, formatDate } = await load("requestData.js");
  assert.equal(occurrenceDate(request("one")), "2026-10-19");
  assert.equal(occurrenceDate(request("late", { type: "late" })), null);
  assert.equal(submittedDate(request("one", { date_submitted: null, created_at: "2026-10-21" })), "2026-10-21");
  assert.equal(formatDate(null), "Unavailable");
  assert.equal(formatDate("bad-date"), "Unavailable");
});

test("request deadlines are exactly 48 hours after submission for absence and late requests", async () => {
  const { dueDate } = await load("requestData.js");
  for (const type of ["absence", "late"]) {
    const record = request("one", { type, date_submitted: "2026-10-15T02:34:33.000000Z", created_at: "2026-10-14T01:00:00Z" });
    assert.equal(dueDate(record), "2026-10-17T02:34:33.000Z");
    assert.equal(record.date_submitted, "2026-10-15T02:34:33.000000Z");
  }
  assert.equal(dueDate(request("fallback", { date_submitted: null, created_at: "2026-12-31T23:30:00+08:00" })), "2027-01-02T15:30:00.000Z");
  assert.equal(dueDate(request("dst", { date_submitted: "2026-03-07T12:00:00-05:00" })), "2026-03-09T17:00:00.000Z");
  for (const date_submitted of [null, "", "bad-date"]) {
    assert.equal(dueDate(request("missing", { date_submitted })), null);
  }
});

test("query updates preserve unrelated parameters and notification request IDs", async () => {
  const { updateRequestParams } = await load("requestData.js");
  const original = new URLSearchParams("request=r1&from=notification&subject=class-a&type=absence");
  const next = updateRequestParams(original, { type: "late", subject: "" });
  assert.equal(next.get("request"), "r1");
  assert.equal(next.get("from"), "notification");
  assert.equal(next.get("type"), "late");
  assert.equal(next.has("subject"), false);
  assert.equal(original.get("type"), "absence");
});

test("list and decision use the authenticated API and validate the fresh decision record", async () => {
  const { loadRequests, createDecisionGate } = await load("requestApi.js");
  const calls = [];
  mockApiFetch(async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ success: true, data: options.method === "PATCH" ? request("one", { status: "approved" }) : [request("one")] });
  });
  assert.equal((await loadRequests()).length, 1);
  const fresh = await createDecisionGate()(request("one"), "approved");
  assert.equal(fresh.status, "approved");
  assert.ok(calls[0].url.endsWith("/api/instructor/requests"));
  assert.ok(calls[1].url.endsWith("/api/instructor/requests/one/decision"));
  assert.equal(calls[1].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].options.body), { status: "approved" });
  assert.equal(calls[1].options.headers.get("Authorization"), null);
});

test("malformed, forbidden and mismatched decisions remain errors", async () => {
  const { loadRequests, createDecisionGate } = await load("requestApi.js");
  const fetch = mockApiFetch(async () => Response.json({ success: true, data: {} }));
  await assert.rejects(loadRequests(), /unexpected/i);
  for (const data of [request("wrong", { status: "approved" }), request("one", { status: "pending" }), null]) {
    fetch.mock.mockImplementation(async () => Response.json({ success: true, data }));
    await assert.rejects(createDecisionGate()(request("one"), "approved"), /confirm/i);
  }
  fetch.mock.mockImplementation(async () => Response.json({ message: "Forbidden." }, { status: 403 }));
  await assert.rejects(createDecisionGate()(request("one"), "invalid"), /Forbidden/);
});

test("decision gate blocks concurrent, repeated and non-pending reviews without sending", async () => {
  const { createDecisionGate } = await load("requestApi.js");
  let finish;
  const fetch = mockApiFetch(() => new Promise(resolve => { finish = resolve; }));
  const decide = createDecisionGate();
  const pending = decide(request("one"), "approved");
  await assert.rejects(decide(request("one"), "invalid"), /progress/i);
  await new Promise(resolve => setTimeout(resolve, 0));
  finish(Response.json({ success: true, data: request("one", { status: "approved" }) }));
  await pending;
  await assert.rejects(decide(request("one"), "approved"), /reviewed/i);
  await assert.rejects(decide(request("two", { status: "invalid" }), "approved"), /pending/i);
  await assert.rejects(decide(request("two"), "noted"), /decision/i);
  await assert.rejects(decide(request("two"), "denied"), /decision/i);
  assert.equal(fetch.mock.callCount(), 1);
});

test("failed decisions can retry, encode IDs, and preserve backend validation errors", async () => {
  const { createDecisionGate } = await load("requestApi.js");
  const decide = createDecisionGate();
  const record = request("one/two");
  const fetch = mockApiFetch(async () => Response.json({ message: "Request was already reviewed.", errors: { status: ["Invalid decision."] } }, { status: 422 }));
  await assert.rejects(decide(record, "approved"), error => {
    assert.equal(error.status, 422);
    assert.deepEqual(error.errors, { status: ["Invalid decision."] });
    return /already reviewed/.test(error.message);
  });
  fetch.mock.mockImplementation(async url => {
    assert.ok(String(url).endsWith("/api/instructor/requests/one%2Ftwo/decision"));
    return Response.json({ success: true, data: { ...record, status: "approved" } });
  });
  assert.equal((await decide(record, "approved")).status, "approved");
});

test("pagination uses ten rows after filtering and CSV includes all filtered pages", async () => {
  const { filterRequests } = await load("requestData.js");
  const { requestsCsv } = await load("requestCsv.js");
  const { paginateRecords } = await server.ssrLoadModule("/src/pages/auth/student/records/pagination.js");
  const records = Array.from({ length: 23 }, (_, index) => request(`row-${index}`, { date_submitted: `2026-10-${String(index + 1).padStart(2, "0")}` }));
  const filtered = filterRequests(records);
  assert.equal(paginateRecords(filtered, 1).pageRecords.length, 10);
  assert.equal(paginateRecords(filtered, 3).pageRecords.length, 3);
  assert.equal(requestsCsv(filtered).split("\r\n").length, 24);
});

test("CSV exports only supplied filtered records, escaping formulas, quotes and line breaks", async () => {
  const { requestsCsv, csvCell } = await load("requestCsv.js");
  for (const value of ["=SUM(A1)", "+1", "-2", "@test", " \t=1", "\r=1", "\t=1"]) assert.match(csvCell(value), /^"'/);
  assert.equal(csvCell('Alex "A", Cruz\nJr'), '"Alex ""A"", Cruz\nJr"');
  const csv = requestsCsv([request("one", { enrollment: { class: course, student: { name: "=HYPERLINK(1)" } } })]);
  assert.match(csv, /Student/);
  assert.match(csv, /'=HYPERLINK\(1\)/);
  assert.match(csv, /"Oct 22, 2026"/);
});

test("table and filters expose the requested labels with route-neutral review buttons", async () => {
  const Table = (await load("RequestsTable.jsx")).default;
  const Filters = (await load("RequestFilters.jsx")).default;
  const Tabs = (await server.ssrLoadModule("/src/components/records/RecordTypeTabs.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Tabs, { value: "absence", onValueChange() {} }, React.createElement(Table, { records: [request("one", { status: "invalid" })], onReview() {} }))));
  for (const text of ["Absent", "Late", "Student", "Date of Occurrence", "Type", "Submitted", "Date of Due", "Request", "Action", "Alex Cruz", "invalid", "Oct 22, 2026"]) assert.ok(html.includes(text), text);
  assert.match(html, />View<\/button>/);
  assert.match(html, /<td[^>]*>Alex Cruz<\/td>/);
  assert.doesNotMatch(html, /<td[^>]*text-\[#203B82\][^>]*>Alex Cruz/);
  assert.doesNotMatch(html, /aria-label="Review request for/);
  for (const type of ["absence", "late"]) {
    const record = request(type, { type });
    const onReview = mock.fn();
    const row = Table({ records: [record], onReview }).props.children[0];
    row.props.children.at(-1).props.children.props.onClick();
    assert.equal(onReview.mock.calls[0].arguments[0], record);
  }
  assert.doesNotMatch(html, /Unavailable/);
  assert.match(html, /<button[^>]*type="button"/);
  assert.doesNotMatch(html, /href=/);
  const filters = renderToStaticMarkup(React.createElement(Filters, { search: "", subject: "", status: "", classes: [], onSearch() {}, onChange() {}, onExport() {} }));
  for (const text of ["Search Name...", "Filter Subject", "Filter Request", "Export", 'maxLength="50"', 'value="invalid"', 'value="noted"']) assert.ok(filters.includes(text), text);
});

test("reviewed requests keep disabled decision buttons at the bottom without exposing raw attachments", async () => {
  const Dialog = (await load("RequestDetailDialog.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Dialog, { request: request("one", { status: "noted", evidence_file_url: "https://private.example/file" }), onClose() {}, onReload() {} }));
  assert.match(html, /<dialog[^>]*aria-labelledby="request-dialog-title"/);
  assert.match(html, /Alex Cruz/);
  assert.match(html, /View Attachment/);
  assert.match(html, /<dt[^>]*>Date of Due<\/dt><dd[^>]*>Oct 22, 2026<\/dd>/);
  assert.doesNotMatch(html, /https:\/\/private.example/);
  const buttons = [...html.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)].filter(([button]) => />(Approve|Note|Invalid)<\/button>$/.test(button));
  assert.equal(buttons.length, 2);
  assert.doesNotMatch(html, />Note<\/button>/);
  assert.ok(buttons.every(([, attributes]) => attributes.includes('disabled=""')));
  assert.match(html, /already been reviewed/i);
  assert.ok(html.indexOf('View Attachment') < html.indexOf('>Approve</button>'));
});

test("pending requests expose enabled approve and invalid decisions in the modal footer", async () => {
  const Dialog = (await load("RequestDetailDialog.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Dialog, { request: request("pending"), onClose() {}, onReload() {} }));
  const buttons = [...html.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)].filter(([button]) => />(Approve|Note|Invalid)<\/button>$/.test(button));
  assert.equal(buttons.length, 2);
  assert.doesNotMatch(html, />Note<\/button>/);
  assert.match(buttons.find(([button]) => />Approve<\/button>$/.test(button))[1], /bg-green-600/);
  assert.ok(buttons.every(([, attributes]) => !/(?:^|\s)disabled(?:=|\s|$)/.test(attributes)));
  assert.ok(html.indexOf('Attachment unavailable') < html.indexOf('>Approve</button>'));
  assert.doesNotMatch(html, /already been reviewed/i);
});

test("default page mounts the instructor shell and full loading placeholder without sending a mutation", async () => {
  const Page = (await load("index.js")).default;
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const fetch = mockApiFetch(async () => { throw new Error("SSR must not fetch or decide requests"); });
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/instructor/class-requests?type=late&request=one&from=notification"] }, React.createElement(AuthProvider, null, React.createElement(Page))));
  for (const text of [">Request<", "Loading class requests...", 'data-layout="courses"']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /role="tab"|placeholder="Search Name\.\.\."|Filter Subject|Filter Request/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("class request detail route renders the request-list loading shape", async () => {
  const Page = (await load("index.js")).default;
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/instructor/class-requests/class-bsa?type=late"] }, React.createElement(AuthProvider, null, React.createElement(Routes, null, React.createElement(Route, { path: "/instructor/class-requests/:classId", element: React.createElement(Page) })))));
  assert.match(html, /data-layout="requests"/);
});
