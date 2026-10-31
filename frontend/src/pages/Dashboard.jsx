import { lazy } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePreviewRole } from "@/hooks/usePreviewRole";
import { normalizeRole } from "@/lib/roles";
const HttpErrorPage = lazy(() => import("./HttpErrorPage"));
const AdminDashboard = lazy(() => import("./auth/admin/AdminDashboard").then(module => ({ default: module.AdminDashboard })));
const AdminPageLayout = lazy(() => import("./auth/admin/AdminPageLayout"));
const InstructorDashboard = lazy(() => import("./auth/instructor/InstructorDashboard").then(module => ({ default: module.InstructorDashboard })));
const InstructorPageLayout = lazy(() => import("./auth/instructor/InstructorPageLayout"));
const ProgramHeadDashboard = lazy(() => import("./auth/programHead/ProgramHeadDashboard").then(module => ({ default: module.ProgramHeadDashboard })));
const ProgramHeadPageLayout = lazy(() => import("./auth/programHead/ProgramHeadPageLayout"));
const StudentDashboard = lazy(() => import("./auth/student/StudentDashboard"));

export function Dashboard() {
  const { user } = useAuth();
  const { activeRole } = usePreviewRole(user);
  const role = normalizeRole(activeRole);

  let content;
  if (role === "student") content = <StudentDashboard />;
  if (role === "instructor") {
    content = <InstructorPageLayout title="Dashboard"><InstructorDashboard /></InstructorPageLayout>;
  }
  if (role === "program") {
    content = <ProgramHeadPageLayout><ProgramHeadDashboard /></ProgramHeadPageLayout>;
  }
  if (role === "admin") {
    content = <AdminPageLayout><AdminDashboard /></AdminPageLayout>;
  }
  return content || <HttpErrorPage status={403} />;
}
