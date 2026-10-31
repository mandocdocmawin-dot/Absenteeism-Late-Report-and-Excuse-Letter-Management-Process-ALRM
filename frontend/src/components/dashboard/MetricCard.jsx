function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <div className="min-w-0 border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-bold text-[#142f6c] dark:text-blue-200">{value ?? "—"}</p>
          {note && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
        </div>
        {Icon && <Icon className="size-5 shrink-0 text-[#203b82] dark:text-blue-300" aria-hidden="true" />}
      </div>
    </div>
  );
}

export default MetricCard;
