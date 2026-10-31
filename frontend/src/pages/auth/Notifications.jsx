import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeRole } from "@/lib/roles";
import { usePreviewRole } from "@/hooks/usePreviewRole";
import NotificationAccountNotice from "@/components/notifications/NotificationAccountNotice";
import useServerNotifications from "@/components/notifications/useServerNotifications";
import NotificationsView from "./student/notifications/NotificationsView";
import StudentNotificationsPage from "./student/StudentNotificationsPage";
import AdminPageLayout from "./admin/AdminPageLayout";
import InstructorPageLayout from "./instructor/InstructorPageLayout";
import ProgramHeadPageLayout from "./programHead/ProgramHeadPageLayout";

function NotificationList({ user }) {
  const [filter, setFilter] = useState("all");
  const notifications = useServerNotifications(user);
  return <NotificationsView {...notifications} filter={filter} onFilterChange={setFilter} unreadTitle="Unread in your account" />;
}

export default function Notifications() {
  const { user } = useAuth();
  const { activeRole } = usePreviewRole(user);
  const role = normalizeRole(activeRole);
  if (role === "student") return <StudentNotificationsPage />;
  const Layout = role === "instructor" ? InstructorPageLayout : role === "program" ? ProgramHeadPageLayout : AdminPageLayout;
  return <Layout title="Notifications">{normalizeRole(user.role) === role ? <NotificationList key={user.id} user={user} /> : <section className="grid gap-5"><h1 className="text-2xl font-bold">Notifications</h1><NotificationAccountNotice user={user} audience={role} /></section>}</Layout>;
}
