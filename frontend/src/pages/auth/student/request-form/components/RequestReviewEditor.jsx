import { absenceReasonOptions, LIMITS, proofOptions, requestOptions } from "../constants";
import { classLabel } from "../utils";
import ReviewAttachment from "./ReviewAttachment";
import ReviewRadioGroup from "./ReviewRadioGroup";
import ReviewField from "./ReviewField";

export default function RequestReviewEditor({ form, user, classes, classesLoading, classesError, fieldErrors = {}, updateField, disabled }) {
  const isAbsence = form.requestType === "absence";
  const fields = [
    { name: "requestType", label: "Request type", options: requestOptions },
    { name: "studentName", label: "Student name", readOnly: true },
    { name: "email", label: "Email address", value: user?.email || "Not available", readOnly: true },
    { name: "schoolId", label: "Student ID", value: user?.school_id_number || "Not available", readOnly: true },
    { name: "program", label: "Program", readOnly: true },
    { name: "level", label: "Year level", readOnly: true },
    { name: "guardianName", label: "Parent/Guardian's name", maxLength: LIMITS.guardianName },
    { name: "contactNumber", label: "Contact number", phone: true },
    { name: "dateSubmitted", label: "Date submitted", type: "date" },
    { name: "classId", label: "Subject/Class", options: classes.map((item) => ({ value: item.class_id, label: classLabel(item) })), loading: classesLoading, disabled: classesLoading, error: fieldErrors.classId || classesError },
    ...(isAbsence ? [
      { name: "startDateOfAbsence", label: "Start date of absence", type: "date" },
      { name: "endDateOfAbsence", label: "End date of absence", type: "date", min: form.startDateOfAbsence || undefined },
    ] : [
      { name: "startDateOfAbsence", label: "Date of tardiness", type: "date" },
      { name: "minutesLate", label: "Minutes late", type: "number", min: 1, max: 999, step: 1 },
      { name: "reason", label: "Reason for being late", multiline: true, wide: true, maxLength: LIMITS.reason },
    ]),
  ];
  return <fieldset disabled={disabled} aria-label="Edit request details" className="grid min-w-0 gap-x-6 gap-y-5 sm:grid-cols-2">
    {fields.map((field) => <ReviewField key={field.name} value={form[field.name]} error={fieldErrors[field.name]} onChange={(value) => updateField(field.name, value)} {...field} />)}
    {isAbsence && <ReviewRadioGroup name="absenceReasons" label="Reason of absence" options={absenceReasonOptions} selected={form.absenceReasons} onChange={updateField} error={fieldErrors.absenceReasons} />}
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="text-sm font-semibold">Supporting document types</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {proofOptions.map((proof) => <label key={proof} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="proof_types" value={proof} checked={(form.proof_types || []).includes(proof)} onChange={(event) => updateField("proof_types", event.target.checked
            ? [...(form.proof_types || []), proof]
            : (form.proof_types || []).filter((item) => item !== proof))} aria-invalid={Boolean(fieldErrors.proof_types)} />
          {proof}
        </label>)}
      </div>
      {fieldErrors.proof_types && <span role="alert" className="text-sm text-red-600">{fieldErrors.proof_types}</span>}
    </fieldset>
    <ReviewAttachment file={form.evidenceFile} error={fieldErrors.evidenceFile} />
  </fieldset>;
}
