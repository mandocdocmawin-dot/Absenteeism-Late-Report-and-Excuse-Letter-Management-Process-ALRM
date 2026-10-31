import { absenceReasonOptions, LIMITS, proofOptions } from "./constants.js";
import { yearOptionsForProgram } from "./utils.js";
import { isValidDate, personNamePattern, sanitizeText } from "../../../../lib/inputValidation.js";

function validateStudentInfo(form) {
  const errors = {};

  if (!form.studentName.trim() || form.studentName.trim().length < 2) {
    errors.studentName = "Enter a valid student name.";
  } else if (form.studentName.trim().length > LIMITS.studentName) {
    // NEW
    errors.studentName = `Student name must not exceed ${LIMITS.studentName} characters.`;
  }
  if (!form.program) errors.program = "Select your program.";
  if (!form.level) {
    errors.level = "Select your level.";
  } else if (!yearOptionsForProgram(form.program).includes(form.level)) {
    errors.level = "Select an available level for your program.";
  }
  if (!form.guardianName.trim() || form.guardianName.trim().length < 2) {
    errors.guardianName = "Enter a valid parent or guardian's name.";
  } else if (form.guardianName.trim().length > LIMITS.guardianName) {
    // NEW
    errors.guardianName = `Parent or guardian's name must not exceed ${LIMITS.guardianName} characters.`;
  } else if (/\p{N}/u.test(form.guardianName.trim())) {
    errors.guardianName = "Parent or guardian's name must not contain numbers.";
  } else if (!personNamePattern.test(form.guardianName)) {
    errors.guardianName = "Enter a valid parent or guardian's name.";
  }
  if (!form.contactNumber.trim()) {
    errors.contactNumber = "Enter your contact number.";
  } else if (!/^(09\d{9}|\+639\d{9})$/.test(form.contactNumber.trim())) {
    errors.contactNumber =
      "Enter all 10 digits after +63, starting with 9.";
  }
  if (!isValidDate(form.dateSubmitted)) errors.dateSubmitted = "Choose a valid date.";

  return errors;
}

function validateDetails(form, classes, classesError) {
  const errors = {};

  if (form.requestType === "late" && !form.minutesLate.trim()) {
    errors.minutesLate = "Enter minutes late.";
  } else if (
    form.requestType === "late" &&
    (!/^\d+$/.test(form.minutesLate.trim()) ||
      Number(form.minutesLate.trim()) <= 0)
  ) {
    errors.minutesLate = "Enter a valid number of minutes.";
  } else if (
    form.requestType === "late" &&
    form.minutesLate.trim().length > LIMITS.minutesLate
  ) {
    // NEW
    errors.minutesLate = "Enter a valid number of minutes (max 999).";
  }
  if (["absence", "late"].includes(form.requestType) && !isValidDate(form.startDateOfAbsence)) {
    errors.startDateOfAbsence = form.requestType === "late"
      ? "Choose a valid date of tardiness."
      : "Choose a valid start date of absence.";
  }
  if (form.requestType === "absence" && !isValidDate(form.endDateOfAbsence)) {
    errors.endDateOfAbsence = "Choose a valid end date of absence.";
  }
  if (
    form.requestType === "absence" &&
    form.startDateOfAbsence &&
    form.endDateOfAbsence &&
    form.endDateOfAbsence < form.startDateOfAbsence
  ) {
    errors.endDateOfAbsence =
      "End date must be the same as or later than the start date.";
  }

  // CHANGED: pareho na ang late at absence (dropdown)
  if (!form.classId) {
    errors.classId = classesError || "Select your class.";
  } else if (
    classes.length > 0 &&
    !classes.some((item) => String(item?.class_id) === String(form.classId))
  ) {
    errors.classId = "Select a class from your enrolled classes.";
  }

  if (form.requestType === "late" && !form.reason.trim()) {
    errors.reason = "Enter your reason.";
  } else if (form.requestType === "late" && form.reason.trim().length < 3) {
    errors.reason = "Enter a valid reason.";
  } else if (
    form.requestType === "late" &&
    form.reason.trim().length > LIMITS.reason
  ) {
    // NEW
    errors.reason = `Reason must not exceed ${LIMITS.reason} characters.`;
  }
  if (form.requestType === "absence" && (!Array.isArray(form.absenceReasons) || !form.absenceReasons.length || new Set(form.absenceReasons).size !== form.absenceReasons.length || form.absenceReasons.some(reason => !absenceReasonOptions.includes(reason)))) {
    errors.absenceReasons = "Select at least one available reason.";
  }

  return errors;
}

export function validateStep({ step, form, classes = [], classesError }) {
  form = { ...form, studentName: sanitizeText(form.studentName), guardianName: sanitizeText(form.guardianName), contactNumber: sanitizeText(form.contactNumber), reason: sanitizeText(form.reason, { multiline: true }) };
  if (step === 0) {
    return ["absence", "late"].includes(form.requestType) ? {} : { requestType: "Select a request." };
  }

  if (step === 2) {
    return form.consent === "agree"
      ? {}
      : { consent: "You must agree before continuing." };
  }

  if (step === 3) return validateStudentInfo(form);

  if (step === 4) return validateDetails(form, classes, classesError);

  if (step === 5) {
    if (form.requestType === "absence" && (!Array.isArray(form.proof_types) || new Set(form.proof_types).size !== form.proof_types.length || form.proof_types.some(proof => !proofOptions.includes(proof)))) {
      return { proof_types: "Select valid supporting document types." };
    }
    return form.evidenceFile
      ? {}
      : { evidenceFile: "Upload a supporting document before continuing." };
  }

  if (step === 6) {
    return form.declaration
      ? {}
      : { declaration: "Confirm the declaration before submitting." };
  }

  return {};
}

export function firstInvalidRequestStep(form, classes, classesError = "") {
  for (let step = 0; step <= 6; step += 1) {
    const errors = validateStep({ step, form, classes, classesError });
    if (Object.keys(errors).length > 0) return { step, errors };
  }

  return null;
}

export function validateReview(form, classes, classesError = "") {
  return Object.assign({}, ...[0, 2, 3, 4, 5].map((step) =>
    validateStep({ step, form, classes, classesError })));
}
