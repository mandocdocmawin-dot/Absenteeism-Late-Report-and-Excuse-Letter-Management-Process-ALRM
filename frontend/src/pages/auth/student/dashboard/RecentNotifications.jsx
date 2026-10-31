import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import useStudentPreferences from "../useStudentPreferences";
import { recentRequestActivity } from "./studentOverview";

const icons = { approved: CheckCircle2, noted: CheckCircle2, invalid: XCircle, pending: Clock3 };
const colors = { approved: "text-green-600 dark:text-green-400", noted: "text-green-600 dark:text-green-400", invalid: "text-red-600 dark:text-red-400", pending: "text-orange-600 dark:text-orange-400" };

export default function RecentNotifications({ userId, requests }) {
  const { preferences } = useStudentPreferences(userId);
  const activity = preferences.requestUpdates ? recentRequestActivity(requests).slice(0, 3) : [];
  return <section id="recent-notifications" tabIndex={-1} className="mt-[34px] scroll-mt-6 outline-none sm:mx-1.5">
    <h2 className="mb-5 flex items-center gap-2 text-[18px] font-semibold leading-[22px]">Recent Notifications
      {activity.length > 0 && <span className="rounded-full bg-[#173568] px-1.5 py-0.5 text-[9px] font-medium leading-[10px] text-white">{activity.length} recent</span>}
    </h2>
    <div className="grid gap-[9px] sm:mx-2">
      {activity.map((item) => {
        const Icon = icons[item.status];
        return <Link key={item.id} to={`/student/records?request=${encodeURIComponent(item.requestId)}`} className="flex min-h-[52px] items-center gap-2 rounded-[7px] bg-[#f6f6f6] px-[9px] py-2 text-[14px] leading-[17px] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:bg-slate-900 dark:hover:bg-slate-800">
          <Icon className={`size-5 shrink-0 ${colors[item.status]}`} aria-hidden="true" />
          <div className="min-w-0"><p className="break-words">{item.message}</p><p className="text-[14px] leading-[17px] text-[#827b7b] dark:text-slate-400"><time dateTime={item.date}>{formatDistanceToNow(new Date(item.date), { addSuffix: true })}</time> &bull; Academic Request</p></div>
        </Link>;
      })}
      {!activity.length && <p className="rounded-md bg-[#f6f6f6] p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">{!preferences.requestUpdates ? "Request updates are turned off in Settings." : "No recent request updates."}</p>}
    </div>
  </section>;
}
