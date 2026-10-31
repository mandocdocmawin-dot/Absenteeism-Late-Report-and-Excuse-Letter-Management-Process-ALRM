import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonRows({ rows, fields = false }) {
  if (fields) return <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
    {Array.from({ length: rows }, (_, index) => <div key={index} className="grid min-w-0 gap-2">
      <Skeleton className="h-3 w-24 max-w-full" /><Skeleton className="h-10 w-full" />
    </div>)}
  </div>;
  return <div className="grid min-w-0 grid-cols-1 divide-y divide-slate-100">
    {Array.from({ length: rows }, (_, index) => <div key={index} data-slot="skeleton-row" className="min-w-0 py-4">
      <Skeleton className="h-4 w-full" />
    </div>)}
  </div>;
}

export default function LoadingSkeleton({ variant = "page", label = "Loading page...", rows = 5, columns = 4, className, children }) {
  const field = variant === "field";
  const form = variant === "form" || variant === "profile";
  const heading = ["page", "dashboard", "profile"].includes(variant);
  return <div role="status" aria-label={label} aria-busy="true" className={cn("w-full min-w-0", className)}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className={field ? "min-w-0" : "grid min-w-0 grid-cols-1 gap-6"}>
      {children}
      {heading && <div className="grid min-w-0 grid-cols-1 gap-3">
        {variant === "profile" && <Skeleton className="size-16 rounded-full" />}
        <Skeleton className="h-7 w-60 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" />
      </div>}
      {variant === "dashboard" && <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(var(--skeleton-columns),minmax(0,1fr))]" style={{ "--skeleton-columns": Math.min(columns, 4) }}>
        {Array.from({ length: columns }, (_, index) => <div key={index} className="grid min-h-36 content-between gap-5 rounded-md border border-slate-200 p-5">
          <Skeleton className="h-4 w-28 max-w-full" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-full" />
        </div>)}
      </div>}
      {field ? <Skeleton className="h-10 w-full" /> : <SkeletonRows rows={rows} fields={form} />}
    </div>
  </div>;
}
