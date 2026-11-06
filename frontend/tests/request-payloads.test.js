import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRequestPayload, buildRequestEditForm, buildRequestUpdatePayload, proofTypeError } from "../src/pages/auth/student/request-form/buildPayload.js";
import { initialForm, proofOptions } from "../src/pages/auth/student/request-form/constants.js";

const classes = [{ class_id: "class-1", subject_name: "Math" }];
const form = { ...initialForm, requestType: "absence", classId: "class-1", absenceReasons: ["Family Emergency"], guardianName: "Test Guardian", contactNumber: "09000000000", startDateOfAbsence: "2026-10-12", endDateOfAbsence: "2026-10-12" };

test("proof options exactly match the backend allowlist", () => {
  assert.deepEqual(proofOptions, ["Medical Certificate", "Prescription / Medical Record", "Death Certificate / Funeral Notice", "School Activity Endorsement", "Letter from Parent/Guardian", "Others"]);
  assert.deepEqual(initialForm.proof_types, []);
});

test("absence create separates proof labels, reason, attachment MIME and contact fields", () => {
  const payload = buildRequestPayload({ ...form, proof_types: ["Medical Certificate", "Letter from Parent/Guardian"] }, classes, { path: "attachment-1", type: "image/jpeg" });
  assert.deepEqual(payload.proof_types, ["Medical Certificate", "Letter from Parent/Guardian"]);
  assert.equal(payload.reason, "Family Emergency");
  assert.equal(payload.evidence_type, "image/jpeg");
  assert.equal(payload.evidence_file_url, "attachment-1");
  assert.equal(payload.guardian_name, "Test Guardian");
  assert.equal(payload.contact_number, "09000000000");
});

test("late create sends selected proofs, attachment MIME, and a plain explanation", () => {
  const payload = buildRequestPayload({ ...form, requestType: "late", reason: " may sakit po e ", minutesLate: "23", proof_types: ["Others"] }, classes, { path: "attachment-2", type: "application/pdf" });
  assert.equal(payload.reason, "may sakit po e");
  assert.equal(payload.minutes_late, 23);
  assert.equal(payload.start_date_of_absence, "2026-10-12");
  assert.equal(payload.end_date_of_absence, null);
  assert.deepEqual(payload.proof_types, ["Others"]);
  assert.equal(payload.evidence_type, "application/pdf");
});

test("late edit preserves its occurrence date", () => {
  const edit = buildRequestEditForm({ type: "late", subjects_missed: "Math", minutes_late: 23, reason: "Traffic", start_date_of_absence: "2026-10-12T00:00:00.000000Z" });
  assert.equal(buildRequestUpdatePayload(edit).start_date_of_absence, "2026-10-12");
});

test("edit preserves required proof selections and attachment MIME metadata", () => {
  const record = { type: "absence", subjects_missed: "Math", reason: "Family Emergency", start_date_of_absence: "2026-10-12T00:00:00.000000Z", end_date_of_absence: "2026-10-12T00:00:00.000000Z", evidence_type: "application/pdf", proof_types: ["School Activity Endorsement"] };
  const edit = buildRequestEditForm(record);
  assert.deepEqual(edit.proof_types, record.proof_types);
  edit.proof_types.push("Others");
  assert.deepEqual(record.proof_types, ["School Activity Endorsement"]);
  assert.equal(edit.start_date_of_absence, "2026-10-12");
  const payload = buildRequestUpdatePayload(edit);
  assert.deepEqual(payload.proof_types, ["School Activity Endorsement", "Others"]);
  assert.equal(payload.evidence_type, "application/pdf");
  assert.equal(Object.hasOwn(payload, "evidence_file_url"), false);
});

test("older records keep legacy summaries out of the reason but expose missing required evidence metadata", () => {
  const edit = buildRequestEditForm({ type: "late", subjects_missed: "Math", minutes_late: 23, reason: "Late by 23 minute(s).\nReason: may sakit po e\nParent/Guardian: Test\nContact: 09000000000" });
  assert.deepEqual(edit.proof_types, []);
  assert.equal(buildRequestUpdatePayload(edit).reason, "may sakit po e");
  assert.equal(buildRequestUpdatePayload(edit).minutes_late, 23);
  assert.equal(buildRequestUpdatePayload(edit).evidence_type, "");
});

test("proof validation errors include parent, indexed and wildcard entries", () => {
  assert.equal(proofTypeError({ proof_types: ["Select valid proofs."], "proof_types.0": ["Invalid label."], "proof_types.*": ["Invalid label."], reason: ["Unrelated"] }), "Select valid proofs. Invalid label.");
  assert.equal(proofTypeError(), "");
});
