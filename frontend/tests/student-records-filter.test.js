import assert from "node:assert/strict";
import test from "node:test";
import { filterRecords, reviewStatus } from "../src/pages/auth/student/records/recordData.js";
import { paginateRecords } from "../src/pages/auth/student/records/pagination.js";

const records = [
  { id: "absence-1", type: "absence", status: "approved", subjects_missed: "Math", start_date_of_absence: "2026-10-19", reason: "Illness" },
  { id: "late-1", type: "late", status: "pending", subjects_missed: "English", date_submitted: "2026-10-20", reason: "Traffic" },
  { id: "absence-2", type: "absence", status: "pending", enrollment: { class: { subject_name: "English" } }, start_date_of_absence: "2026-10-20", reason: "Personal reason" },
  { id: "late-2", type: "late", status: "approved", subjects_missed: "Math", date_submitted: "2026-10-18", reason: "Traffic" },
];

test("each tab contains only its own request type, ordered newest first", () => {
  assert.deepEqual(filterRecords(records, "absence").map((record) => record.id), ["absence-2", "absence-1"]);
  assert.deepEqual(filterRecords(records, "late").map((record) => record.id), ["late-1", "late-2"]);
  assert.equal(records[0].id, "absence-1");
});

test("subject and case-insensitive search stay scoped to the selected tab", () => {
  assert.deepEqual(filterRecords(records, "absence", "pending", "English").map((record) => record.id), ["absence-2"]);
  assert.deepEqual(filterRecords(records, "late", "  APPROVED ").map((record) => record.id), ["late-2"]);
  assert.deepEqual(filterRecords(records, "absence", "Traffic"), []);
});

test("ten-row pagination applies after filtering the record type", () => {
  const many = Array.from({ length: 24 }, (_, index) => ({ id: index, type: index % 2 ? "late" : "absence", status: "pending" }));
  for (const type of ["absence", "late"]) {
    const filtered = filterRecords(many, type);
    assert.equal(paginateRecords(filtered, 1).pageRecords.length, 10);
    assert.equal(paginateRecords(filtered, 2).pageRecords.length, 2);
    assert.ok(filtered.every((record) => record.type === type));
  }
});

test("status labels represent backend decisions without relabelling other outcomes", () => {
  assert.equal(reviewStatus("approved"), "Approved");
  assert.equal(reviewStatus("pending"), "Pending");
  assert.equal(reviewStatus("invalid"), "Invalid");
  assert.equal(reviewStatus("noted"), "Noted");
  assert.equal(reviewStatus("cancelled"), "Cancelled");
});
