import { Menu } from "@base-ui/react/menu";
import { Check, Ellipsis, Monitor, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { PopoverTitle } from "@/components/ui/popover";

const itemClass = "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none data-highlighted:bg-slate-100 data-disabled:cursor-not-allowed data-disabled:opacity-40 dark:data-highlighted:bg-slate-800";

export default function NotificationHeader({ onClose, onMarkAll, canMarkAll = false, notificationsPath = "/student/notifications", readStatusTitle = "Read status is saved on this browser" }) {
  return <div className="flex items-center justify-between gap-4">
    <PopoverTitle className="text-base font-bold">Notifications</PopoverTitle>
    <div className="flex items-center gap-1">
      <Menu.Root>
        <Menu.Trigger aria-label="Notification options" title="Notification options" className="rounded-md p-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-slate-800"><Ellipsis aria-hidden="true" className="size-5" /></Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={8} className="z-[60]">
            <Menu.Popup className="w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-1.5 text-slate-950 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <Menu.Item disabled={!canMarkAll} onClick={onMarkAll} title={readStatusTitle} className={itemClass}><Check aria-hidden="true" className="size-5 shrink-0" />Mark all as read</Menu.Item>
              <Menu.LinkItem render={<Link to="/settings" />} onClick={onClose} className={itemClass}><Settings aria-hidden="true" className="size-5 shrink-0" />Notification settings</Menu.LinkItem>
              <Menu.LinkItem render={<Link to={notificationsPath} />} onClick={onClose} className={itemClass}><Monitor aria-hidden="true" className="size-5 shrink-0" />Open Notifications</Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  </div>;
}
