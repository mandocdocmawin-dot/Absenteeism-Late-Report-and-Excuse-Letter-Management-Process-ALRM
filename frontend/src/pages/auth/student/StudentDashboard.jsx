import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import DashboardSkeleton from "@/components/loading/DashboardSkeleton";
import { RecentNotificationsPlaceholder } from "@/components/loading/DashboardSkeleton/StudentDashboardPlaceholder";
import StudentDashboardMetrics, { StudentDashboardResourceError } from "./StudentDashboardMetrics";
import StudentPageLayout from "./StudentPageLayout";
import StudentDashboardHeading from "./dashboard/StudentDashboardHeading";
import RecentNotifications from "./dashboard/RecentNotifications";
import useStudentPreferences from "./useStudentPreferences";
import useStudentDashboardResources from "./useStudentDashboardResources";

function StudentDashboardContent({ user }) {
  const { preferences } = useStudentPreferences(user.id);
  const resources = useStudentDashboardResources(user.id);
  const { requests, threshold, classes } = resources;
  const { hash } = useLocation();
  const loading = requests.loading || threshold.loading || classes.loading;

  useEffect(() => {
    if (!requests.loading && hash === "#recent-notifications") {
      document.getElementById("recent-notifications")?.focus();
    }
  }, [hash, requests.loading]);

  return <div data-slot={loading ? "dashboard-skeleton" : undefined} data-variant="student" className="min-w-0">
    {loading && <span role="status" aria-label="Loading student dashboard..." aria-busy="true" className="sr-only">Loading student dashboard...</span>}
    <StudentDashboardHeading user={user} classes={classes} />
    <StudentDashboardMetrics {...resources} alertsEnabled={preferences.thresholdAlerts} />
    {requests.loading ? <RecentNotificationsPlaceholder /> : requests.error ? <section id="recent-notifications" tabIndex={-1} className="mt-[34px] scroll-mt-6 outline-none sm:mx-1.5">
      <h2 className="mb-5 text-[18px] font-semibold leading-[22px]">Recent Notifications</h2>
      <StudentDashboardResourceError title="Request updates unavailable" error={requests.error} onRetry={requests.reload} />
    </section> : <RecentNotifications userId={user.id} requests={requests.data} />}
  </div>;
}

function StudentDashboard() {
  const { user } = useAuth();
  return <StudentPageLayout contentPadding="px-[50px]">
    <div className="@container grid w-full gap-0 font-[Arial,sans-serif] text-black dark:text-slate-100">
      {user ? <StudentDashboardContent key={user.id} user={user} /> : <DashboardSkeleton variant="student" label="Loading student dashboard..." />}
    </div>
  </StudentPageLayout>;
}

export default StudentDashboard;
