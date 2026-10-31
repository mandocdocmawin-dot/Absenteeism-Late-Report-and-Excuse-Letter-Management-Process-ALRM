import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getResourceCacheEntry,
  requestCachedResource,
  resourceKey,
  subscribeResourceCache,
} from "@/api/resourceCache";

export function initialApiResourceState(enabled, initialData) {
  return { data: initialData ?? null, error: "", loading: enabled };
}

export function useApiResource(load, key = "", { enabled = true, initialData = null, cacheKey = "" } = {}) {
  const mounted = useRef(true);
  const resolvedKey = useMemo(() => resourceKey(load, key, cacheKey), [load, key, cacheKey]);
  const [state, setState] = useState(() => {
    const cached = enabled ? getResourceCacheEntry(resolvedKey) : null;
    return cached
      ? { data: cached.data, error: "", loading: false, updatedAt: cached.updatedAt }
      : { ...initialApiResourceState(enabled, initialData), updatedAt: null };
  });

  const loadResource = useCallback((force = false) => {
    if (!enabled) return Promise.resolve(null);
    const cached = !force && getResourceCacheEntry(resolvedKey);
    if (cached) {
      if (mounted.current) setState({ data: cached.data, error: "", loading: false, updatedAt: cached.updatedAt });
      return Promise.resolve(cached.data);
    }
    if (mounted.current) setState((current) => ({ ...current, error: "", loading: true }));
    return requestCachedResource(resolvedKey, (signal) => load(key, signal), { force }).then(
      (data) => {
        const entry = getResourceCacheEntry(resolvedKey);
        if (mounted.current) setState({ data, error: "", loading: false, updatedAt: entry?.updatedAt || Date.now() });
        return data;
      },
      (error) => {
        if (mounted.current) setState((current) => ({ ...current, error: error.message, loading: false }));
        throw error;
      },
    );
  }, [enabled, key, load, resolvedKey]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const unsubscribe = subscribeResourceCache(resolvedKey, () => {
      if (!active) return;
      const entry = getResourceCacheEntry(resolvedKey);
      if (entry) setState({ data: entry.data, error: "", loading: false, updatedAt: entry.updatedAt });
    });
    if (enabled) queueMicrotask(() => active && loadResource().catch(() => {}));
    return () => { active = false; mounted.current = false; unsubscribe(); };
  }, [enabled, loadResource, resolvedKey]);

  const reload = useCallback(() => loadResource(true).catch(() => null), [loadResource]);

  return { ...state, reload };
}
