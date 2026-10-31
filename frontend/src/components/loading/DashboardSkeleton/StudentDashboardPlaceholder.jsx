import { Skeleton } from "@/components/ui/skeleton";

const metricClass = "flex min-h-[225px] min-w-0 flex-col overflow-hidden rounded-[7px] border border-[#c9c6c6]";

export function RecordedMetricPlaceholder() {
  return <div aria-hidden="true" data-slot="metric-placeholder" className={metricClass}>
    <div className="flex flex-1 justify-between gap-2 px-[9px] pt-[17px] pb-4">
      <div className="min-w-0"><Skeleton className="h-9 w-24 max-w-full" /><Skeleton className="mt-[25px] h-[34px] w-10" /></div>
      <Skeleton className="mt-[7px] size-5 shrink-0 rounded-full" />
    </div>
    <div className="grid min-h-[70px] content-center gap-2 bg-[#f6f6f6] px-[9px] py-3"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div>
  </div>;
}

export function ThresholdPlaceholder() {
  return <div aria-hidden="true" data-slot="metric-placeholder" className={metricClass}>
    <div data-slot="threshold-placeholder" className="flex flex-1 flex-col">
      <div className="flex justify-between gap-3 px-[17px] pt-[9px]"><Skeleton className="h-5 w-48 max-w-full" /><Skeleton className="h-4 w-20 shrink-0" /></div>
      <div className="flex flex-1 items-center gap-4 px-3 py-[17px]">
        <div className="flex size-[106px] shrink-0 items-center justify-center rounded-full border-[9px] border-slate-200"><Skeleton className="h-5 w-10" /></div>
        <div className="grid min-w-0 flex-1 gap-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-3 w-3/4" /></div>
      </div>
    </div>
    <div className="flex min-h-[54px] items-center bg-[#f6f6f6] px-[9px] py-3"><Skeleton className="h-4 w-40 max-w-full" /></div>
  </div>;
}

export function StudentClassDetailsPlaceholder({ className = "inline-block h-4 w-48 max-w-full align-middle" }) {
  return <Skeleton aria-hidden="true" data-slot="class-details-placeholder" className={className} />;
}

export function StudentDashboardHeadingPlaceholder() {
  return <div aria-hidden="true" className="grid items-start gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Skeleton className="order-1 h-[34px] w-80 max-w-full" /><Skeleton className="order-3 mt-3 h-[35px] w-44 sm:order-2 sm:mt-0" /><Skeleton className="order-2 col-span-full h-6 w-full max-w-[650px] sm:order-3" />
    </div>;
}

export function RecentNotificationsPlaceholder() {
  return <div aria-hidden="true" className="mt-[34px] sm:mx-1.5">
      <Skeleton className="mb-5 h-[22px] w-52 max-w-full" />
      <div className="grid gap-[9px] sm:mx-2">{Array.from({ length: 3 }, (_, index) => <div data-slot="notification-placeholder" key={index} className="flex min-h-[52px] items-center gap-2 rounded-[7px] bg-[#f6f6f6] px-[9px] py-2">
        <Skeleton className="size-5 shrink-0 rounded-full" /><div className="grid min-w-0 flex-1 gap-1"><Skeleton className="h-4 w-full max-w-2xl" /><Skeleton className="h-4 w-48 max-w-full" /></div>
      </div>)}</div>
    </div>;
}

export default function StudentDashboardPlaceholder() {
  return <>
    <StudentDashboardHeadingPlaceholder />
    <div className="mt-8 grid gap-5 @[640px]:grid-cols-[minmax(0,1fr)_minmax(0,2.19fr)_minmax(0,1fr)] @[800px]:gap-[26px]">
      <RecordedMetricPlaceholder /><ThresholdPlaceholder /><RecordedMetricPlaceholder />
    </div>
    <RecentNotificationsPlaceholder />
  </>;
}
