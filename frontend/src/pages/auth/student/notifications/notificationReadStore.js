export const notificationReadKey = (userId) => `alrm:notification-read:${userId}`;

export function parseReadNotificationIds(value) {
  try {
    const ids = JSON.parse(value);
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : []);
  } catch { return new Set(); }
}

export function getReadNotificationIds(userId, storage) {
  if (!userId) return new Set();
  try { return parseReadNotificationIds(storage.getItem(notificationReadKey(userId))); }
  catch { return new Set(); }
}

export function markNotificationsRead(userId, ids, storage) {
  if (!userId || !ids.length) return;
  const readIds = getReadNotificationIds(userId, storage);
  ids.filter((id) => typeof id === "string" && id).forEach((id) => readIds.add(id));
  storage.setItem(notificationReadKey(userId), JSON.stringify([...readIds]));
}

export function initializeNotificationReadIds(userId, ids, storage) {
  if (!userId) return new Set();
  const key = notificationReadKey(userId);
  const stored = storage.getItem(key);
  if (stored != null) return parseReadNotificationIds(stored);
  const readIds = new Set(ids.filter(id => typeof id === "string" && id));
  storage.setItem(key, JSON.stringify([...readIds]));
  return readIds;
}
