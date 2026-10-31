import { CalendarDays, ClipboardList, GraduationCap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import { ErrorState } from "./ErrorState";
import ResourceRefresh from "./ResourceRefresh";
import FilterMenu, { RadioFilterGroup } from "./FilterMenu";
import { filterActivity } from "@/pages/auth/admin/overviewData";
import { paginateRecords } from "@/pages/auth/student/records/pagination";
import RequestPagination from "@/pages/auth/instructor/InstructorRequests/RequestPagination";
import { usePageViewState } from "@/hooks/usePageViewState";

const emptyFilters = { search: "", action: "", subject: "", date: "" };
const actions = { Submitted: "border-orange-200 bg-orange-50 text-orange-700", Updated: "border-blue-200 bg-blue-50 text-blue-800", Cancelled: "border-slate-300 bg-slate-50 text-slate-700", "Followed up": "border-orange-200 bg-orange-50 text-orange-700", Flagged: "border-yellow-300 bg-yellow-50 text-yellow-900", Approved: "border-green-200 bg-green-50 text-green-700", Denied: "border-red-200 bg-red-50 text-red-700", Noted: "border-blue-200 bg-blue-50 text-blue-800", Resolved: "border-green-200 bg-green-50 text-green-700" };

export default function ActivityTable({ rows = [], loading, error, onRetry, updatedAt, viewKey = "activity", flagged = false, programLog = false }) {
  const [view, setView] = usePageViewState(viewKey, { filters: emptyFilters, page: 1 });
  const { filters, page } = view;
  const visible = filterActivity(rows, filters);
  const pagination = paginateRecords(visible, page);
  const subjects = [...new Map(rows.filter(row => row.classId).map(row => [row.classId, row.subject])).entries()];
  const chips = [
    filters.action && { name: "action", label: `Action: ${filters.action}`, Icon: ClipboardList },
    filters.subject && { name: "subject", label: `Subject: ${subjects.find(([id]) => id === filters.subject)?.[1] || "Selected subject"}`, Icon: GraduationCap },
    filters.date && { name: "date", label: `Date: ${filters.date}`, Icon: CalendarDays },
  ].filter(Boolean);
  function setPage(nextPage) { setView(current => ({ ...current, page: nextPage })); }
  function change(key, value) { setView(current => ({ filters: { ...current.filters, [key]: value }, page: 1 })); }
  if (loading) return <LoadingSkeleton variant="table" columns={5} rows={6} label="Loading activity">{!programLog && <div className="space-y-3"><div className="flex flex-wrap items-center gap-4"><Skeleton className="h-10 w-full max-w-[400px]" /><Skeleton className="h-6 w-24" /></div><Skeleton className="h-8 w-24" /></div>}</LoadingSkeleton>;
  if (error) return <div className="space-y-3"><ErrorState message={error} /><Button variant="outline" onClick={onRetry}>Retry</Button></div>;
  return <div className="space-y-5">
    {!programLog && <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[400px]">
          <Input aria-label="Search activity" placeholder="Search Name, ID, Email..." value={filters.search} onChange={event => change("search", event.target.value)} className="h-10 rounded-lg border-[#c5d0e5] pr-10 text-sm shadow-sm" />
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8aa0bf]" />
        </div>
        <Button variant="ghost" onClick={() => setView({ filters: emptyFilters, page: 1 })}>Clear filters</Button>
        <ResourceRefresh updatedAt={updatedAt} loading={loading} onRefresh={onRetry} />
      </div>
      <FilterMenu label="Filter activity" chips={chips} onChange={change}>
        <div className="grid gap-3 divide-y divide-slate-100 [&>fieldset:not(:first-child)]:pt-3">
          <RadioFilterGroup name="action" label="Action" value={filters.action} onChange={change} options={[{ value: "", label: "All actions" }, ...Object.keys(actions).filter(action => rows.some(row => row.action === action)).map(action => ({ value: action, label: action }))]} />
          <RadioFilterGroup name="subject" label="Subject" value={filters.subject} onChange={change} options={[{ value: "", label: "All subjects" }, ...subjects.map(([id, name]) => ({ value: id, label: name }))]} />
          <label className="grid gap-1.5 pt-3 text-sm font-semibold text-slate-900">Date<Input className="h-10 font-normal" type="date" value={filters.date} onChange={event => change("date", event.target.value)} /></label>
        </div>
      </FilterMenu>
    </div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed text-left text-sm"><caption className="sr-only">{flagged ? "Flagged request activity" : "Request activity"}</caption><thead><tr className="border-b border-[#bccae5] text-[#203B82]">{(flagged ? ["Students", "Date", "Class", "Record", "Flagged by"] : programLog ? ["Students", "Date", "Requests", "Action", "Instructor"] : ["Date", "Student", "Request", "Action", "Instructor"]).map(label => <th key={label} scope="col" className="w-1/5 px-4 py-4 font-semibold">{label}</th>)}</tr></thead><tbody>
      {pagination.pageRecords.map(row => <tr key={row.id} className="border-b border-[#cbd6ed]">
        {(flagged ? [row.student, new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), row.subject, row.type, row.flaggedBy] : programLog ? [row.student, new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), row.type, row.action, row.instructor] : [new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), row.student, row.type, row.action, row.instructor]).map((value, index) => <td key={index} className="break-words px-4 py-5">{!flagged && index === 3 ? <span className={`inline-flex min-w-24 justify-center rounded-md border px-2 py-1 text-xs font-medium ${actions[row.action] || "border-slate-200 bg-slate-50"}`}>{value}</span> : value || "Unavailable"}</td>)}
      </tr>)}
      {!visible.length && <tr><td colSpan={5} className="py-14 text-center text-slate-500">No activity matches these filters.</td></tr>}
    </tbody></table></div>
    <RequestPagination pagination={pagination} total={visible.length} onPage={setPage} />
  </div>;
}
