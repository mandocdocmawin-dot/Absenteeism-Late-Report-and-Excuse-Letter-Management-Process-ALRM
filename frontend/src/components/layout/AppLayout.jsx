import {
  BarChart3,
  ClipboardCheck,
  FilePlus2,
  Files,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/useAuth";

const roleLabels = {
  student: "Student Portal",
  instructor: "Instructor Dashboard",
  program_head: "Program Head Dashboard",
  administrator: "Administrator Dashboard",
};

const roleIcons = {
  student: GraduationCap,
  instructor: ClipboardCheck,
  program_head: Users,
  administrator: ShieldCheck,
};

const navItems = {
  student: [
    { label: "Dashboard", path: "/student", icon: Home },
    { label: "New Request", path: "/student/requests/new", icon: FilePlus2 },
    { label: "Request History", path: "/student/requests", icon: Files },
  ],
  instructor: [
    { label: "Dashboard", path: "/instructor", icon: Home },
    { label: "Requests", path: "/instructor/requests", icon: ClipboardCheck },
  ],
  program_head: [
    { label: "Dashboard", path: "/program-head", icon: Home },
    { label: "Flagged Students", path: "/program-head/students/flagged", icon: Users },
    { label: "Program Requests", path: "/program-head/requests", icon: Files },
  ],
  administrator: [
    { label: "Dashboard", path: "/admin", icon: Home },
    { label: "Staff Roles", path: "/admin/users", icon: ShieldCheck },
    { label: "Programs", path: "/admin/programs", icon: GraduationCap },
    { label: "Classes", path: "/admin/classes", icon: Settings },
    { label: "Reports", path: "/admin/reports", icon: BarChart3 },
  ],
};

export function AppLayout({ children, title, subtitle, activePath, navigate }) {
  const { user, logout } = useAuth();
  const RoleIcon = roleIcons[user.role] || Home;
  const items = navItems[user.role] || [];

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-[#0B1428] p-4 text-white lg:block">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-white text-sm font-bold text-[#0B1428]">
            AL
          </div>
          <div>
            <p className="text-sm font-bold">ALRM System</p>
            <p className="text-xs text-slate-300">La Verdad Christian College</p>
          </div>
        </div>

        <nav className="mt-8 space-y-2" aria-label="Primary">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = activePath === item.path;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-white text-[#0B1428]"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <ItemIcon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
              <RoleIcon className="hidden size-6 text-[#0B1428] sm:block" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-500">
                  {roleLabels[user.role]}
                </p>
                <h1 className="truncate text-xl font-bold text-slate-950">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden="true" />
                Logout
              </Button>
            </div>
          </div>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
          <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden" aria-label="Mobile primary">
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-sm ${
                  activePath === item.path
                    ? "border-[#0B1428] bg-[#0B1428] text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
