import assert from "node:assert/strict";
import { test } from "node:test";
import { initialForm } from "../src/pages/auth/student/request-form/constants.js";
import { buildRequestPayload } from "../src/pages/auth/student/request-form/buildPayload.js";

const classes = [{ class_id: "class-one", subject_name: "Information Management" }];
const contact = { guardianName: "  Alex Parent  ", contactNumber: "09123456789" };

test("late requests include the filled guardian, contact, and class", () => {
  const payload = buildRequestPayload({
    ...initialForm, ...contact, requestType: "late", classId: "class-one",
    minutesLate: "15", startDateOfAbsence: "2026-10-13", reason: "Traffic",
  }, classes);

  assert.equal(payload.guardian_name, "Alex Parent");
  assert.equal(payload.contact_number, "09123456789");
  assert.equal(payload.class_id, "class-one");
  assert.equal(payload.subjects_missed, "Information Management");
  assert.equal(payload.reason, "Traffic");
  assert.equal(payload.start_date_of_absence, "2026-10-13");
});

test("absence requests include the same guardian and contact fields", () => {
  const payload = buildRequestPayload({
    ...initialForm, ...contact, requestType: "absence", classId: "class-one",
    startDateOfAbsence: "2026-10-13", endDateOfAbsence: "2026-10-14",
    absenceReasons: ["Illness / Medical Condition"],
  }, classes);

  assert.equal(payload.guardian_name, "Alex Parent");
  assert.equal(payload.contact_number, "09123456789");
  assert.equal(payload.class_id, "class-one");
  assert.equal(payload.minutes_late, null);
});
