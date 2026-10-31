import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeReportRows, schoolWeek, departmentWeekRows } from "../src/pages/auth/admin/reports/reportData.js";

const headings = ["Request ID", "Student", "Program", "Subject", "Instructor", "Type", "Start Date", "End Date", "Reason", "Status", "Reviewed By", "Date Reviewed", "Flagged (IR)"];
test("report rows preserve server values as text and reject an unexpected spreadsheet", () => {
  const rows = normalizeReportRows([headings, ["r1", "<script>alert(1)</script>", "BSIS", "Math", "Ana", "absence", "2026-10-20", null, "Sick", "pending"]]);
  assert.equal(rows[0].Student, "<script>alert(1)</script>");
  assert.equal(rows[0]["End Date"], "");
  assert.throws(() => normalizeReportRows([["Unexpected"], ["value"]]), /report format/i);
  assert.deepEqual(normalizeReportRows([headings]), []);
});
test("school weeks use Manila Monday boundaries including Sunday UTC and year changes", () => {
  assert.deepEqual(schoolWeek(new Date("2026-10-25T17:00:00Z")), { date_from: "2026-10-26", date_to: "2026-11-01" });
  assert.deepEqual(schoolWeek(new Date("2026-10-28T04:00:00Z"), 1), { date_from: "2026-10-19", date_to: "2026-10-25" });
  assert.deepEqual(schoolWeek(new Date("2027-01-01T04:00:00Z"), 1), { date_from: "2026-12-21", date_to: "2026-12-27" });
});
test("weekly department totals count real reports in range and never invent missing late counts", () => {
  const records = [
    { "Request ID": "r1", Program: "BSIS", Type: "absence", "Start Date": "2026-10-20" },
    { "Request ID": "r2", Program: "BSIS", Type: "absence", "Start Date": "2026-10-27" },
    { "Request ID": "r3", Program: "BSA", Type: "absence", "Start Date": "2026-10-21" },
  ];
  const data = departmentWeekRows([{ program_name: "BSIS" }, { program_name: "BSA" }, { program_name: "BAB" }], records, { date_from: "2026-10-19", date_to: "2026-10-25" });
  assert.deepEqual(data.map(({ absences, lates }) => [absences, lates]), [[1, null], [1, null], [0, null]]);
});
