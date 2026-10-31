const toneMap = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  noted: "border-sky-200 bg-sky-50 text-sky-800",
  invalid: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  IR: "border-rose-200 bg-rose-50 text-rose-800",
  safe: "border-emerald-200 bg-emerald-50 text-emerald-800",
  open: "border-rose-200 bg-rose-50 text-rose-800",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function StatusBadge({ value }) {
  const label = value || "unknown";
  const tone = toneMap[label] || "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize ${tone}`}
    >
      {label}
    </span>
  );
}
