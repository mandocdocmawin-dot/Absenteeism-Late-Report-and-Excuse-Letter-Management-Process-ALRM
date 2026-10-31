import assert from "node:assert/strict";
import { test } from "node:test";
import { initialForm } from "../src/pages/auth/student/request-form/constants.js";
import { firstInvalidRequestStep, validateReview, validateStep } from "../src/pages/auth/student/request-form/validation.js";

const enrolledClass = { class_id: "class-one", subject_name: "Information Management" };
const evidenceFile = new File(["%PDF-1.7"], "proof.pdf", { type: "application/pdf" });
const check = (form, step, classes = [], classesError = "") =>
  validateStep({ form, step, classes, classesError });

test("request choice and privacy consent remain required", () => {
  assert.equal(check(initialForm, 0).requestType, "Select a request.");
  assert.equal(check(initialForm, 2).consent, "You must agree before continuing.");
  assert.deepEqual(check({ ...initialForm, consent: "agree" }, 2), {});
});

test("student details reject numeric guardian names and invalid phone prefixes", () => {
  const form = { ...initialForm, studentName: "Alex Student", program: "BS in Information Systems",
    level: "1st year", guardianName: "Guardian 123", contactNumber: "08123456789",
    dateSubmitted: "2026-10-13" };
  const errors = check(form, 3);
  assert.match(errors.guardianName, /must not contain numbers/);
  assert.match(errors.contactNumber, /10 digits after \+63.*starting with 9/);
  assert.deepEqual(check({ ...form, guardianName: "Alex Parent",
    contactNumber: "+639123456789" }, 3), {});
});

test("late and absence details require enrolled classes", () => {
  const late = { ...initialForm, requestType: "late", minutesLate: "15", startDateOfAbsence: "2026-10-13", classId: "class-one", reason: "Traffic" };
  assert.deepEqual(check(late, 4, [enrolledClass]), {});
  assert.match(check({ ...late, startDateOfAbsence: "" }, 4, [enrolledClass]).startDateOfAbsence, /date of tardiness/i);
  const absence = { ...initialForm, requestType: "absence", startDateOfAbsence: "2026-10-13",
    endDateOfAbsence: "2026-10-14", classId: "class-one",
    absenceReasons: ["Illness / Medical Condition"] };
  assert.deepEqual(check(absence, 4, [enrolledClass]), {});
  assert.match(check({ ...absence, classId: "unknown" }, 4, [enrolledClass]).classId,
    /enrolled classes/);
});

test("declaration is required at final review", () => {
  assert.equal(check(initialForm, 6).declaration, "Confirm the declaration before submitting.");
  assert.deepEqual(check({ ...initialForm, declaration: true }, 6), {});
});

test("both request types require a document before advancing from the attachment step", () => {
  for (const requestType of ["absence", "late"]) {
    const form = { ...initialForm, requestType };
    assert.match(check(form, 5).evidenceFile, /upload.*supporting document/i);
    assert.deepEqual(check({ ...form, evidenceFile }, 5), {});
  }
});

test("removing a required document during review blocks saving edits and submission", () => {
  for (const requestType of ["absence", "late"]) {
    const form = { ...initialForm, requestType, consent: "agree", studentName: "Alex Student",
      program: "BS in Information Systems", level: "1st year", guardianName: "Alex Parent",
      contactNumber: "09123456789", dateSubmitted: "2026-10-20", classId: "class-one",
      startDateOfAbsence: "2026-10-19", endDateOfAbsence: "2026-10-20",
      absenceReasons: ["Personal Reason"], minutesLate: "15", reason: "Traffic delay",
      evidenceFile, declaration: true };
    assert.equal(firstInvalidRequestStep(form, [enrolledClass]), null);
    const removed = { ...form, evidenceFile: null };
    assert.match(validateReview(removed, [enrolledClass]).evidenceFile, /supporting document/i);
    assert.equal(firstInvalidRequestStep(removed, [enrolledClass]).step, 5);
  }
});

test("inline review reports errors across student and request fields without requiring declaration to save", () => {
  const form = { ...initialForm, requestType: "late", consent: "agree",
    studentName: "Alex Student", program: "BS in Information Systems", level: "1st year",
    guardianName: "Parent 123", contactNumber: "08123456789", dateSubmitted: "2026-10-20",
    minutesLate: "0", startDateOfAbsence: "", classId: "unknown", reason: "x", declaration: false };
  const errors = validateReview(form, [enrolledClass]);
  for (const name of ["guardianName", "contactNumber", "minutesLate", "startDateOfAbsence", "classId", "reason"]) assert.ok(errors[name], name);
  assert.equal(errors.declaration, undefined);
  assert.deepEqual(validateReview({ ...form, guardianName: "Alex Parent", contactNumber: "09123456789",
    minutesLate: "15", startDateOfAbsence: "2026-10-20", classId: "class-one", reason: "Traffic delay", evidenceFile }, [enrolledClass]), {});
});

test("inline absence review validates dates and reason selection on the final page", () => {
  const form = { ...initialForm, requestType: "absence", consent: "agree", studentName: "Alex Student",
    program: "BS in Information Systems", level: "1st year", guardianName: "Alex Parent",
    contactNumber: "09123456789", dateSubmitted: "2026-10-20", classId: "class-one",
    startDateOfAbsence: "2026-10-20", endDateOfAbsence: "2026-10-19", absenceReasons: [] };
  const errors = validateReview(form, [enrolledClass]);
  assert.ok(errors.endDateOfAbsence);
  assert.ok(errors.absenceReasons);
  assert.deepEqual(validateReview({ ...form, endDateOfAbsence: "2026-10-21", absenceReasons: ["Personal Reason"], evidenceFile }, [enrolledClass]), {});
});

test("submission validation identifies a missing guardian name", () => {
  const form = { ...initialForm, requestType: "late", consent: "agree",
    studentName: "Alex Student", program: "BS in Information Systems", level: "1st year",
    guardianName: "Alex Parent", contactNumber: "09123456789", dateSubmitted: "2026-10-13",
    minutesLate: "15", startDateOfAbsence: "2026-10-13", classId: "class-one", reason: "Traffic", declaration: true, evidenceFile };
  assert.equal(firstInvalidRequestStep(form, [enrolledClass]), null);
  assert.deepEqual(firstInvalidRequestStep({ ...form, guardianName: "" }, [enrolledClass]), {
    step: 3, errors: { guardianName: "Enter a valid parent or guardian's name." },
  });
});
