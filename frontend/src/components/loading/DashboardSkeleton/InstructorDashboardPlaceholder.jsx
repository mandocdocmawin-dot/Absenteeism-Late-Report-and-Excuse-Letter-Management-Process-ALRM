import { Skeleton } from "@/components/ui/skeleton";

export function InstructorHeadingPlaceholder() {
  return <div aria-hidden="true" className="grid gap-1"><Skeleton className="h-8 w-80 max-w-full" /><Skeleton className="h-6 w-56 max-w-full" /></div>;
}

export function InstructorMetricPlaceholder() {
  return <div aria-hidden="true" data-slot="metric-placeholder" className="grid min-h-[110px] min-w-0 gap-2 rounded-[4px] border border-slate-200 px-4 py-3"><Skeleton className="h-4 w-32 max-w-full" /><Skeleton className="h-8 w-16" /><Skeleton className="h-4 w-full" /></div>;
}

export function InstructorChartPlaceholder() {
  return <div aria-hidden="true" data-slot="activity-chart-placeholder" className="min-w-0 rounded-[4px] border border-slate-200 p-5">
    <div className="flex flex-wrap justify-between gap-3"><div className="grid gap-1"><Skeleton className="h-6 w-40" /><Skeleton className="h-7 w-56 max-w-full" /></div><Skeleton className="h-4 w-32" /></div>
    <Skeleton className="mt-5 h-[260px] w-full" />
  </div>;
}

export function InstructorSummaryPlaceholder() {
  return <div aria-hidden="true" data-slot="semester-summary-placeholder" className="min-w-0 rounded-[4px] border border-slate-200 p-5">
    <Skeleton className="h-6 w-56 max-w-full" /><Skeleton className="mt-2 h-4 w-80 max-w-full" />
    <div className="mt-5 grid gap-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
  </div>;
}

export function InstructorNoticePlaceholder() {
  return <div aria-hidden="true" data-slot="attendance-notice-placeholder" className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-slate-200 px-5 py-4"><div className="grid min-w-0 flex-1 gap-2"><Skeleton className="h-5 w-40 max-w-full" /><Skeleton className="h-4 w-full" /></div><Skeleton className="h-9 w-28" /></div>;
}

export default function InstructorDashboardPlaceholder() {
  return <div className="grid min-w-0 gap-7">
    <InstructorHeadingPlaceholder />
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <InstructorMetricPlaceholder key={index} />)}
    </div>
    <InstructorChartPlaceholder />
    <InstructorSummaryPlaceholder />
    <InstructorNoticePlaceholder />
  </div>;
}
