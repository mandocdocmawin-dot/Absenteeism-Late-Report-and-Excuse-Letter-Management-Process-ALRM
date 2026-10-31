import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/dashboard/StatusBadge";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";

export default function NotificationPanel({ activity = [], loading, error, warning, onRefresh, onClose, readIds, onRead, showFooter = true, emptyMessage = "No recent request updates.", notificationsPath = "/student/notifications", unreadTitle = "Unread on this browser" }) {
  return <div className="grid min-w-0 gap-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">Recent request activity</p>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh notifications" title="Refresh notifications" className="rounded-md p-2 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">
        <RefreshCw aria-hidden="true" className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
    {!loading && !error && warning && <p role="alert" className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">{warning}</p>}
    {loading && !activity.length ? <LoadingSkeleton variant="list" rows={showFooter ? 3 : 6} label="Loading notifications..." />
      : error ? <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
        <p>{error}</p><button type="button" onClick={onRefresh} className="mt-2 font-semibold underline">Try again</button>
      </div>
      : !activity.length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      : <ul className="grid gap-2">
        {activity.map((item) => <li key={item.id}>
          <Link to={item.href || `/student/records?request=${encodeURIComponent(item.requestId)}`} title={item.readStatusTitle} onClick={() => { onRead?.(item.id); onClose?.(); }} className="grid gap-2 rounded-md px-3 py-3 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-slate-800">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 break-words text-sm leading-relaxed">{item.message}</p>
              {readIds && !readIds.has(item.id) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400"><span className="sr-only">{item.unreadTitle || unreadTitle}</span></span>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {item.status && <StatusBadge value={item.status} />}
              <time dateTime={item.date} className="text-xs text-slate-500 dark:text-slate-400">{formatDistanceToNow(new Date(item.date), { addSuffix: true })}</time>
            </div>
          </Link>
        </li>)}
      </ul>}
    {showFooter && <Link to={notificationsPath} onClick={onClose} className="border-t border-slate-200 pt-3 text-center text-sm font-semibold text-blue-700 hover:underline dark:border-slate-700 dark:text-blue-300">View all notifications</Link>}
  </div>;
}
