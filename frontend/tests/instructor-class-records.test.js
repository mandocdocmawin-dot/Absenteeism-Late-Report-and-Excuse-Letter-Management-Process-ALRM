import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import * as instructorApi from "../src/api/instructor.js";

const directory = "../src/pages/auth/instructor/InstructorClassRecords/";
const course = { id: "class-one", subject_name: "Data Structures", program_id: "bsis", year_level: "3rd", section: "A" };
const student = { id: "student-one", name: "Alex Cruz" };
const programs = [{ id: "bsis", program_name: "Bachelor of Science in Information Systems" }];
function report(id, type = "absence", status = "pending", overrides = {}) {
  return { id, type, status, enrollment: { class: course, student, ...overrides } };
}
async function helpers() {
  const url = new URL(`${directory}recordData.js`, import.meta.url);
  assert.ok(existsSync(url), "the instructor class records data module must exist");
  return import(url);
}

let server;
let storage;
let originalWindow;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });
beforeEach(() => {
  storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "instructor-session" } });
  globalThis.window = new EventTarget();
});
afterEach(() => {
  mock.restoreAll();
  if (storage) Object.defineProperty(globalThis, "localStorage", storage);
  else delete globalThis.localStorage;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("course records group by class ID, keep same-named students distinct, and count each request once", async () => {
  const { buildClassRecords } = await helpers();
  const input = [report("one"), report("one"), report("two", "late"), report("three", "absence", "approved"), report("four", "late", "pending", { student: { id: "student-two", name: "Alex Cruz" } })];
  const rows = buildClassRecords(input, programs);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].program, "BSIS");
  assert.equal(rows[0].year, "3");
  assert.equal(rows[0].students.length, 2);
  assert.deepEqual(rows[0].students.map(row => [row.id, row.absences, row.lates]), [["student-one", 2, 1], ["student-two", 0, 1]]);
  assert.equal(input.length, 5);
});

test("classes sharing a subject remain separate across programs and sections", async () => {
  const { buildClassRecords } = await helpers();
  const second = { ...course, id: "class-two", program: { program_code: "BSA" }, section: "B" };
  const rows = buildClassRecords([report("one"), report("two", "late", "invalid", { class: second })], programs);
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map(row => row.id)), new Set([course.id, second.id]));
  assert.deepEqual(new Set(rows.map(row => row.program)), new Set(["BSIS", "BSA"]));
});

test("cancelled, unsupported, missing-class and missing-student data do not create fictional student records", async () => {
  const { buildClassRecords } = await helpers();
  const rows = buildClassRecords([report("one", "absence", "cancelled"), report("two", "unknown"), report("three", "late", "pending", { class: {} }), report("four", "late", "pending", { student: null }), null], programs);
  assert.ok(rows.every(row => row.id && row.students.length === 0));
});

test("request counts are not presented as enrollment totals or invented attendance percentages", async () => {
  const { buildClassRecords } = await helpers();
  const [row] = buildClassRecords([report("one"), report("two", "late")], programs);
  assert.equal(row.studentCount, null);
  assert.equal(row.students[0].threshold, null);
  const [known] = buildClassRecords([report("three", "absence", "pending", { class: { ...course, enrollments_count: 32 } })], programs);
  assert.equal(known.studentCount, 32);
  assert.equal(buildClassRecords([report("four")])[0].program, "Unavailable");
});

test("absent and late tabs show only matching students while keeping each student's two report totals", async () => {
  const { buildClassRecords, studentsForType } = await helpers();
  const [row] = buildClassRecords([report("one"), report("two", "late"), report("three", "late", "pending", { student: { id: "student-two", name: "Bea Reyes" } })], programs);
  assert.deepEqual(studentsForType(row, "absence").map(item => item.id), [student.id]);
  assert.deepEqual(studentsForType(row, "late").map(item => item.id), [student.id, "student-two"]);
  assert.equal(studentsForType(row, "absence")[0].lates, 1);
  assert.deepEqual(studentsForType(row, "other"), []);
});

test("class records load through the existing authenticated instructor request endpoint", async () => {
  assert.equal(typeof instructorApi.getInstructorClassRecords, "function");
  const fetch = mockApiFetch(async (url, options) => {
    assert.ok(String(url).endsWith("/api/instructor/requests"));
    assert.equal(options.method || "GET", "GET");
    assert.equal(options.headers.get("Authorization"), null);
    return Response.json({ success: true, data: [report("one")] });
  });
  assert.equal((await instructorApi.getInstructorClassRecords()).length, 1);
  assert.equal(fetch.mock.callCount(), 1);
});

test("malformed and forbidden class records responses stay errors instead of becoming an empty roster", async () => {
  assert.equal(typeof instructorApi.getInstructorClassRecords, "function");
  const fetch = mockApiFetch(async () => Response.json({ data: {} }));
  await assert.rejects(instructorApi.getInstructorClassRecords(), /unexpected/i);
  fetch.mock.mockImplementation(async () => Response.json({ message: "Forbidden." }, { status: 403 }));
  await assert.rejects(instructorApi.getInstructorClassRecords(), /Forbidden/);
});

test("courses render the remaining columns and real detail links", async () => {
  const { buildClassRecords } = await helpers();
  const Table = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorClassRecords/CoursesTable.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Table, { courses: buildClassRecords([report("one")], programs) })));
  for (const label of ["Name", "Program", "Year", "Actions", "Data Structures", "BSIS"]) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /Number of Students|Unavailable/);
  assert.match(html, /href="\/instructor\/class-records\/class-one"/);
  assert.doesNotMatch(html, /<button[^>]*>View/);
});

test("courses show Program next to Year and omit the small section subtitle", async () => {
  const Table = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorClassRecords/CoursesTable.jsx")).default;
  const row = { id: "class-one", subjectName: "Financial Literacy and Personal Management", program: "BSIS", section: "BSIS 3", year: "3", studentCount: 32 };
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Table, { courses: [row] })));
  const headers = [...html.matchAll(/<th\b[^>]*><span[^>]*>([^<]*)<\/span><\/th>/g)].map(match => match[1]);
  assert.deepEqual(headers, ["Name", "Program", "Year", "Actions"]);
  assert.match(html, /<td[^>]*>BSIS<\/td><td[^>]*>3<\/td>/);
  assert.doesNotMatch(html, />32<\/td>/);
  assert.doesNotMatch(html, /<span[^>]*>Section BSIS 3<\/span>/);
  assert.match(html, /aria-label="View records for Financial Literacy and Personal Management, BSIS, Section BSIS 3"/);
});

test("course totals from the API remain in data but are not shown in the table", async () => {
  const { buildClassRecords } = await helpers();
  const Table = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorClassRecords/CoursesTable.jsx")).default;
  for (const count of [0, 32]) {
    const courses = buildClassRecords([report("one", "late", "pending", { class: { ...course, enrollments_count: count } })], programs);
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Table, { courses })));
    assert.equal(courses[0].studentCount, count);
    assert.doesNotMatch(html, new RegExp(`<td[^>]*>${count}</td>`));
    assert.doesNotMatch(html, /Unavailable/);
  }
});

test("threshold percentages apply the twenty-percent semester-hours policy only to invalidated reports", async () => {
  const { buildClassRecords } = await helpers();
  const scheduled = { ...course, weekly_hours: 3, meetings_per_week: 1 };
  const request = (id, type, status) => report(id, type, status, { class: scheduled });
  const input = [request("one", "absence", "invalid"), request("two", "absence", "approved"), request("three", "absence", "pending"), request("four", "absence", "noted")];
  assert.equal(buildClassRecords(input, programs)[0].students[0].threshold, 6.25);
  const lates = [1, 2, 3].map(id => request(`late-${id}`, "late", "invalid"));
  assert.equal(buildClassRecords([...input, ...lates, lates[0]], programs)[0].students[0].threshold, 12.5);
  assert.equal(buildClassRecords([request("pending", "absence", "pending")], programs)[0].students[0].threshold, 0);
});

test("thresholds respect class meeting frequency and do not cap absences at the policy limit", async () => {
  const { buildClassRecords } = await helpers();
  const twiceWeekly = { ...course, weekly_hours: "5", meetings_per_week: "2" };
  assert.equal(buildClassRecords([report("one", "absence", "invalid", { class: twiceWeekly })], programs)[0].students[0].threshold, 3.13);
  const scheduled = { ...course, weekly_hours: 3, meetings_per_week: 1 };
  const input = [1, 2, 3, 4].map(id => report(`invalid-${id}`, "absence", "invalid", { class: scheduled }));
  assert.equal(buildClassRecords(input, programs)[0].students[0].threshold, 25);
  for (const fields of [{}, { weekly_hours: 0, meetings_per_week: 1 }, { weekly_hours: 3 }, { weekly_hours: 3, meetings_per_week: null }]) {
    assert.equal(buildClassRecords([report("unknown", "absence", "invalid", { class: { ...course, ...fields } })], programs)[0].students[0].threshold, null);
  }
});

test("student thresholds render a percent sign and describe the actual twenty-percent absence limit", async () => {
  const { buildClassRecords } = await helpers();
  const Detail = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorClassRecords/CourseStudents.jsx")).default;
  const [data] = buildClassRecords([report("one", "absence", "invalid", { class: { ...course, weekly_hours: 3, meetings_per_week: 1 } })], programs);
  const html = renderToStaticMarkup(React.createElement(Detail, { course: data, type: "absence", onTypeChange() {} }));
  assert.match(html, />6\.25%<\/td>/);
  assert.match(html, /20%/);
  assert.doesNotMatch(html, /Attendance percentage is not supplied/);
});

test("student detail matches the requested columns and has distinct absence and late tab panels", async () => {
  const { buildClassRecords } = await helpers();
  const Detail = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorClassRecords/CourseStudents.jsx")).default;
  const [data] = buildClassRecords([report("one"), report("two", "late", "pending", { student: { id: "student-two", name: "Bea Reyes" } })], programs);
  const render = type => renderToStaticMarkup(React.createElement(Detail, { course: data, type, onTypeChange() {} }));
  const absent = render("absence");
  for (const label of ["Name", "Absences", "Lates", "Threshold", "Absent", "Late", "Unavailable", "Alex Cruz"]) assert.ok(absent.includes(label), label);
  assert.doesNotMatch(absent, /Bea Reyes/);
  const late = render("late");
  assert.match(late, /Bea Reyes/);
  assert.doesNotMatch(late, /Alex Cruz/);
  assert.equal((late.match(/role="tabpanel"/g) || []).length, 1);
});

test("class records routing is separate from the dashboard and adds a protected class detail route", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/instructor\/class-records\/:classId"/);
  assert.match(app, /<InstructorClassRecords\s*\/>/);
  const block = app.slice(app.indexOf('path="/instructor/class-records"'), app.indexOf('path="/instructor/class-requests"'));
  assert.doesNotMatch(block, /InstructorWorkspace view="dashboard"/);
  assert.match(block, /ProtectedRoute allowedRoles=\{\["instructor"\]\}/);
});

test("the class list heading and its detail breadcrumb are labeled Courses", async () => {
  const source = await readFile(new URL(`${directory}InstructorClassRecords.jsx`, import.meta.url), "utf8");
  const heading = source.match(/<h1\b[^>]*>(.*?)<\/h1>/)?.[1];
  assert.match(heading, /: "Courses"/);
  assert.match(source, /label: "Courses", to: "\/instructor\/class-records"/);
});

test("instructor active navigation retains the reference blue background on course detail routes", async () => {
  const Sidebar = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorSidebar.jsx")).default;
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/instructor/class-records/class-one"] }, React.createElement(AuthProvider, null, React.createElement(Sidebar))));
  assert.match(html, /data-active:bg-\[#203b82\]/);
  assert.match(html, /data-active:text-white/);
});
