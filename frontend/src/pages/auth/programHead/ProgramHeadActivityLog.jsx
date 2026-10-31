import { getProgramHeadAuditLogs, getProgramHeadRequests } from "@/api/programHead";
import { useApiResource } from "@/hooks/useApiResource";
import ActivityTable from "@/components/common/ActivityTable";
import { auditActivity } from "../admin/overviewData";

export default function ProgramHeadActivityLog() {
  const logs = useApiResource(getProgramHeadAuditLogs, "", { cacheKey: "program-head:activity-logs" });
  const requests = useApiResource(getProgramHeadRequests, "", { initialData: [], cacheKey: "program-head:requests" });
  const reload = () => Promise.all([logs.reload(), requests.reload()]);
  return <div className="space-y-4">
    <h1 className="sr-only">Activity Log</h1>
    <ActivityTable viewKey="program-head:activity-log" rows={auditActivity(logs.data || [], { requests: requests.data || [] })} loading={logs.loading || requests.loading} error={logs.error || requests.error} onRetry={reload} updatedAt={Math.max(logs.updatedAt || 0, requests.updatedAt || 0) || null} />
  </div>;
}
