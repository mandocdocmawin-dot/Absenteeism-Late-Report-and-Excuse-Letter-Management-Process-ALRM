import { useApiResource } from "@/hooks/useApiResource";
import { loadRequestActivity } from "./notificationData";
import useNotificationReadState from "./useNotificationReadState";

export default function useRequestNotifications(userId) {
  const { data, loading, error, reload } = useApiResource(loadRequestActivity, userId);
  const { readIds, markRead, error: readError } = useNotificationReadState(userId);
  const activity = data || [];
  const canMarkAll = !loading && !error && activity.some((item) => !readIds.has(item.id));
  const markAllRead = () => markRead(activity.map((item) => item.id));
  return { activity, loading, error, reload, readIds, markRead, readError, canMarkAll, markAllRead };
}
