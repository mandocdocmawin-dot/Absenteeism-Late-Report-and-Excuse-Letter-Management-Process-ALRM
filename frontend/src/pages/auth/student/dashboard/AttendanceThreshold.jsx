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

  return <article className="flex min-h-[225px] min-w-0 flex-col overflow-hidden rounded-[7px] border border-[#c9c6c6] bg-white shadow-[0_1px_1px_#0000000d] dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-[17px] pt-[9px]">
      <h2 className="flex items-center gap-2 text-[14px] font-normal leading-5">Attendance Threshold <span title="Values are calculated by the backend from recorded contact hours."><CircleAlert className="size-[19px] shrink-0 text-[#717171] dark:text-slate-400" aria-hidden="true" /></span></h2>
      <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] leading-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><span className="size-1 rounded-full bg-current" />Backend result</span>
    </div>
    <div className="flex flex-1 items-center gap-4 px-3 py-[17px]">
      <AttendanceGauge used={threshold.used} limit={threshold.limit} color={appearance.color} />
      <div className="min-w-0 flex-1">
        <h3 className={`flex items-center gap-1.5 text-[12px] font-normal leading-[15px] ${appearance.text}`}><Icon className="size-5 shrink-0" aria-hidden="true" />{alertsEnabled ? appearance.label : "Attendance Overview"}</h3>
        <dl className="mt-2 grid gap-1 text-[11px] leading-[14px] text-[#464646] dark:text-slate-300">
          <div><dt className="inline font-medium">Used contact hours:</dt> <dd className="inline">{formatNumber(threshold.used)}</dd></div>
          <div><dt className="inline font-medium">Absence limit:</dt> <dd className="inline">{formatNumber(threshold.limit, " hours")}</dd></div>
          <div><dt className="inline font-medium">Remaining semester percentage:</dt> <dd className="inline">{formatNumber(threshold.remaining_semester_percentage, "%")}</dd></div>
        </dl>
      </div>
    </div>
    <p className="flex min-h-[54px] items-center gap-1 bg-[#f6f6f6] px-[9px] py-3 text-[12px] leading-4 dark:bg-slate-800/60">Status: <span className={appearance.text}>{appearance.label}</span></p>
  </article>;
}
