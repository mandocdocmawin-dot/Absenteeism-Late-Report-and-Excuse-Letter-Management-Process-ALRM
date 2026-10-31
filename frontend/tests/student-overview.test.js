import test from "node:test";
import assert from "node:assert/strict";
import { attendanceStanding, programShortName, recentRequestActivity, requestTotals, studentProfile } from "../src/pages/auth/student/dashboard/studentOverview.js";

test("dashboard program labels abbreviate recognized degrees and preserve unknown names", () => {
  assert.equal(programShortName("Bachelor of Science in Information Technology"), "BSIT");
  assert.equal(programShortName("BS in Information Systems"), "BSIS");
  assert.equal(programShortName("Associate in Computer Technology"), "ACT");
  assert.equal(programShortName("Not assigned"), "Not assigned");
});

test("recorded totals exclude cancellations and distinguish reviewed and pending absences", () => {
  const requests = [
    { type: "absence", status: "approved" }, { type: "absence", status: "noted" },
    { type: "absence", status: "invalid" }, { type: "absence", status: "pending" },
    { type: "absence", status: "cancelled" }, { type: "late", status: "pending" },
    { type: "late", status: "cancelled" },
  ];
  assert.deepEqual(requestTotals(requests), { absences: 4, lates: 1, excused: 2, unexcused: 1, pending: 1 });
});

test("attendance standing applies thresholds per class rather than accumulating different classes", () => {
  const rows = ["Math", "English", "Science"].map((subject_name) => ({ subject_name, tracker: { converted_absences: 1 } }));
  assert.equal(attendanceStanding(rows).status, "safe");
  rows[1].tracker.converted_absences = 2;
  assert.deepEqual(attendanceStanding(rows), { converted: 2, status: "warning", subject: "English", hasData: true });
  rows[2].tracker.converted_absences = 4;
  assert.equal(attendanceStanding(rows).status, "IR");
});

test("missing trackers are distinguished from an actual zero absence record", () => {
  assert.equal(attendanceStanding([{ subject_name: "Math", tracker: null }]).hasData, false);
  assert.deepEqual(attendanceStanding([{ subject_name: "Math", tracker: { converted_absences: 0 } }]), { converted: 0, status: "safe", subject: "Math", hasData: true });
});

test("profile shows school identity and actual academic data without exposing database ID", () => {
  const profile = studentProfile({ id: "database-uuid", name: "Juan", school_id_number: "2023-00104", year_level: "3rd", program: { program_name: "BS Information Systems" } }, [
    { section: "3A", semester: "1st", school_year: "2026-2027" },
    { section: "3A", semester: "1st", school_year: "2026-2027" },
  ]);
  assert.equal(profile.studentId, "2023-00104");
  assert.equal(profile.academic, "BS Information Systems - 3rd Year - Section 3A");
  assert.equal(profile.term, "1st Semester A.Y. 2026-2027");
  assert.equal(studentProfile({ id: "private-uuid" }).studentId, "Not available");
});

test("recent activity excludes student submissions and keeps only recorded instructor decisions", () => {
  const events = recentRequestActivity([
    { id: "r-1", type: "absence", status: "approved", date_submitted: "2026-10-01", date_reviewed: "2026-10-03", enrollment: { class: { subject_name: "Math" } } },
    { id: "r-2", type: "late", status: "pending", date_submitted: "2026-10-02", subjects_missed: "English" },
    { id: "r-3", type: "late", status: "invalid", date_submitted: "invalid", updated_at: "2026-10-04" },
    { id: "r-4", type: "late", status: "noted", date_submitted: "2026-10-02", date_reviewed: "2026-10-04", subjects_missed: "Science" },
  ]);
  assert.deepEqual(events.map((event) => event.id), ["r-4-reviewed", "r-1-reviewed"]);
  assert.equal(events[0].requestId, "r-4");
  assert.match(events[0].message, /Science noted/);
  assert.match(events[1].message, /Math approved/);
  assert.deepEqual(recentRequestActivity([{ id: "pending", type: "absence", status: "pending", date_submitted: "2026-10-05" }]), []);
  assert.deepEqual(recentRequestActivity(), []);
});
