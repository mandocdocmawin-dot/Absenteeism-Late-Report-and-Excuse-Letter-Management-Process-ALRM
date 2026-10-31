import { classLabel, dueDate, formatDate, occurrenceDate, requestCourse, submittedDate } from "./requestData";

export default function RequestFacts({ request }) {
  const fields = [
    ["Student", request.enrollment?.student?.name], ["Class", classLabel(requestCourse(request))],
    ["Type", request.type === "absence" ? "Absent" : "Late"],
    ["Date of Occurrence", formatDate(occurrenceDate(request))],
    ...(request.type === "absence" ? [["End of Absence", formatDate(request.end_date_of_absence)]] : [["Minutes Late", request.minutes_late]]),
    ["Submitted", formatDate(submittedDate(request))], ["Date of Due", formatDate(dueDate(request))],
    ["Reason", request.reason], ["Proof", Array.isArray(request.proof_types) ? request.proof_types.join(", ") : null],
  ];
  return <dl className="grid gap-4 text-sm sm:grid-cols-2">
    {fields.map(([label, value]) => <div key={label} className={`min-w-0 ${["Class", "Reason", "Proof"].includes(label) ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">{value ?? "Unavailable"}{value === "" && "Unavailable"}</dd>
    </div>)}
  </dl>;
}
