import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { markNotificationsRead, notificationReadKey, parseReadNotificationIds } from "./notificationReadStore";

const changedEvent = "alrm:notification-read";

function subscribe(onChange) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changedEvent, onChange);
  };
}

export default function useNotificationReadState(userId) {
  const [error, setError] = useState("");
  const getSnapshot = useCallback(() => {
    try { return userId ? window.localStorage.getItem(notificationReadKey(userId)) : null; }
    catch { return null; }
  }, [userId]);
  const stored = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const readIds = useMemo(() => parseReadNotificationIds(stored), [stored]);

  function markRead(ids) {
    if (!userId || !ids.length) return;
    try {
      markNotificationsRead(userId, ids, window.localStorage);
      window.dispatchEvent(new Event(changedEvent));
      setError("");
    } catch {
      setError("Read status could not be saved. Please enable site storage and try again.");
    }
  }

  return { readIds, markRead, error };
}
