import { NavLink } from "react-router-dom";
import {
  GraduationCap,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Sidebar as AppSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
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
      </AppSidebar>
      {children}
    </SidebarProvider>
  );
}

export default Sidebar;
