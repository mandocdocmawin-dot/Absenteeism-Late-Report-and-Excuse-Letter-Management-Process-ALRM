import test from "node:test";
import assert from "node:assert/strict";
import { filterReportRows, formatRiskPercentage, instructorRows, monthlyActivity, requestDate } from "../src/pages/auth/programHead/programHeadData.js";

const makeRequest = (type, date, instructorId = "i-1") => ({
  type,
  date_submitted: date,
  enrollment: { class: { id: "class-1", subject_name: "Data Structures", instructor: { id: instructorId, name: instructorId === "i-1" ? "Ada" : "Grace" } } },
});

test("instructor list groups actual program requests without duplicating classes", () => {
  const rows = instructorRows([
    makeRequest("absence", "2026-10-01"), makeRequest("late", "2026-10-02"), makeRequest("absence", "2026-10-03", "i-2"),
  ]);
  assert.deepEqual(rows.map(({ name, absences, lates, classes }) => [name, absences, lates, classes.length]), [
    ["Ada", 1, 1, 1], ["Grace", 1, 0, 1],
  ]);
});

test("requests without an instructor are not represented as roster entries", () => {
  assert.deepEqual(instructorRows([{ type: "late", enrollment: { class: { id: "class-1" } } }]), []);
});

test("monthly activity counts absence and late requests by submission month", () => {
  const rows = monthlyActivity([
    makeRequest("absence", "2026-09-01"), makeRequest("late", "2026-09-30"), makeRequest("late", "2026-10-02"),
  ], 2, new Date(2026, 9, 14));
  assert.deepEqual(rows.map(({ label, absences, lates }) => [label, absences, lates]), [["Sep", 1, 1], ["Oct", 0, 1]]);
});

test("report date filters are inclusive and ignore invalid dated rows", () => {
  const rows = [makeRequest("late", "2026-10-01"), makeRequest("late", "2026-10-03"), makeRequest("late", "bad-date")];
  assert.deepEqual(filterReportRows(rows, "2026-10-01", "2026-10-01", requestDate), [rows[0]]);
});

test("risk percentages are formatted without inventing missing attendance data", () => {
  assert.equal(formatRiskPercentage(14.58), "14.58%");
  assert.equal(formatRiskPercentage(20), "20%");
  assert.equal(formatRiskPercentage(null), "Unavailable");
});
