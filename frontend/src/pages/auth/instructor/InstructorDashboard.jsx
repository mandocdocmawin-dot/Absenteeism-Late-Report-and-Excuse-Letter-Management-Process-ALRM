import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import InstructorOverview from "./dashboard/InstructorOverview";
import { buildInstructorOverview, loadInstructorReports, loadInstructorSnapshot } from "./dashboard/overviewData";

export function InstructorDashboard() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const snapshot = useApiResource(loadInstructorSnapshot, user?.id || "", { cacheKey: `instructor:dashboard:${user?.id || "unknown"}` });
  const reports = useApiResource(loadInstructorReports, user?.id || "", { cacheKey: `instructor:reports:${user?.id || "unknown"}` });
  return <InstructorOverview user={user} overview={buildInstructorOverview(snapshot.data || {}, reports.data || [], new Date(), weekOffset)}
    loading={{ snapshot: snapshot.loading, reports: reports.loading }} errors={{ snapshot: snapshot.error, reports: reports.error }}
    onRetrySnapshot={snapshot.reload} onRetryReports={reports.reload}
    onPreviousWeek={() => setWeekOffset(offset => offset - 1)} onNextWeek={() => setWeekOffset(offset => Math.min(0, offset + 1))} />;
}
