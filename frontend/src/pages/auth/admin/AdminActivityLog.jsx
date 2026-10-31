import { useCallback } from "react";
import { getAdminAuditLogsPage } from "@/api/admin";
import { useApiResource } from "@/hooks/useApiResource";
import ActivityTable from "@/components/common/ActivityTable";
import { auditActivity } from "./overviewData";
import { usePageViewState } from "@/hooks/usePageViewState";

export default function AdminActivityLog() {
  const [view, setView] = usePageViewState("admin:activity-log", { filters: { search: "", action: "", subject: "", date: "" }, page: 1 });
  const { filters, page } = view;
  const queryKey = JSON.stringify({ filters, page });
  const load = useCallback((_, signal) => getAdminAuditLogsPage({ signal, page, perPage: 10, filters }), [filters, page]);
  const logs = useApiResource(load, queryKey, { cacheKey: `admin:activity-logs:${queryKey}` });
  const reload = () => logs.reload();
  const pageMeta = logs.data?.meta || null;
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Activity Log</h1><p className="mt-2 text-sm text-slate-500">Request activity across programs.</p></header>
    <ActivityTable
      viewKey="admin:activity-log"
      rows={auditActivity(logs.data?.data || [])}
      loading={logs.loading}
      error={logs.error}
      onRetry={reload}
      updatedAt={logs.updatedAt || null}
      serverPagination={pageMeta}
      onPageChange={nextPage => setView({ filters, page: nextPage })}
      onFilterChange={nextFilters => setView({ filters: nextFilters, page: 1 })}
    />
  </div>;
}
