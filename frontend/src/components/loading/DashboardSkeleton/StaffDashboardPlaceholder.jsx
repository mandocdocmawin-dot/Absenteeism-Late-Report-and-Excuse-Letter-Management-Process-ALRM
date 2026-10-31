import { Skeleton } from "@/components/ui/skeleton";

export function SectionPlaceholder({ form = false, rows = 3 }) {
  return <div aria-hidden="true" className="grid min-w-0 gap-4 rounded-lg border border-slate-200 p-5">
    <Skeleton className="h-7 w-48 max-w-full" />
    {form && <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
    {Array.from({ length: rows }, (_, row) => <div key={row} className="grid grid-cols-4 gap-4 border-t border-slate-100 py-3">{Array.from({ length: 4 }, (_, column) => <Skeleton key={column} className="h-4 w-full" />)}</div>)}
  </div>;
}

export function ActivityChartPlaceholder() {
  return <div aria-hidden="true" data-slot="activity-chart-placeholder" className="rounded-md border border-slate-200 p-5">
    <Skeleton className="h-6 w-48 max-w-full" /><Skeleton className="mt-2 h-4 w-72 max-w-full" />
    <div className="mt-8 grid h-48 grid-cols-6 items-end gap-3 border-b border-slate-200">
      {[40, 65, 50, 80, 60, 90].map((height, index) => <div key={index} className="flex justify-center gap-1" style={{ height: `${height}%` }}><Skeleton className="h-full w-1/3 rounded-none" /><Skeleton className="h-3/4 w-1/3 self-end rounded-none" /></div>)}
    </div>
  </div>;
}

export function MetricPlaceholder() {
  return <div aria-hidden="true" data-slot="metric-placeholder" className="grid min-w-0 gap-2 rounded-lg border border-slate-200 p-5">
    <Skeleton className="h-5 w-28 max-w-full" /><Skeleton className="h-9 w-16" />
  </div>;
}

export function ProgramHeaderPlaceholder() {
  return <div aria-hidden="true" className="grid gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-80 max-w-full" /><Skeleton className="h-5 w-64 max-w-full" /></div>;
}

export default function StaffDashboardPlaceholder({ variant }) {
  const admin = variant === "admin";
  const program = variant === "program";
  if (admin) return <div className="grid min-w-0 gap-5">
    <ProgramHeaderPlaceholder />
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <MetricPlaceholder key={index} />)}</div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]"><ActivityChartPlaceholder /><div data-slot="approval-placeholder"><SectionPlaceholder rows={4} /></div></div>
    <div className="grid gap-3"><Skeleton className="h-6 w-32" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 w-full rounded-md" />)}</div></div>
  </div>;
  return <div className="grid min-w-0 gap-6">
    {program && <ProgramHeaderPlaceholder />}
    <div className={`grid min-w-0 gap-4 ${program ? "sm:grid-cols-3" : "md:grid-cols-3"}`}>
      {Array.from({ length: 3 }, (_, index) => <MetricPlaceholder key={index} />)}
    </div>
    {program && <ActivityChartPlaceholder />}
    <SectionPlaceholder rows={program ? 3 : 5} />
  </div>;
}
