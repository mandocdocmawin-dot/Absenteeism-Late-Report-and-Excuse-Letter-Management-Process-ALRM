import { buildRequestPayload } from "../buildPayload";
import { classLabel, normalizePhoneInput } from "../utils";
import SectionBox from "./SectionBox";
import RequestReviewEditor from "./RequestReviewEditor";

function SummaryField({ label, value, wide = false }) {
  return <div className={`grid min-w-0 content-start gap-1 ${wide ? "sm:col-span-2" : ""}`}>
    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="whitespace-pre-wrap break-words text-sm font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{value || "Not provided"}</dd>
  </div>;
}

export default function RequestSummary({ form, user, classes = [], editing, onStartEdit, onSaveEdit, disabled = false, ...editorProps }) {
  const payload = buildRequestPayload(form, classes);
  const selectedClass = classes.find((item) => String(item.class_id) === String(form.classId));
  const isAbsence = form.requestType === "absence";
  const file = form.evidenceFile;
  const fields = [
    ["Request type", isAbsence ? "Absence" : "Late"],
    ["Student name", form.studentName],
    ["Email address", user?.email],
    ["Student ID", user?.school_id_number],
    ["Program", form.program],
    ["Year level", form.level],
    ["Parent/Guardian's name", payload.guardian_name],
    ["Contact number", normalizePhoneInput(payload.contact_number).replace(/^\+63(9\d{2})(\d{3})(\d{4})$/, "+63-$1-$2-$3")],
    ["Date submitted", form.dateSubmitted],
    ["Subject/Class", selectedClass ? classLabel(selectedClass) : "Not selected"],
    ...(isAbsence ? [
      ["Start date of absence", payload.start_date_of_absence],
      ["End date of absence", payload.end_date_of_absence],
    ] : [
      ["Date of tardiness", payload.start_date_of_absence],
      ["Minutes late", form.minutesLate ? `${payload.minutes_late} ${payload.minutes_late === 1 ? "minute" : "minutes"}` : ""],
    ]),
  ];

  return <SectionBox className="dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-black uppercase tracking-normal text-[#101C4A] dark:text-blue-200">Review Request</h2>
      {onStartEdit && <button type="button" onClick={editing ? onSaveEdit : onStartEdit} disabled={disabled} aria-label={editing ? "Save request changes" : "Edit request"} className="shrink-0 rounded-sm text-xs font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300">{editing ? "Save changes" : "Edit"}</button>}
    </div>
    {editing ? <RequestReviewEditor form={form} user={user} classes={classes} disabled={disabled} {...editorProps} /> : <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {fields.map(([label, value]) => <SummaryField key={label} label={label} value={value} />)}
      <SummaryField label={isAbsence ? "Reason of absence" : "Reason for being late"} value={payload.reason} wide />
      {isAbsence && <SummaryField label="Supporting document types" value={payload.proof_types.join(", ") || "None selected"} wide />}
      <SummaryField label="Supporting document" value={file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "No file selected"} wide />
    </dl>}
  </SectionBox>;
}
