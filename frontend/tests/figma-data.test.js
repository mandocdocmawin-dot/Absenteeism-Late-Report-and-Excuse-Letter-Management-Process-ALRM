import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getCollection } from "../src/api/collections.js";
import { auditActivity, flagActivity, requestActivity, filterActivity, programOverviewRows } from "../src/pages/auth/admin/overviewData.js";

const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => { mock.restoreAll(); if (storage) Object.defineProperty(globalThis, "localStorage", storage); else delete globalThis.localStorage; });
function transport(handler) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
  mock.method(globalThis, "fetch", handler);
}
test("collections load every bounded API page while preserving filters", async () => {
  const seen = [];
  transport(async url => {
    const parsed = new URL(url, "https://local.test"); seen.push(parsed.searchParams.get("page"));
    assert.equal(parsed.searchParams.get("status"), "pending");
    assert.equal(parsed.searchParams.get("per_page"), "100");
    const page = Number(parsed.searchParams.get("page"));
    return Response.json({ success: true, data: [{ id: String(page) }], meta: { page, last_page: 2 } });
  });
  assert.deepEqual(await getCollection("/admin/users?status=pending"), [{ id: "1" }, { id: "2" }]);
  assert.deepEqual(seen, ["1", "2"]);
});
test("collections reject repeated pagination and surface backend failures", async () => {
  transport(async () => Response.json({ success: true, data: [], meta: { page: 1, last_page: 2 } }));
  await assert.rejects(getCollection("/admin/users"), /pagination/i);
  mock.restoreAll();
  transport(async () => Response.json({ message: "Not permitted" }, { status: 403 }));
  await assert.rejects(getCollection("/admin/users"), /Not permitted/);
});
test("request activity uses real event dates and never invents an unrecorded decision", () => {
  const request = { id: "r1", type: "absence", status: "approved", date_submitted: "2026-10-01T10:00:00Z", date_reviewed: "2026-10-02T12:00:00Z", enrollment: { student: { name: "Student A" }, class: { id: "c1", subject_name: "Math", instructor: { name: "Instructor A" } } } };
  const events = requestActivity([request, { ...request, id: "r2", date_reviewed: null }]);
  assert.equal(events.length, 3);
  assert.equal(events.filter(row => row.action === "Approved").length, 1);
  assert.equal(events[0].date, request.date_reviewed);
  assert.equal(filterActivity(events, { action: "Approved", subject: "c1", date: "2026-10-02" }).length, 1);
});
test("admin audit activity uses the backend actor, request and action fields", () => {
  const rows = auditActivity([
    { id: "audit-old", action: "submitted_request", description: "Submitted a request", timestamp: "2026-10-28T08:00:00+08:00", actor: { id: "student-one", name: "Alex Student", role: "student" }, request: { id: "request-one", type: "absence", student: { id: "student-one", name: "Alex Student" }, class: { id: "class-one", subject_name: "Information Management" } } },
    { id: "audit-new", action: "decided_request_approved", description: "Approved a request", timestamp: "2026-10-29T09:00:00+08:00", actor: { id: "instructor-one", name: "Jamie Instructor", role: "instructor" }, request: { id: "request-one", type: "absence", student: { id: "student-one", name: "Alex Student" }, class: { id: "class-one", subject_name: "Information Management" } } },
  ]);
  assert.deepEqual(rows.map(row => row.id), ["audit-new", "audit-old"]);
  assert.deepEqual(rows[0], {
    id: "audit-new", requestId: "request-one", date: "2026-10-29T09:00:00+08:00", student: "Alex Student", studentId: "", email: "", subject: "Information Management", classId: "class-one", type: "Absent", action: "Approved", instructor: "Jamie Instructor", actor: "Jamie Instructor", description: "Approved a request",
  });
});
test("historical decisions retain the recorded reviewer after a class is reassigned", () => {
  const [decision] = requestActivity([{ id: "r1", type: "absence", status: "approved", date_submitted: "2026-10-01", date_reviewed: "2026-10-02", reviewer: { name: "Original Reviewer" }, enrollment: { class: { instructor: { name: "New Instructor" } } } }]);
  assert.equal(decision.instructor, "Original Reviewer");
});
test("flags use the actual class instructor as the supplier of the flagged-by field", () => {
  const [event] = flagActivity([{ id: "f1", flagged_date: "2026-10-01", request: { type: "late", enrollment: { student: { name: "Student A" }, class: { id: "c1", subject_name: "Math", instructor_id: "i1" } } } }], [{ id: "c1", instructor: { name: "Instructor A" } }]);
  assert.equal(event.action, "Flagged");
  assert.equal(event.instructor, "Instructor A");
  assert.equal(event.flaggedBy, "Instructor A");
});

test("activity search combines with action, subject and date using supplied account details", () => {
  const rows = [{ id: "a", student: "Alex Cruz", studentId: "2026-001", email: "alex@example.test", subject: "Math", classId: "c1", action: "Flagged", instructor: "Ana Santos", date: "2026-10-28T08:00:00+08:00" }, { id: "b", student: "Bea", action: "Approved", classId: "c2", date: "2026-10-27T08:00:00+08:00" }];
  for (const search of [" Alex ", "2026-001", "ALEX@EXAMPLE", "Math", "Ana Santos"]) assert.deepEqual(filterActivity(rows, { search, action: "Flagged", subject: "c1", date: "2026-10-28" }).map(row => row.id), ["a"]);
  assert.equal(filterActivity(rows, { search: "Unknown" }).length, 0);
  assert.equal(filterActivity(rows, { search: "Alex", action: "Approved" }).length, 0);
  assert.equal(filterActivity(rows, { search: "", action: "", subject: "", date: "" }).length, 2);
});
test("program overview rows contain only real per-program student, class and instructor counts", () => {
  const rows = programOverviewRows({ programs_summary: [{ id: "p1", program_name: "BSIS", student_count: 12, classes_count: 2 }] }, [{ id: "c1", program_id: "p1", instructor_id: "i1" }, { id: "c2", program_id: "p1", instructor_id: "i1" }]);
  assert.equal(rows[0].students, 12);
  assert.equal(rows[0].classes, 2);
  assert.equal(rows[0].instructors, 1);
  assert.equal(Object.hasOwn(rows[0], "atRisk"), false);
  assert.equal(Object.hasOwn(rows[0], "pending"), false);
});

test("admin program overview excludes the General Education program", () => {
  const rows = programOverviewRows({ programs_summary: [
    { id: "ge", program_name: "General Education", student_count: 0 },
    { id: "p1", program_name: "Bachelor of Science in Information System", student_count: 12 },
  ] });
  assert.deepEqual(rows.map(row => row.id), ["p1"]);
});

test("program overview falls back to the loaded class collection when the summary omits class counts", () => {
  const rows = programOverviewRows({ programs_summary: [{ id: "p1", program_name: "BSIS", student_count: 2 }] }, [
    { id: "c1", program_id: "p1", instructor_id: "i1" },
    { id: "c2", program_id: "p1", instructor_id: "i2" },
  ]);
  assert.deepEqual(rows[0], { id: "p1", name: "BSIS", students: 2, classes: 2, instructors: 2 });
});
test("a flag with no assigned instructor remains unavailable", () => {
  const [row] = flagActivity([{ id: "f1", flagged_date: "2026-10-01", request: { id: "r1" } }]);
  assert.equal(row.flaggedBy, "Unavailable");
});
