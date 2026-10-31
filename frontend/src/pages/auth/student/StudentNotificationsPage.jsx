import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import StudentPageLayout from "./StudentPageLayout";
import useStudentPreferences from "./useStudentPreferences";
import useRequestNotifications from "./notifications/useRequestNotifications";
import NotificationsView from "./notifications/NotificationsView";
import NotificationPreferencesOff from "./notifications/NotificationPreferencesOff";

function NotificationsContent({ userId }) {
  const [filter, setFilter] = useState("all");
  const notifications = useRequestNotifications(userId);
  return <NotificationsView {...notifications} filter={filter} onFilterChange={setFilter} />;
}

export default function StudentNotificationsPage() {
  const { user } = useAuth();
  const { preferences } = useStudentPreferences(user?.id);
  return <StudentPageLayout contentPadding="px-5 sm:px-[50px]">
    {preferences.requestUpdates ? <NotificationsContent key={user?.id} userId={user?.id} /> : <section aria-labelledby="notifications-title">
      <h1 id="notifications-title" className="mb-6 text-2xl font-bold">Notifications</h1>
      <NotificationPreferencesOff />
    </section>}
  </StudentPageLayout>;
}
