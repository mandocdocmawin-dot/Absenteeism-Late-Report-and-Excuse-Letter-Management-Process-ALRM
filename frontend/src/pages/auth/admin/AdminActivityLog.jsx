import { getAdminAuditLogs, getClasses } from "@/api/admin";
import { useApiResource } from "@/hooks/useApiResource";
import ActivityTable from "@/components/common/ActivityTable";
import { auditActivity } from "./overviewData";

export default function AdminActivityLog() {
  const logs = useApiResource(getAdminAuditLogs, "", { cacheKey: "admin:activity-logs" });
  const classes = useApiResource(getClasses, "", { initialData: [], cacheKey: "admin:classes" });
  const reload = () => Promise.all([logs.reload(), classes.reload()]);
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Activity Log</h1><p className="mt-2 text-sm text-slate-500">Request activity across programs.</p></header>
    <ActivityTable viewKey="admin:activity-log" rows={auditActivity(logs.data || [], { classes: classes.data || [] })} loading={logs.loading || classes.loading} error={logs.error || classes.error} onRetry={reload} updatedAt={Math.max(logs.updatedAt || 0, classes.updatedAt || 0) || null} />
  </div>;
}
