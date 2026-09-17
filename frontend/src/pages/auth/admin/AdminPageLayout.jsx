import { Bell, ChevronDown, UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import Sidebar from "./Sidebar";

function AdminPageLayout({ children }) {
  const { user } = useAuth();

  return (
    <Sidebar>
      <SidebarInset className="min-h-screen bg-white text-slate-950">
        <header className="flex h-[89px] items-center justify-between border-b border-slate-100 px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
          </div>

          <div className="flex items-center gap-4 text-slate-950">
            <button
              type="button"
              aria-label="Notifications"
              className="rounded-full p-2 text-slate-900 hover:bg-slate-100"
            >
              <Bell className="size-5" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-2">
              <UserCircle className="size-7 text-slate-400" strokeWidth={1.75} />
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-bold">{user?.name || "Admin"}</p>
                <p className="text-[11px] font-medium text-slate-500">
                  {user?.role || "Administrator"}
                </p>
              </div>
              <ChevronDown className="size-4" />
            </div>
          </div>
        </header>

        <main className="w-full px-5 py-7 sm:px-8 lg:px-10">{children}</main>
      </SidebarInset>
    </Sidebar>
  );
}

export default AdminPageLayout;
