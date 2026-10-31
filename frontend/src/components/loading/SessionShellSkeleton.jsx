import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/assets/lv-logo-sidebar.webp";

export default function SessionShellSkeleton() {
  return <div role="status" aria-label="Loading ALRM System" aria-busy="true" className="flex min-h-screen bg-white text-slate-900">
    <aside className="hidden w-64 shrink-0 bg-[#0d1526] p-5 md:block">
      <div className="flex items-center gap-3 text-white"><img src={logo} width="48" height="48" alt="" className="size-12" /><span className="font-semibold">ALRM SYSTEM</span></div>
      <div className="mt-10 grid gap-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 bg-white/10" />)}</div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex h-[70px] items-center justify-between border-b border-slate-100 px-6"><Skeleton className="h-6 w-32" /><Skeleton className="size-9 rounded-full" /></header>
      <main className="grid gap-5 p-6"><Skeleton className="h-8 w-56" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div><Skeleton className="h-72 w-full" /></main>
    </div>
  </div>;
}
