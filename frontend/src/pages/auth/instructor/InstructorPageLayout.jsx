import { Bell, ChevronDown, UserCircle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import InstructorSidebar from "./InstructorSidebar";

function InstructorPageLayout({ children }) {
  const { user } = useAuth();

  return (
    <InstructorSidebar>
      <SidebarInset className="alrm-dashboard-scope min-h-screen bg-white text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <header className="flex h-[70px] items-center justify-between border-b border-slate-100 bg-white px-5 transition-colors dark:border-slate-800 dark:bg-slate-950 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
          </div>

          <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Notifications"
              className="rounded-full p-2 text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Bell className="size-5" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-2">
              <UserCircle className="size-7 text-slate-400 dark:text-slate-500" strokeWidth={1.75} />
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-bold">{user?.name || "Instructor"}</p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Instructor
                </p>
              </div>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-70px)] w-full bg-white px-5 py-7 transition-colors dark:bg-slate-950 sm:px-8 lg:px-10">
          {children}
        </main>
      </SidebarInset>
    </InstructorSidebar>
  );
}

export default InstructorPageLayout;
