import { CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import AttendanceGauge from "./AttendanceGauge";

const appearances = {
  safe: { label: "Safe", color: "#16a34a", text: "text-green-700 dark:text-green-400" },
  warning: { label: "Warning", color: "#ff7113", text: "text-[#aa4808] dark:text-orange-400" },
  critical: { label: "Critical", color: "#dc2626", text: "text-red-700 dark:text-red-400" },
  IR: { label: "Incident Report", color: "#dc2626", text: "text-red-700 dark:text-red-400" },
};

function available(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatNumber(value, suffix = "") {
  if (!available(value) || !Number.isFinite(Number(value))) return "Unavailable";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

export default function AttendanceThreshold({ threshold = {}, alertsEnabled = true }) {
  const backendStatus = available(threshold.status) ? String(threshold.status) : "";
  const appearance = appearances[backendStatus] || { label: backendStatus || "Unavailable", color: "#64748b", text: "text-slate-600 dark:text-slate-300" };
  const Icon = backendStatus === "safe" ? ShieldCheck : TriangleAlert;

  const subjects = Array.isArray(threshold.subject_thresholds) ? threshold.subject_thresholds : [];

  return <article className="flex min-h-[225px] min-w-0 flex-col overflow-hidden rounded-[7px] border border-[#c9c6c6] bg-white shadow-[0_1px_1px_#0000000d] dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-[17px] pt-[9px]">
      <h2 className="flex items-center gap-2 text-[14px] font-normal leading-5">Overall Attendance <span title="Overall values cover all current-semester subjects."><CircleAlert className="size-[19px] shrink-0 text-[#717171] dark:text-slate-400" aria-hidden="true" /></span></h2>
    </div>
    <div className="flex flex-1 items-center gap-4 px-3 py-[17px]">
      <AttendanceGauge used={threshold.used} limit={threshold.limit} color={appearance.color} />
      <div className="min-w-0 flex-1">
        <h3 className={`flex items-center gap-1.5 text-[12px] font-normal leading-[15px] ${appearance.text}`}><Icon className="size-5 shrink-0" aria-hidden="true" />{alertsEnabled ? appearance.label : "Attendance Overview"}</h3>
        <dl className="mt-2 grid gap-1 text-[11px] leading-[14px] text-[#464646] dark:text-slate-300">
          <div><dt className="inline font-medium">Used contact hours:</dt> <dd className="inline">{formatNumber(threshold.used)}</dd></div>
          <div><dt className="inline font-medium">Absence limit:</dt> <dd className="inline">{formatNumber(threshold.limit, " hours")}</dd></div>
          <div><dt className="inline font-medium">Overall absence:</dt> <dd className="inline">{formatNumber(threshold.absence_percentage, "%")}</dd></div>
          <div><dt className="inline font-medium">Remaining allowance:</dt> <dd className="inline">{formatNumber(threshold.remaining_hours, " hours")}</dd></div>
          <div><dt className="inline font-medium">Remaining before 20% limit:</dt> <dd className="inline">{formatNumber(threshold.remaining_semester_percentage, "%")}</dd></div>
        </dl>
      </div>
    </div>
    <p className="flex min-h-[54px] items-center gap-1 bg-[#f6f6f6] px-[9px] py-3 text-[12px] leading-4 dark:bg-slate-800/60">Overall status: <span className={appearance.text}>{appearance.label}</span></p>
    <section aria-labelledby="subject-attendance-heading" className="border-t border-[#c9c6c6] p-3 dark:border-slate-700">
      <h3 id="subject-attendance-heading" className="text-xs font-semibold">Subject attendance</h3>
      {subjects.length ? <ul className="mt-2 grid gap-2">
        {subjects.map((subject) => {
          const subjectAppearance = appearances[subject.status] || { label: subject.status || "Unavailable", text: "text-slate-600 dark:text-slate-300" };
          return <li key={subject.class_id} className="rounded border border-slate-200 p-2 text-[11px] dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-semibold">{subject.subject_name || "Unnamed subject"}</span><span className={subjectAppearance.text}>{subjectAppearance.label}</span></div>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{formatNumber(subject.absences)} {Number(subject.absences) === 1 ? "absence" : "absences"} · {formatNumber(subject.used_hours, " hours")} · {formatNumber(subject.absence_percentage, "%")} · IR at {formatNumber(subject.ir_absence_limit)} absences</p>
          </li>;
        })}
      </ul> : <p className="mt-2 text-xs text-slate-500">No enrolled subjects available.</p>}
    </section>
  </article>;
}
