import { UserCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import StudentSidebar from "./StudentSidebar";
import StudentNotifications from "./notifications/StudentNotifications";

function StudentPageLayout({ children, contentPadding = "px-5 sm:px-8 lg:px-10" }) {
  const { user } = useAuth();

  return (
    <StudentSidebar>
      <SidebarInset className="alrm-dashboard-scope min-h-screen bg-white text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <header className="flex h-[70px] items-center justify-between border-b border-slate-100 bg-white px-5 transition-colors dark:border-slate-800 dark:bg-slate-950 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
          </div>

          <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100">
            <StudentNotifications key={user?.id} userId={user?.id} />
            <Link to="/settings" aria-label="Open profile settings" className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-blue-500">
              <UserCircle className="size-7 text-slate-400 dark:text-slate-500" strokeWidth={1.75} />
              <div className="hidden max-w-44 leading-tight sm:block">
                <p title={user?.name} className="truncate text-sm font-bold">{user?.name || "Student"}</p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Student
                </p>
              </div>
            </Link>
          </div>
        </header>

        <main className={`min-h-[calc(100vh-70px)] w-full bg-white py-7 transition-colors dark:bg-slate-950 ${contentPadding}`}>
          {children}
        </main>
      </SidebarInset>
    </StudentSidebar>
  );
}

export default StudentPageLayout;
