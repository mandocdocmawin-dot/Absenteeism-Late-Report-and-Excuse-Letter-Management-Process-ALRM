import { useCallback, useMemo } from "react";
import { getFlaggedStudents, getProgramHeadDashboard, getProgramHeadRequests } from "@/api/programHead";
import { useApiResource } from "@/hooks/useApiResource";

const loaders = { dashboard: getProgramHeadDashboard, flags: getFlaggedStudents, requests: getProgramHeadRequests };

export function useProgramHeadRecords(requested = ["dashboard", "flags", "requests"]) {
  const requestedKey = requested.join(",");
  const enabled = useMemo(() => new Set(requestedKey.split(",").filter(Boolean)), [requestedKey]);
  const dashboardState = useApiResource(loaders.dashboard, "", { enabled: enabled.has("dashboard"), cacheKey: "program-head:dashboard" });
  const flagsState = useApiResource(loaders.flags, "", { enabled: enabled.has("flags"), initialData: [], cacheKey: "program-head:flags" });
  const requestsState = useApiResource(loaders.requests, "", { enabled: enabled.has("requests"), initialData: [], cacheKey: "program-head:requests" });
  const states = useMemo(() => ({ dashboard: dashboardState, flags: flagsState, requests: requestsState }), [dashboardState, flagsState, requestsState]);
  const refresh = useCallback(() => Promise.all([...enabled].map((key) => states[key].reload())), [enabled, states]);

  return {
    dashboard: dashboardState.data,
    flags: flagsState.data || [],
    requests: requestsState.data || [],
    errors: Object.fromEntries(Object.entries(states).map(([key, state]) => [key, state.error])),
    resourceLoading: Object.fromEntries(Object.entries(states).map(([key, state]) => [key, enabled.has(key) && state.loading])),
    ready: Object.fromEntries(Object.entries(states).map(([key, state]) => [key, !enabled.has(key) || (!state.loading && !state.error)])),
    loading: [...enabled].some((key) => states[key].loading),
    updatedAt: Math.max(...[...enabled].map((key) => states[key].updatedAt || 0), 0) || null,
    refresh,
  };
}
