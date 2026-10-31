import { useNavigate } from "react-router-dom";
import {
  Sidebar as AppSidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuItem, SidebarProvider,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { logoutToSignedOut } from "@/lib/logout";
import SidebarBrand from "./SidebarBrand";
import SidebarLogout from "./SidebarLogout";
import SidebarNavigation from "./SidebarNavigation";

function RoleSidebar({ children, navigation, wide = false, compact = "student" }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    return logoutToSignedOut(logout, navigate);
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "280px", "--sidebar-width-icon": wide ? "80px" : "72px" }}>
      <AppSidebar collapsible="icon" className="border-0 bg-[#0d1526] text-white">
        <SidebarHeader className="bg-[#0d1526] p-0"><SidebarBrand wide={wide} /></SidebarHeader>
        <SidebarContent className={`bg-[#0d1526] ${wide ? "px-4 py-12 group-data-[collapsible=icon]:px-4" : compact === "instructor" ? "px-3 py-7 group-data-[collapsible=icon]:px-3" : "px-3 py-8 group-data-[collapsible=icon]:px-3"}`}>
          <SidebarNavigation items={navigation} wide={wide} compact={compact} />
        </SidebarContent>
        <SidebarFooter className={`bg-[#0d1526] pt-3 ${wide ? "px-4 pb-6 group-data-[collapsible=icon]:px-4" : "px-3 pb-5 group-data-[collapsible=icon]:px-3"}`}>
          <SidebarMenu><SidebarMenuItem><SidebarLogout onLogout={handleLogout} wide={wide} /></SidebarMenuItem></SidebarMenu>
        </SidebarFooter>
      </AppSidebar>
      {children}
    </SidebarProvider>
  );
}

export default RoleSidebar;
