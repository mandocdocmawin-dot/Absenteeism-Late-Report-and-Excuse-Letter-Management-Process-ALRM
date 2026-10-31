import { useCallback, useEffect, useMemo } from "react";
import { requestCachedResource } from "@/api/resourceCache";
import { useApiResource } from "./useApiResource";

function stableQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params)
    .filter(([, value]) => value !== "" && value != null)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => query.set(key, String(value)));
  return query.toString();
}

export function usePaginatedResource(resource, loadPage, { page = 1, perPage = 10, ...params } = {}) {
  const serializedParams = JSON.stringify(Object.entries(params).sort(([left], [right]) => left.localeCompare(right)));
  const stableParams = useMemo(() => Object.fromEntries(JSON.parse(serializedParams)), [serializedParams]);
  const query = stableQuery({ ...stableParams, page, per_page: perPage });
  const cacheKey = `${resource}?${query}`;
  const load = useCallback((_key, signal) => loadPage({ ...stableParams, page, perPage }, signal), [loadPage, page, perPage, stableParams]);
  const state = useApiResource(load, query, { cacheKey });
  const meta = state.data?.meta || null;

  const next = useMemo(() => {
    if (!meta || meta.page >= meta.last_page) return null;
    const nextPage = page + 1;
    const nextQuery = stableQuery({ ...stableParams, page: nextPage, per_page: perPage });
    return { key: `${resource}?${nextQuery}`, page: nextPage };
  }, [meta, page, perPage, resource, stableParams]);

  useEffect(() => {
    if (!next) return;
    queueMicrotask(() => requestCachedResource(next.key, (signal) => loadPage({ ...stableParams, page: next.page, perPage }, signal)).catch(() => {}));
  }, [loadPage, next, perPage, stableParams]);

  return { ...state, rows: state.data?.data || [], meta };
}
