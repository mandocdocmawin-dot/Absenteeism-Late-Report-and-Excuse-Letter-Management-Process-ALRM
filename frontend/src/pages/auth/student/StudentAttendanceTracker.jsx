import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";

function StudentAttendanceTracker({ attendance }) {
  return <section>
    <h2 className="mb-3 text-lg font-semibold text-slate-950 dark:text-slate-50">Attendance by class</h2>
    {attendance.length === 0 ? <EmptyState title="No attendance records" /> : <div className="grid gap-3 md:grid-cols-2">
      {attendance.map((item) => <article key={item.class_id} className="rounded-[5px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex justify-between gap-3">
          <h3 className="font-semibold">{item.subject_name}</h3>
          <StatusBadge value={item.tracker?.status || "safe"} />
        </div>
        <dl className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
          <div><dt className="inline font-medium">Lates:</dt> <dd className="inline">{item.tracker?.total_lates ?? 0}</dd></div>
          <div><dt className="inline font-medium">Absences:</dt> <dd className="inline">{item.tracker?.total_absences ?? 0}</dd></div>
          <div><dt className="inline font-medium">Recorded absence hours:</dt> <dd className="inline">{item.tracker?.absence_hours ?? 0}</dd></div>
        </dl>
      </article>)}
    </div>}
  </section>;
}

export default StudentAttendanceTracker;
