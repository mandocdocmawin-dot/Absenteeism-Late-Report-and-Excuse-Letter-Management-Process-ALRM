import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { normalizeRole } from "@/lib/roles";
import { previewRoleLabel } from "@/lib/previewRole";
import NotificationHeader from "@/pages/auth/student/notifications/NotificationHeader";
import NotificationPanel from "@/pages/auth/student/notifications/NotificationPanel";
import useServerNotifications from "./useServerNotifications";
import NotificationAccountNotice from "./NotificationAccountNotice";

function AccountNotifications({ user }) {
  const [open, setOpen] = useState(false);
  const notifications = useServerNotifications(user, { preview: true, enabled: open });
  const count = notifications.unreadCount;
  const close = () => setOpen(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger aria-label="Notifications" title="Notifications" className="relative rounded-full p-2 text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500">
      <Bell aria-hidden="true" className="size-5" strokeWidth={2} />
      {!notifications.loading && !notifications.error && count > 0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-[#203b82] px-1 text-center text-[10px] font-bold leading-4 text-white">{count > 99 ? "99+" : count}<span className="sr-only"> unread notifications</span></span>}
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} className="max-h-[calc(100dvh-6rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto border border-slate-200 bg-white p-4 text-slate-950">
      {open && <>
        <NotificationHeader onClose={close} canMarkAll={notifications.canMarkAll} onMarkAll={notifications.markAllRead} notificationsPath="/notifications" readStatusTitle={notifications.readStatusTitle} />
        {notifications.readError && <p role="alert" className="text-sm text-red-700">{notifications.readError}</p>}
        <NotificationPanel {...notifications} activity={notifications.activity.slice(0, 5)} onRead={id => notifications.markRead([id])} onRefresh={notifications.reload} onClose={close} notificationsPath="/notifications" unreadTitle="Unread in your account" />
      </>}
    </PopoverContent>
  </Popover>;
}

function PreviewNotifications({ user, audience }) {
  return <Popover>
    <PopoverTrigger aria-label="Notifications" title={`${previewRoleLabel(audience)} account required`} className="rounded-full p-2 text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500"><Bell aria-hidden="true" className="size-5" /></PopoverTrigger>
    <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] bg-white p-4 text-slate-950">
      <PopoverTitle>Notifications</PopoverTitle>
      <NotificationAccountNotice user={user} audience={audience} />
    </PopoverContent>
  </Popover>;
}

export default function NotificationBell({ user, audience }) {
  if (user?.id && audience && normalizeRole(user.role) !== normalizeRole(audience)) return <PreviewNotifications user={user} audience={audience} />;
  return user?.id ? <AccountNotifications key={user.id} user={user} /> : <button type="button" disabled aria-label="Notifications" className="rounded-full p-2 text-slate-400"><Bell aria-hidden="true" className="size-5" /></button>;
}
