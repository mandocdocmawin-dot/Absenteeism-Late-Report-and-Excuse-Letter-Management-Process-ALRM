import { assertValidInputs, isWholeNumber, sanitizeText } from "../../../../lib/inputValidation.js";
import { historicalRequestClass } from "../../../../lib/requestHistory.js";

function buildReason(form, isAbsence) {
  if (isAbsence) {
    return form.absenceReasons.join(", ");
  }

  return sanitizeText(form.reason, { multiline: true });
}

export function buildRequestPayload(form, classes, evidence = null) {
  const isAbsence = form.requestType === "absence";

  const matchedClass = classes.find(
    (item) => String(item?.class_id) === String(form.classId),
  );

  return {
    class_id: matchedClass?.class_id || form.classId,
    teaching_assignment_id: matchedClass?.teaching_assignment_id,
    type: form.requestType,
    subjects_missed: matchedClass?.subject_name || "",
    minutes_late: isAbsence ? null : Number(form.minutesLate),
    start_date_of_absence: form.startDateOfAbsence,
    end_date_of_absence: isAbsence ? form.endDateOfAbsence : null,
    reason: buildReason(form, isAbsence),
    proof_types: isAbsence ? [...(form.proof_types || [])] : [],
    evidence_file_url: evidence?.path || null,
    evidence_type: evidence?.type || null,
    guardian_name: sanitizeText(form.guardianName),
    contact_number: sanitizeText(form.contactNumber),
  };
}

export function proofTypeError(errors = {}) {
  return [...new Set(Object.entries(errors || {})
    .filter(([key]) => key === "proof_types" || key.startsWith("proof_types."))
    .flatMap(([, messages]) => Array.isArray(messages) ? messages : [messages])
    .filter(Boolean))].join(" ");
}

export function requestReason(record) {
  const reason = String(record.reason || "").trim();
  const prefix = record.type === "absence" ? "Reason(s) of absence: " : "Reason: ";
  const legacy = reason.split(/\r?\n/).find((line) => line.startsWith(prefix));
  return legacy ? legacy.slice(prefix.length).trim() : reason;
}

export function buildRequestEditForm(record) {
  return {
    type: record.type,
    subjects_missed: record.subjects_missed || historicalRequestClass(record)?.subject_name || "",
    reason: requestReason(record),
    minutes_late: String(record.minutes_late ?? ""),
    start_date_of_absence: record.start_date_of_absence?.slice(0, 10) || "",
    end_date_of_absence: record.end_date_of_absence?.slice(0, 10) || "",
    proof_types: Array.isArray(record.proof_types) ? [...record.proof_types] : [],
  };
}

export function buildRequestUpdatePayload(form) {
  const isAbsence = form.type === "absence";
  if (!isAbsence) {
    assertValidInputs({ minutes_late: isWholeNumber(form.minutes_late) ? '' : 'Minutes late must be a whole number between 1 and 999.' });
  }
  return {
    type: form.type,
    subjects_missed: form.subjects_missed,
    reason: sanitizeText(form.reason, { multiline: true }),
    minutes_late: isAbsence ? null : Number(form.minutes_late),
    start_date_of_absence: form.start_date_of_absence,
    end_date_of_absence: isAbsence ? form.end_date_of_absence || null : null,
    proof_types: isAbsence ? [...(form.proof_types || [])] : [],
  };
}
