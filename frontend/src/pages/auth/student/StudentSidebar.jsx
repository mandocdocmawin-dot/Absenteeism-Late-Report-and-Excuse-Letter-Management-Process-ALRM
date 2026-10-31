import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import LogoutConfirmation from "@/components/navigation/RoleSidebar/LogoutConfirmation";
import SidebarBrand from "@/components/navigation/RoleSidebar/SidebarBrand";
import { logoutToSignedOut } from "@/lib/logout";
import {
  Sidebar as AppSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Records",
    path: "/student/records",
    icon: ClipboardList,
  },
  {
    label: "My Request",
    path: "/student/request",
    icon: FileText,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function StudentSidebar({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { logout } = useAuth();

  function handleLogout() {
    return logoutToSignedOut(logout, navigate);
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "280px",
        "--sidebar-width-icon": "72px",
      }}
    >
      <AppSidebar
        collapsible="icon"
        className="border-0 bg-[#0d1526] text-white"
      >
        <SidebarHeader className="bg-[#0d1526] p-0">
          <SidebarBrand />
        </SidebarHeader>

        <SidebarContent className="bg-[#0d1526] px-3 py-8 group-data-[collapsible=icon]:px-3">
          <SidebarMenu className="gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = Boolean(matchPath({ path: item.path, end: item.path === "/dashboard" }, pathname));

              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    render={<NavLink to={item.path} aria-label={item.label} end={item.path === "/dashboard"} />}
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      "h-9 gap-3 rounded-[6px] px-4 text-[15px] font-bold text-slate-100 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                      isActive &&
                        "bg-[#203b82] text-white hover:bg-[#203b82]",
                    )}
                  >
                    <Icon
                      className="size-5 shrink-0"
                      strokeWidth={2.25}
                    />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.label}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="bg-[#0d1526] px-3 pb-5 pt-3 group-data-[collapsible=icon]:px-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <AlertDialog>
                <AlertDialogTrigger aria-label="Logout"
                  render={
                    <SidebarMenuButton
                      type="button"
                      tooltip="Logout"
                      className="h-9 gap-3 rounded-[6px] px-4 text-[15px] font-bold text-slate-100 hover:bg-red-500/15 hover:text-white group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                    />
                  }
                >
                  <LogOut className="size-5 shrink-0" strokeWidth={2.25} />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Logout
                  </span>
                </AlertDialogTrigger>

                <LogoutConfirmation onLogout={handleLogout} />
              </AlertDialog>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </AppSidebar>

      {children}
    </SidebarProvider>
  );
}

export default StudentSidebar;
