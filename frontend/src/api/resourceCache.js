const MAX_ENTRIES = 150;

const entries = new Map();
const inFlight = new Map();
const listeners = new Map();
const loaderIds = new WeakMap();
let nextLoaderId = 1;

function notify(key) {
  listeners.get(key)?.forEach((listener) => listener());
}

function touch(key, entry) {
  entries.delete(key);
  entries.set(key, { ...entry, lastAccessedAt: Date.now() });
}

function trim() {
  while (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    entries.delete(oldestKey);
    notify(oldestKey);
  }
}

export function resourceKey(load, key = "", explicitKey = "") {
  if (explicitKey) return explicitKey;
  if (!loaderIds.has(load)) loaderIds.set(load, nextLoaderId++);
  return `loader:${loaderIds.get(load)}:${String(key)}`;
}

export function getResourceCacheEntry(key) {
  const entry = entries.get(key);
  if (entry) touch(key, entry);
  return entry || null;
}

export function subscribeResourceCache(key, listener) {
  const keyListeners = listeners.get(key) || new Set();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);
  return () => {
    keyListeners.delete(listener);
    if (!keyListeners.size) listeners.delete(key);
  };
}

export function requestCachedResource(key, load, { force = false } = {}) {
  if (!force) {
    const cached = getResourceCacheEntry(key);
    if (cached) return Promise.resolve(cached.data);
    if (inFlight.has(key)) return inFlight.get(key).promise;
  } else {
    inFlight.get(key)?.controller.abort();
    inFlight.delete(key);
    entries.delete(key);
    notify(key);
  }

  const controller = new AbortController();
  const promise = Promise.resolve()
    .then(() => load(controller.signal))
    .then((data) => {
      if (inFlight.get(key)?.promise !== promise) return data;
      const now = Date.now();
      entries.set(key, { data, updatedAt: now, lastAccessedAt: now });
      trim();
      notify(key);
      return data;
    })
    .finally(() => {
      if (inFlight.get(key)?.promise === promise) inFlight.delete(key);
    });

  inFlight.set(key, { promise, controller });
  return promise;
}

export function invalidateResourceCache(match) {
  const matches = typeof match === "function" ? match : (key) => key === match || key.startsWith(match);
  for (const key of [...entries.keys()]) {
    if (matches(key, entries.get(key))) {
      entries.delete(key);
      notify(key);
    }
  }
}

export function updateResourceCache(key, update) {
  const entry = entries.get(key);
  if (!entry) return false;
  const now = Date.now();
  entries.set(key, { data: update(entry.data), updatedAt: now, lastAccessedAt: now });
  notify(key);
  return true;
}

export function clearResourceCache() {
  for (const { controller } of inFlight.values()) controller.abort();
  const keys = [...entries.keys()];
  entries.clear();
  inFlight.clear();
  keys.forEach(notify);
}

export function resourceCacheSnapshot() {
  return { entries: entries.size, inFlight: inFlight.size };
}
