import { apiFetch, ApiError } from "./client.js";

async function request(path, options) {
  const response = await apiFetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) {
    throw new ApiError(body?.message || "Notifications could not be updated. Please try again.", response.status);
  }
  return body.data;
}

export async function getNotifications() {
  const data = await request("/api/notifications");
  if (!Array.isArray(data)) throw new Error("The server returned an unexpected notifications response.");
  return data;
}

export async function getNotificationPreview() {
  const data = await request("/api/notifications/preview");
  if (!Array.isArray(data?.notifications) || !Number.isSafeInteger(data?.unread_count) || data.unread_count < 0) {
    throw new Error("The server returned an unexpected notification preview response.");
  }
  return { notifications: data.notifications, unreadCount: data.unread_count };
}

export async function getNotificationUnreadCount() {
  const data = await request("/api/notifications/unread-count");
  if (!Number.isSafeInteger(data?.unread_count) || data.unread_count < 0) {
    throw new Error("The server returned an unexpected notification unread-count response.");
  }
  return data.unread_count;
}

export async function markNotificationRead(id) {
  const data = await request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
  if (data?.id !== id || data.is_read !== true) throw new Error("The server did not confirm this notification was read.");
  return data;
}

export function markAllNotificationsRead() {
  return request("/api/notifications/read-all", { method: "PATCH" });
}

export async function saveEmailNotificationPreference(enabled) {
  const data = await request("/api/me/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify({ email_notifications_enabled: enabled }),
    signal: AbortSignal.timeout(15000),
  });
  if (typeof data?.email_notifications_enabled !== "boolean") {
    throw new Error("The server did not confirm the email notification preference.");
  }
  return data.email_notifications_enabled;
}
