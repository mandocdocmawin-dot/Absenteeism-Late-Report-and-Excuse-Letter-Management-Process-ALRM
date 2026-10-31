import { UserCircle } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";

function DashboardHeader({ height, name, role, user, title }) {
  return <header className={`flex ${height} min-w-0 items-center justify-between border-b border-slate-100 bg-white px-5 transition-colors dark:border-slate-800 dark:bg-slate-950 sm:px-8 lg:px-10`}>
    <div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="md:hidden" />{title && <p className="truncate text-lg font-semibold">{title}</p>}</div>
    <div className="flex min-w-0 items-center gap-3 text-slate-950 dark:text-slate-100">
      <NotificationBell user={user} audience={role} />
      <div className="flex min-w-0 items-center gap-2">
        <UserCircle className="size-7 shrink-0 text-slate-400 dark:text-slate-500" strokeWidth={1.75} />
        <div className="hidden min-w-0 max-w-48 leading-tight sm:block">
          <p className="truncate text-sm font-bold" title={name}>{name}</p>
          <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{role}</p>
        </div>
      </div>
    </div>
  </header>;
}

export default DashboardHeader;
