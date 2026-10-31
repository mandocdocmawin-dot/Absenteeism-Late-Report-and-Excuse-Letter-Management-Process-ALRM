import { useCallback, useEffect, useRef, useState } from "react";
import { useApiResource } from "@/hooks/useApiResource";
import useNotificationPreferences from "@/hooks/useNotificationPreferences";
import useNotificationReadState from "@/pages/auth/student/notifications/useNotificationReadState";
import { normalizeRole } from "@/lib/roles";
import { mergeAdminAuditActivity, mergeProgramAuditActivity, mergeRequestActivity, notificationActivity } from "./notificationData";
import { getCachedNotificationPreview, loadNotificationFeed, loadNotificationPreview, markFeedRead } from "./notificationFeed";

const changedEvent = "alrm:notifications-updated";

export function notificationResourceOptions(preview, enabled, initialData) {
  return { enabled: preview ? enabled : true, initialData };
}

export default function useServerNotifications(user, { preview = false, enabled = true } = {}) {
  const { id, role } = user;
  const load = useCallback(() => preview ? loadNotificationPreview(id) : loadNotificationFeed(role, id), [id, preview, role]);
  const resource = useApiResource(load, id, notificationResourceOptions(preview, enabled, getCachedNotificationPreview(id)));
  const { preferences } = useNotificationPreferences(user.id, user.role);
  const normalizedRole = normalizeRole(role);
  const localReadKey = normalizedRole === "admin" ? `admin-activity:${id}` : normalizedRole === "program" ? `program-activity:${id}` : `instructor:${id}`;
  const { readIds: localReadIds } = useNotificationReadState(localReadKey);
  const [readError, setReadError] = useState("");
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    window.addEventListener(changedEvent, resource.reload);
    return () => window.removeEventListener(changedEvent, resource.reload);
  }, [resource.reload]);

  async function saveRead(items, all = false) {
    if (busy.current || (!all && !items.length)) return;
    busy.current = true;
    setWorking(true);
    setReadError("");
    try {
      await markFeedRead(id, items, all);
    } catch (error) {
      if (mounted.current) setReadError(error.message || "Read status could not be saved.");
    } finally {
      window.dispatchEvent(new Event("alrm:notification-read"));
      window.dispatchEvent(new Event(changedEvent));
      busy.current = false;
      if (mounted.current) setWorking(false);
    }
  }

  const serverActivity = notificationActivity(resource.data?.notifications || [], role, preferences, id);
  const fallbackReadIds = new Set([...localReadIds, ...(resource.data?.auditReadIds || [])]);
  const activity = preview ? serverActivity : normalizedRole === "admin"
    ? mergeAdminAuditActivity(serverActivity, preferences.requestUpdates ? resource.data?.auditLogs || [] : [], user, fallbackReadIds)
    : normalizedRole === "program"
      ? mergeProgramAuditActivity(serverActivity, preferences.requestUpdates ? resource.data?.auditLogs || [] : [], user, fallbackReadIds)
    : mergeRequestActivity(serverActivity, preferences.requestUpdates ? resource.data?.requests || [] : [], user, localReadIds);
  const readIds = new Set(activity.filter(item => item.isRead).map(item => item.id));
  const activityUnreadCount = activity.filter(item => !item.isRead).length;
  const unreadCount = resource.data?.unreadCount ?? activityUnreadCount;
  const readStatusTitle = activity.some(item => item.source) ? "Notification reads are saved to your account; activity log reads are saved on this browser." : "Saved to your account";
  return { activity, readIds, unreadCount, loading: resource.loading, error: resource.error, warning: resource.data?.warning, reload: resource.reload, readError: readError || resource.data?.readError || "", working, readStatusTitle,
    canMarkAll: !working && !resource.loading && !resource.error && (unreadCount > 0 || activityUnreadCount > 0),
    markRead: ids => saveRead(activity.filter(item => ids.includes(item.id) && !item.isRead)),
    markAllRead: () => saveRead(activity.filter(item => !item.isRead), true),
  };
}
