import { NavLink, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sidebar as AppSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import lvLogo from "@/assets/LV_Logo.png";

const menuItems = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Students",
    path: "/students",
    icon: UsersRound,
  },
  {
    label: "Instructors",
    path: "/instructors",
    icon: Users,
  },
  {
    label: "Programs",
    path: "/programs",
    icon: GraduationCap,
  },
  {
    label: "User Management",
    path: "/user-management",
    icon: UserCog,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function SidebarBrand() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      onClick={toggleSidebar}
      className="flex h-[89px] w-full items-center justify-start gap-3 rounded-none px-5 text-white hover:bg-white/5 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
    >
      <img
        src={lvLogo}
        alt="ALRM System logo"
        className="size-11 shrink-0 object-contain"
      />
      <span className="whitespace-nowrap text-2xl font-black tracking-normal group-data-[collapsible=icon]:hidden">
        ALRM SYSTEM
      </span>
    </button>
  );
}

function Sidebar({ children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "264px",
        "--sidebar-width-icon": "80px",
      }}
    >
      <AppSidebar
        collapsible="icon"
        className="border-0 bg-[#0d1526] text-white"
      >
        <SidebarHeader className="bg-[#0d1526] p-0">
          <SidebarBrand />
        </SidebarHeader>

        <SidebarContent className="bg-[#0d1526] px-4 py-12 group-data-[collapsible=icon]:px-4">
          <SidebarMenu className="gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <SidebarMenuItem key={item.path}>
                  <NavLink to={item.path} end={item.path === "/"}>
                    {({ isActive }) => (
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.label}
                        className={cn(
                          "h-11 gap-4 rounded-[7px] px-5 text-[18px] font-semibold text-slate-100 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                          isActive &&
                            "bg-[#203b82] text-white hover:bg-[#203b82]",
                        )}
                      >
                        <Icon
                          className="size-[30px] shrink-0"
                          strokeWidth={2.25}
                        />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="bg-[#0d1526] px-4 pb-6 pt-3 group-data-[collapsible=icon]:px-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <SidebarMenuButton
                      type="button"
                      tooltip="Logout"
                      className="h-11 gap-4 rounded-[7px] px-5 text-[18px] font-semibold text-slate-100 hover:bg-red-500/15 hover:text-white group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                    />
                  }
                >
                  <LogOut
                    className="size-[30px] shrink-0"
                    strokeWidth={2.25}
                  />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Logout
                  </span>
                </AlertDialogTrigger>

                <AlertDialogContent className="rounded-[8px]">
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-red-50 text-red-600">
                      <LogOut className="size-5" strokeWidth={2.25} />
                    </AlertDialogMedia>
                    <AlertDialogTitle className="font-black text-slate-950">
                      Logout of ALRM?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      You will need to sign in again with your LV email account
                      before accessing the dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-9 rounded-[5px] border-slate-300 font-bold text-slate-700">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLogout}
                      className="h-9 rounded-[5px] bg-red-600 font-bold text-white hover:bg-red-700"
                    >
                      Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </AppSidebar>
      {children}
    </SidebarProvider>
  );
}

export default Sidebar;
