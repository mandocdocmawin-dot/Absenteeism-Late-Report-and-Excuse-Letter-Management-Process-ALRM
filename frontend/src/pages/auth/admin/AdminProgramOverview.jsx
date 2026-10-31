import { Link } from "react-router-dom";
import { getAdminDashboard } from "@/api/admin";
import { getCollection } from "@/api/collections";
import { useApiResource } from "@/hooks/useApiResource";
import MetricCard from "@/components/dashboard/MetricCard";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { programShortName } from "@/lib/programs";
import { programOverviewRows } from "./overviewData";

const loadClasses = () => getCollection("/admin/classes");
export default function AdminProgramOverview() {
  const dashboard = useApiResource(getAdminDashboard);
  const classes = useApiResource(loadClasses);
  const rows = programOverviewRows(dashboard.data, classes.data || []);
  const counts = dashboard.data;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Program Overview</h1><p className="mt-1 text-sm text-slate-500">Summary of academic programs and student attendance compliance.</p></div><Button className="h-11 bg-[#172f6b] px-6 py-3 text-white hover:bg-[#203f8a]" nativeButton={false} render={<Link to="/programs" />}>Manage programs</Button></header>
    {dashboard.loading ? <LoadingSkeleton variant="dashboard" label="Loading program overview" /> : dashboard.error ? <div className="space-y-3"><ErrorState message={dashboard.error} /><Button variant="outline" onClick={dashboard.reload}>Retry</Button></div> : <>
      <section aria-label="Program summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Programs" value={rows.length} />
        <MetricCard label="Total Students" value={counts?.total_students} />
        <MetricCard label="Attendance Flags" value={Number.isFinite(counts?.warning_count) && Number.isFinite(counts?.ir_count) ? counts.warning_count + counts.ir_count : null} note="Warnings and IR cases by class" />
        <MetricCard label="Pending Requests" value={counts?.pending_requests} />
      </section>
      <section className="space-y-4"><h2 className="text-lg font-semibold">All Academic Programs</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] table-fixed text-left text-sm"><thead><tr className="border-b border-[#bccae5] text-[#203B82]">{["Department", "Students", "Classes", "Instructors"].map(label => <th key={label} scope="col" className="w-1/4 px-4 py-4 font-semibold">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#cbd6ed]"><td title={row.name} className="break-words px-4 py-5">{programShortName(row.name)}</td><td className="px-4 py-5">{row.students ?? "Unavailable"}</td><td className="px-4 py-5">{row.classes}</td><td className="px-4 py-5">{classes.loading ? <span className="inline-block h-4 w-10 animate-pulse rounded bg-slate-100" aria-label="Loading instructor count" /> : classes.error ? "Unavailable" : row.instructors}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="py-14 text-center text-slate-500">No academic programs found.</td></tr>}</tbody></table></div>
        {classes.error && <Button variant="outline" onClick={classes.reload}>Retry instructor counts</Button>}
      </section>
    </>}
  </div>;
}
