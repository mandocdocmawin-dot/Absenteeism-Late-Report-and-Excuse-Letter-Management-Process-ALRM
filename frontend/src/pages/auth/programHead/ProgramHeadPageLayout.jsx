import { FileBarChart, RotateCcwClock, LayoutDashboard, Settings, UsersRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "react-router-dom";
import DashboardPageLayout from "@/components/navigation/DashboardPageLayout";
import RoleSidebar from "@/components/navigation/RoleSidebar";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Instructors", path: "/program-head/instructors", icon: UsersRound },
  { label: "Report", path: "/program-head/reports", icon: FileBarChart },
  { label: "Activity Log", path: "/program-head/activity-log", icon: RotateCcwClock },
  { label: "Settings", path: "/settings", icon: Settings },
];

function ProgramHeadPageLayout({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <RoleSidebar navigation={navigation} compact="program">
      <DashboardPageLayout name={user?.name || "Program Head"} role="Program Head" user={user} title={pathname === "/program-head/activity-log" ? "Activity Log" : undefined}>
        {children}
      </DashboardPageLayout>
    </RoleSidebar>
  );
}

export default ProgramHeadPageLayout;
