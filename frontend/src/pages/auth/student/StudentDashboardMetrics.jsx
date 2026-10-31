import { Clock, RefreshCw, UserRoundX } from "lucide-react";
import { ErrorState } from "@/components/common/ErrorState";
import { RecordedMetricPlaceholder, StudentClassDetailsPlaceholder, ThresholdPlaceholder } from "@/components/loading/DashboardSkeleton/StudentDashboardPlaceholder";
import AttendanceThreshold from "./dashboard/AttendanceThreshold";
import { requestTotals } from "./dashboard/studentOverview";

function RecordedMetric({ title, value, icon: Icon, children }) {
  return <article className="flex min-h-[225px] min-w-0 flex-col overflow-hidden rounded-[7px] border border-[#c9c6c6] bg-white shadow-[0_1px_1px_#0000000d] dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-1 items-start justify-between gap-2 px-[9px] pt-[17px] pb-4">
      <div className="min-w-0"><h2 className="max-w-24 text-[14px] font-normal leading-[18px]">{title}</h2><p className={`mt-[25px] break-words font-semibold leading-[34px] tabular-nums ${value == null ? "text-sm" : "text-[28px]"}`}>{value ?? "Unavailable"}</p></div>
      <Icon className="mt-[7px] size-5 shrink-0 text-[#717171] dark:text-slate-400" aria-hidden="true" />
    </div>
    <div className="flex min-h-[70px] items-center bg-[#f6f6f6] px-[9px] py-3 text-[11px] leading-[13px] text-[#464646] dark:bg-slate-800/60 dark:text-slate-300"><div className="min-w-0">{children}</div></div>
  </article>;
}

export function StudentDashboardResourceError({ title, error, onRetry }) {
  return <div role="alert" className="min-w-0 p-3">
    <ErrorState title={title} message={error} />
    <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded px-2 text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"><RefreshCw aria-hidden="true" className="size-4" />Retry</button>
  </div>;
}

export default function StudentDashboardMetrics({ requests, threshold, classes, alertsEnabled = true }) {
  const totals = requests.data ? requestTotals(requests.data) : null;
  return <section aria-label="Attendance overview" className="mt-8 grid gap-5 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,2.19fr)_minmax(0,1fr)] @[800px]:gap-[26px]">
    {requests.loading ? <RecordedMetricPlaceholder /> : <RecordedMetric title="Absences Recorded" value={totals?.absences} icon={UserRoundX}>
      {totals ? <>
        {classes.loading ? <StudentClassDetailsPlaceholder /> : classes.error ? "Course count unavailable." : `Across ${classes.data.length} enrolled ${classes.data.length === 1 ? "course" : "courses"}`}<br />
        ({totals.excused} excused, {totals.unexcused} unexcused{totals.pending ? `, ${totals.pending} pending` : ""})
      </> : "Recorded requests are unavailable."}
    </RecordedMetric>}
    {threshold.loading ? <ThresholdPlaceholder /> : threshold.error ? <article className="min-h-[225px] min-w-0 rounded-[7px] border border-[#c9c6c6] dark:border-slate-700">
      <StudentDashboardResourceError title="Attendance unavailable" error={threshold.error} onRetry={threshold.reload} />
    </article> : <AttendanceThreshold threshold={threshold.data} alertsEnabled={alertsEnabled} />}
    {requests.loading ? <RecordedMetricPlaceholder /> : <RecordedMetric title="Lates Recorded" value={totals?.lates} icon={Clock}>{totals ? "Total recorded tardiness across all registered schedules." : "Recorded requests are unavailable."}</RecordedMetric>}
  </section>;
}
