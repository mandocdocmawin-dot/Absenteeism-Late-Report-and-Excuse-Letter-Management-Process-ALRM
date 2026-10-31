import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { getAdminStudent, getAdminStudents } from "../src/api/adminStudents.js";
import { createInstructor, createStudent } from "../src/api/adminUsers.js";
import { saveProfileSetup } from "../src/api/profileSetup.js";
import { createStudentRequest } from "../src/api/studentRequests.js";
import { createClass, getAdminUsers, updateStaffRole } from "../src/api/admin.js";
import { getStudentAttendanceSummary } from "../src/api/student.js";
import { resolveProgramHeadFlag } from "../src/api/programHead.js";
import {
  createProgram,
  decideInstructorRequest,
  getAdminDashboard,
  getFlaggedStudents,
  getInstructorDashboard,
  getProgramHeadRequests,
  updateAdminUserStatus,
} from "../src/api/dashboardData.js";

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "test-session",
      setItem: () => {},
      removeItem: () => {},
    },
  });
  globalThis.window = new EventTarget();
});

afterEach(() => mock.restoreAll());

function captureJsonRequest(responseBody = { success: true }) {
  const requests = [];
  mockApiFetch(async (url, options) => {
    requests.push({
      url: String(url),
      method: options.method || "GET",
      body: options.body ? JSON.parse(options.body) : null,
    });
    return Response.json(responseBody);
  });
  return requests;
}

test("profile setup uses the backend complete-profile contract", async () => {
  const requests = captureJsonRequest();
  const payload = {
    program_id: "43b62cb1-65b9-4ea3-bf83-b65b0eed3ab0",
    school_id_number: "2026-1001",
    year_level: "1st",
  };

  await saveProfileSetup(payload);

  assert.equal(requests[0].method, "POST");
  assert.ok(requests[0].url.endsWith("/api/complete-profile"));
  assert.deepEqual(requests[0].body, payload);
});

test("student requests post all fields required by the backend", async () => {
  const requests = captureJsonRequest();
  const payload = {
    class_id: "19b10b16-3f80-43b5-ad10-670b735a84f3",
    type: "late",
    subjects_missed: "Information Management",
    minutes_late: 15,
    start_date_of_absence: "2026-10-20",
    end_date_of_absence: null,
    guardian_name: "Alex Parent",
    contact_number: "09123456789",
    reason: "Transport delay",
    evidence_file_url: null,
    evidence_type: null,
  };

  await createStudentRequest(payload);

  assert.equal(requests[0].method, "POST");
  assert.ok(requests[0].url.endsWith("/api/requests"));
  assert.deepEqual(requests[0].body, payload);
});

test("admin student listing uses the users endpoint and filters locally", async () => {
  const requests = captureJsonRequest({
    data: [
      {
        id: "student-one",
        name: "Alex Student",
        email: "alex@student.laverdad.edu.ph",
        role: "student",
        program_id: "program-one",
        school_id_number: "2026-1001",
        year_level: "1st",
      },
      {
        id: "student-two",
        name: "Jamie Student",
        role: "student",
        program_id: "program-two",
        year_level: "2nd",
      },
    ],
  });

  const students = await getAdminStudents({
    search: "2026-1001",
    programId: "program-one",
    yearLevel: "1st Year",
  });

  assert.ok(requests[0].url.endsWith("/api/admin/users?role=student"));
  assert.deepEqual(students.map((student) => student.id), ["student-one"]);
});

test("admin student profile resolves its program without treating the user UUID as a school ID", async () => {
  const requests = [];
  mockApiFetch(async (url) => {
    requests.push(String(url));
    if (String(url).includes("/api/admin/programs")) {
      return Response.json({ success: true, data: [{ id: "program-one", program_name: "BS Information Systems" }] });
    }
    return Response.json({ success: true, data: [{ id: "database-uuid", role: "student", program_id: "program-one", school_id_number: "2026-1001" }] });
  });

  const student = await getAdminStudent("database-uuid");

  assert.equal(student.school_id_number, "2026-1001");
  assert.equal(student.program.program_name, "BS Information Systems");
  assert.equal(requests.length, 2);
});

test("admin pre-registration only sends fields the backend persists", async () => {
  const requests = captureJsonRequest();

  await createStudent({
    fullName: "Alex Student",
    email: "ALEX@STUDENT.LAVERDAD.EDU.PH",
    studentId: "ignored",
    programId: "program-one",
    yearLevel: "1st",
    status: "active",
  });
  await createInstructor({
    fullName: "Jamie Instructor",
    email: "JAMIE@LAVERDAD.EDU.PH",
    employeeId: "ignored",
    programId: "program-one",
    subjectHandled: "ignored",
    status: "active",
  });

  assert.deepEqual(requests.map((request) => request.body), [
    {
      name: "Alex Student",
      email: "alex@student.laverdad.edu.ph",
      role: "student",
    },
    {
      name: "Jamie Instructor",
      email: "jamie@laverdad.edu.ph",
      role: "instructor",
    },
  ]);
});

test("role dashboards and program-head filters use registered GET routes", async () => {
  const requests = captureJsonRequest({ success: true, data: [] });

  await getAdminDashboard();
  await getInstructorDashboard();
  await getProgramHeadRequests("pending");
  await getFlaggedStudents("open");

  assert.deepEqual(requests.map(({ url }) => new URL(url, "https://example.test").pathname + new URL(url, "https://example.test").search), [
    "/api/admin/dashboard",
    "/api/instructor/dashboard",
    "/api/program-head/requests?status=pending",
    "/api/program-head/students/flagged?status=open",
  ]);
});

test("instructor decisions and admin mutations send backend-accepted payloads", async () => {
  const requests = captureJsonRequest({ success: true, data: {} });

  await decideInstructorRequest("request-one", "approved");
  await updateAdminUserStatus("user-one", "deactivated");
  await createProgram({ program_name: "BS Information Systems", program_head_id: null });

  assert.deepEqual(requests.map(({ method, body }) => ({ method, body })), [
    { method: "PATCH", body: { status: "approved" } },
    { method: "PATCH", body: { status: "deactivated" } },
    { method: "POST", body: { program_name: "BS Information Systems", program_head_id: null } },
  ]);
  assert.deepEqual(requests.map(({ url }) => new URL(url, "https://example.test").pathname), [
    "/api/instructor/requests/request-one/decision",
    "/api/admin/users/user-one/status",
    "/api/admin/programs",
  ]);
});

test("program heads resolve the follow-up flag with an empty PATCH", async () => {
  const requests = captureJsonRequest({ success: true, data: { id: "flag-one", status: "resolved" } });

  await resolveProgramHeadFlag("flag-one");

  assert.equal(requests[0].method, "PATCH");
  assert.equal(requests[0].body, null);
  assert.equal(new URL(requests[0].url, "https://example.test").pathname, "/api/program-head/followup-flags/flag-one/resolve");
});

test("admin role assignment and class creation use registered routes and UUIDs", async () => {
  const requests = captureJsonRequest({ success: true, data: [] });
  await getAdminUsers();
  await updateStaffRole("staff-uuid", "program_head");
  await createClass({
    subject_name: "Information Management",
    section: "A",
    instructor_id: "instructor-uuid",
    year_level: "3rd",
    schedule: "Monday 9:00 AM",
    program_id: "program-uuid",
    semester: "1st",
    school_year: "2026-2027",
  });

  assert.deepEqual(requests.map(({ url }) => new URL(url, "https://example.test").pathname), [
    "/api/admin/users",
    "/api/admin/users/staff-uuid/role",
    "/api/admin/classes",
  ]);
  assert.deepEqual(requests[1].body, { role: "program_head" });
  assert.equal(requests[2].body.instructor_id, "instructor-uuid");
  assert.equal(requests[2].body.program_id, "program-uuid");
  assert.equal(requests[2].body.school_year, "2026-2027");
});

test("student attendance summary uses the student backend route", async () => {
  const requests = captureJsonRequest({ success: true, data: [] });
  await getStudentAttendanceSummary();
  assert.ok(requests[0].url.endsWith("/api/attendance/summary"));
});
