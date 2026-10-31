import { SidebarInset } from "@/components/ui/sidebar";
import DashboardHeader from "./DashboardHeader";

const heights = {
  admin: { header: "h-[89px]", content: "min-h-[calc(100vh-89px)]" },
  standard: { header: "h-[70px]", content: "min-h-[calc(100vh-70px)]" },
};

function DashboardPageLayout({ children, name, role, user, title, variant = "standard" }) {
  const height = heights[variant];
  return <SidebarInset className="alrm-dashboard-scope min-h-screen min-w-0 bg-white text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <DashboardHeader height={height.header} name={name} role={role} user={user} title={title} />
      <main className={`${height.content} min-w-0 w-full bg-white px-5 py-7 transition-colors dark:bg-slate-950 sm:px-8 lg:px-10`}>
        {children}
      </main>
    </SidebarInset>;
}

export default DashboardPageLayout;
