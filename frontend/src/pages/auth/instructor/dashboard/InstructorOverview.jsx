import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { ResourceState } from "@/components/dashboard/ResourceState";
import { InstructorChartPlaceholder, InstructorHeadingPlaceholder, InstructorMetricPlaceholder, InstructorNoticePlaceholder, InstructorSummaryPlaceholder } from "@/components/loading/DashboardSkeleton/InstructorDashboardPlaceholder";
import ClassRecordsTable from "../InstructorClassRecords/ClassRecordsTable";
import WeeklyReportsChart from "./WeeklyReportsChart";

const summaryColumns = [{ label: "Course & Section", width: "28%" }, { label: "Schedule", width: "27%" }, { label: "Absences", width: "14%" }, { label: "Lates", width: "14%" }, { label: "Action", width: "17%" }];
const linkStyle = "font-medium text-[#0969FF] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";

function Metrics({ overview, loading, errors }) {
  const metrics = [
    { label: "Total students", value: overview.totalStudents ?? "Unavailable", detail: overview.totalClasses == null ? "Assigned classes" : `Across ${overview.totalClasses} assigned ${overview.totalClasses === 1 ? "class" : "classes"}`, color: "text-slate-700" },
    { label: "Absence reports today", value: overview.today.absences, detail: "Submitted across your classes", color: "text-[#ED2532]", dot: "bg-[#ED2532]" },
    { label: "Late reports today", value: overview.today.lates, detail: "Submitted late reports", color: "text-[#EA6500]", dot: "bg-[#FF7814]" },
    { label: "Pending requests", value: overview.pending.total, detail: `${overview.pending.absences} excuse notes, ${overview.pending.lates} late reports`, color: "text-[#203B82]", dot: "bg-[#0969FF]", to: `/instructor/class-requests?status=pending&type=${overview.pending.absences === 0 && overview.pending.lates > 0 ? "late" : "absence"}`, highlighted: true },
  ].map((metric, index) => ({ ...metric, source: index === 0 || index === 3 ? "snapshot" : "reports" }));
  return <section aria-label="Class overview metrics" className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {metrics.map(metric => loading[metric.source] ? <InstructorMetricPlaceholder key={metric.label} /> : <article key={metric.label} className={`relative flex min-h-[110px] min-w-0 flex-col rounded-[4px] border px-4 py-3 ${metric.highlighted ? "border-[#A8C7FA] bg-[#E7F0FF]" : "border-[#D0D0D0] bg-[#F6F6F6]"}`}>
      <h2 className={`pr-3 text-[11px] font-medium uppercase leading-4 ${metric.color}`}>{metric.to && !errors[metric.source] ? <Link to={metric.to} className="after:absolute after:inset-0 after:z-10 after:rounded-[4px] focus-visible:outline-2 focus-visible:outline-blue-600">{metric.label}</Link> : metric.label}</h2>
      {metric.dot && <span aria-hidden="true" className={`absolute right-3 top-3 size-2 rounded-full ${metric.dot}`} />}
      <p className={`mt-2 break-words text-[28px] font-semibold leading-8 ${metric.color}`}>{errors[metric.source] ? "Unavailable" : metric.value}</p>
      <p className="mt-auto pt-1 text-xs leading-4 text-slate-600">{errors[metric.source] ? "Data could not be loaded." : metric.detail}</p>
    </article>)}
  </section>;
}

function SemesterSummary({ courses }) {
  return <section aria-labelledby="semester-summary-title" className="min-w-0 rounded-[4px] border border-[#D0D0D0] bg-white p-5">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 id="semester-summary-title" className="text-base font-semibold">Semester Summary Table</h2><p className="mt-1 text-xs text-slate-600">Cumulative reported requests for your courses.</p></div><p className="text-xs text-slate-500">{courses.length} {courses.length === 1 ? "class" : "classes"} with reports</p></div>
    <ClassRecordsTable columns={summaryColumns} caption="Semester reported requests by course and section" empty={!courses.length && "No reported requests for your classes yet."}>
      {courses.map(course => <tr key={course.id} className="hover:bg-slate-50">
        <td className="break-words px-3 py-3"><p>{course.subjectName}</p><p className="mt-0.5 text-xs text-slate-500">{course.section}</p>{course.term && <p className="mt-0.5 text-xs text-slate-500">{course.term}</p>}</td>
        <td className="break-words px-3 py-3 text-sm text-slate-700">{course.schedule}</td>
        <td className="px-3 py-3 tabular-nums">{course.absences}</td><td className="px-3 py-3 tabular-nums">{course.lates}</td>
        <td className="px-3 py-3"><Link to={`/instructor/class-records/${encodeURIComponent(course.id)}`} aria-label={`View records for ${course.subjectName}, ${course.section}`} className={`${linkStyle} inline-block`}>View Records</Link></td>
      </tr>)}
    </ClassRecordsTable>
  </section>;
}

function AttendanceNotice({ flags }) {
  return <section aria-labelledby="attendance-notice-title" className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[#D0D0D0] bg-white px-5 py-4">
    <div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-[4px] bg-blue-100 p-1 text-[#0969FF]"><Info aria-hidden="true" className="size-4" /></span><div className="min-w-0"><h2 id="attendance-notice-title" className="text-sm font-semibold">Attendance Notice</h2>
      {flags.length ? <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">{flags.map((flag, index) => <li key={`${flag.student?.id}-${flag.class}-${index}`} className="break-words">{flag.student?.name || "A student"} has {flag.absences ?? "recorded"} converted absences in {flag.class || "an assigned class"}. {flag.status === "IR" ? "Incident report" : "Attendance warning"}.</li>)}</ul> : <p className="mt-1 text-xs text-slate-600">No attendance warnings for your classes.</p>}
    </div></div>
    <Link to="/instructor/class-requests" className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-[4px] bg-[#D5E4FF] px-4 text-xs font-medium text-[#203B82] hover:bg-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View Requests</Link>
  </section>;
}

export default function InstructorOverview({ user, overview, onPreviousWeek, onNextWeek, loading = {}, errors = {}, onRetrySnapshot, onRetryReports }) {
  const name = user?.name?.trim() || "Instructor";
  const greeting = name === "Instructor" || /^prof\.?\s/i.test(name) ? name : `Prof. ${name}`;
  const pending = Boolean(loading.snapshot || loading.reports);
  return <div data-slot={pending ? "dashboard-skeleton" : undefined} data-variant="instructor" aria-busy={pending || undefined} className="grid min-w-0 gap-7">
    {pending && <span role="status" aria-label="Loading instructor data" className="sr-only">Loading instructor data</span>}
    {user ? <header><h1 className="break-words text-2xl font-bold leading-8 text-slate-950">Welcome, {greeting}!</h1><p className="mt-1 text-base font-medium text-slate-700">Here&apos;s your class overview</p></header> : <InstructorHeadingPlaceholder />}
    {errors.snapshot && <ResourceState error={errors.snapshot} onRetry={onRetrySnapshot} />}
    <Metrics overview={overview} loading={loading} errors={errors} />
    {loading.reports ? <><InstructorChartPlaceholder /><InstructorSummaryPlaceholder /></> : <ResourceState error={errors.reports} onRetry={onRetryReports}>
      <WeeklyReportsChart courses={overview.courses} week={overview.week} onPreviousWeek={onPreviousWeek} onNextWeek={onNextWeek} />
      <SemesterSummary courses={overview.courses} />
    </ResourceState>}
    {loading.snapshot ? <InstructorNoticePlaceholder /> : !errors.snapshot && <AttendanceNotice flags={overview.flags} />}
  </div>;
}
