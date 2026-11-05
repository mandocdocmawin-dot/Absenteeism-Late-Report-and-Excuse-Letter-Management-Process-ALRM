import { ChevronRight, FileDown, Settings, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState } from "@/components/common/ErrorState";
import { ActivityChartPlaceholder, MetricPlaceholder, SectionPlaceholder } from "@/components/loading/DashboardSkeleton/StaffDashboardPlaceholder";
import { isGeneralEducationProgram, programShortName } from "@/lib/programs";
import { ROLE_LABELS, userDepartment } from "../userManagementData.js";
import { academicTermLabel, pendingAccounts } from "./adminOverviewData.js";
import AdminDepartmentChart from "./AdminDepartmentChart";

function ResourceError({ message, onRetry }) {
  return <div className="space-y-2"><ErrorState message={message} /><button type="button" onClick={onRetry} className="text-sm font-medium text-blue-800 underline">Retry loading</button></div>;
}

export default function AdminOverview({ resources, onRetry }) {
  const { dashboard, pendingUsers = [], loading, errors, ready } = resources;
  const waiting = key => loading[key] && !ready[key];
  const busy = Object.values(loading).some(Boolean);
  const pending = pendingAccounts(pendingUsers);
  const listedPrograms = dashboard?.programs_summary || [];
  const visiblePrograms = listedPrograms.filter(program => !isGeneralEducationProgram(program));
  const totalPrograms = dashboard?.programs_summary ? visiblePrograms.length : dashboard?.total_programs;
  const metrics = [["Total Students", dashboard?.total_students], ["Total Instructors", dashboard?.total_instructors], ["Total Programs", totalPrograms], ["Pending for Approval", dashboard?.pending_staff_approvals]];
  const quickAccess = [
    { label: "Manage users", detail: "View and manage user accounts", path: "/user-management", Icon: UsersRound },
    { label: "Export Report", detail: "Download absence and late reports", path: "/reports", Icon: FileDown },
    { label: "System Settings", detail: "Profile and notification preferences", path: "/settings", Icon: Settings },
  ];
  return <div className="grid min-w-0 gap-5" data-slot={busy ? "dashboard-skeleton" : undefined} data-variant="admin">
    {busy && <span role="status" aria-busy="true" className="sr-only">Loading administrator data</span>}
    <header><h1 className="text-2xl font-bold text-slate-950">Welcome back, Admin!</h1><p className="mt-1 text-sm text-slate-600">{academicTermLabel([])}</p></header>
    {errors.dashboard ? <ResourceError message={errors.dashboard} onRetry={onRetry} /> : <section aria-label="Administrator summary" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value], index) => waiting("dashboard") ? <MetricPlaceholder key={label} /> : <article key={label} className="min-w-0 rounded-md border border-[#D0D0D0] bg-[#F7F7F7] p-5">
        <p className={`text-sm font-medium ${index === 3 ? "text-[#F26B12]" : "text-slate-600"}`}>{label}</p>
        <p className={`mt-3 text-3xl font-semibold ${index === 3 ? "text-[#F26B12]" : "text-slate-900"}`}>{Number.isFinite(value) ? value : "Unavailable"}</p>
      </article>)}
    </section>}
    <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]">
      {waiting("dashboard") ? <ActivityChartPlaceholder /> : <AdminDepartmentChart programs={visiblePrograms} />}
      <section aria-labelledby="pending-accounts-title" className="min-w-0 rounded-md border border-[#D0D0D0] bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="pending-accounts-title" className="text-base font-semibold">Pending Account Approvals</h2><Link to="/user-management?tab=waiting" className="text-xs text-[#0969FF] underline underline-offset-2">View all</Link></div>
        {waiting("pendingUsers") ? <div data-slot="approval-placeholder"><SectionPlaceholder rows={4} /></div> : errors.pendingUsers ? <ResourceError message={errors.pendingUsers} onRetry={onRetry} /> : pending.length ? <ul className="divide-y divide-slate-300">
          {pending.slice(0, 4).map(user => <li key={user.id}><Link to={`/user-management?tab=waiting&user=${encodeURIComponent(user.id)}`} className="block rounded py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#203B82]">
            <p className="break-words text-sm font-semibold text-slate-800">{user.name || "Unnamed user"}</p>
            <p className="mt-0.5 break-words text-xs text-slate-500">{ROLE_LABELS[user.role] || "Role unassigned"} | {programShortName(userDepartment(user, visiblePrograms))}{user.role === "student" && user.year_level ? ` · ${String(user.year_level).replace(/\s*year$/i, "")} Yr` : ""}</p>
          </Link></li>)}
        </ul> : <p className="py-8 text-center text-sm text-slate-500">No accounts waiting for approval.</p>}
      </section>
    </div>
    <section aria-labelledby="quick-access-title" className="min-w-0"><h2 id="quick-access-title" className="mb-3 text-base font-semibold">Quick Access</h2><div className="grid min-w-0 gap-4 md:grid-cols-3">
      {quickAccess.map(({ label, detail, path, Icon }) => <Link key={path} to={path} className="flex min-w-0 items-center gap-3 rounded-md border border-[#8BA4D9] bg-white p-3 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-[#203B82]">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-[#203B82]" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-slate-500">{detail}</span></span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[#203B82]" />
      </Link>)}
    </div></section>
  </div>;
}
