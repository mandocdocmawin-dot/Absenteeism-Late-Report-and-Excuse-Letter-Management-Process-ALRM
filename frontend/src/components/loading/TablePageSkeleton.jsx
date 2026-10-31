import { Skeleton } from "@/components/ui/skeleton";
import LoadingSkeleton from "./LoadingSkeleton";

export default function TablePageSkeleton({ layout = "requests", label = "Loading records...", rows = layout === "student-records" ? 10 : 8 }) {
  const student = layout === "student-records";
  const course = layout === "courses" || layout === "course-detail";
  return <div data-slot="table-page-skeleton" data-layout={layout} className="grid min-w-0 gap-5">
    <LoadingSkeleton variant="table" rows={rows} label={label}>
      <div className="grid min-w-0 gap-5">
        {layout === "course-detail" && <Skeleton className="h-4 w-64 max-w-full" />}
        {!student && <div data-slot="skeleton-heading" className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-72 max-w-full" />
          {course && <Skeleton className="h-9 w-48 max-w-full" />}
        </div>}
        {course && <Skeleton className="h-4 w-96 max-w-full" />}
        {layout !== "courses" && <div data-slot="skeleton-tabs" className="flex gap-1 border-b border-slate-200">
          {[0, 1].map(index => <div key={index} className="flex min-h-10 min-w-24 items-center justify-center px-5 py-2"><Skeleton className="h-5 w-14" /></div>)}
        </div>}
        {!course && <div data-slot="skeleton-toolbar" className="flex flex-wrap items-center gap-3">
          {student ? <><Skeleton className="h-10 w-[220px] max-w-full" /><Skeleton className="h-10 w-[190px] max-w-full" /></> : <>
            <Skeleton className="h-9 min-w-40 flex-1 sm:max-w-72" /><Skeleton className="h-9 w-52 max-w-full" />
            <Skeleton className="h-9 w-40 max-w-full" /><Skeleton className="h-9 w-24 max-w-full" />
          </>}
        </div>}
        {layout === "requests" && <Skeleton className="h-5 w-1/2 max-w-full" />}
        <div data-slot="skeleton-table-header" className="border-b border-slate-200 py-3"><Skeleton className="h-4 w-full" /></div>
      </div>
    </LoadingSkeleton>
    <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-4 w-28" />
      <div className="flex gap-1.5">{[0, 1, 2].map(index => <Skeleton key={index} className="size-9" />)}</div>
    </div>
  </div>;
}
