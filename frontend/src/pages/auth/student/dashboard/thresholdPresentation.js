const appearances = {
  safe: { label: "Safe", color: "#16a34a", text: "text-green-700 dark:text-green-400" },
  warning: { label: "Warning", color: "#ff7113", text: "text-[#aa4808] dark:text-orange-400" },
  critical: { label: "Critical", color: "#dc2626", text: "text-red-700 dark:text-red-400" },
  IR: { label: "Incident Report", color: "#dc2626", text: "text-red-700 dark:text-red-400" },
};

const unavailable = { label: "Unavailable", color: "#64748b", text: "text-slate-600 dark:text-slate-300" };

export function resolveThresholdPresentation(threshold = {}) {
  const number = value => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) ? Number(value) : null;
  const used = number(threshold.used);
  const limit = number(threshold.limit);
  const hasContactHours = used !== null && used >= 0 && limit !== null && limit > 0;
  // Canonical contact hours prove the IR boundary even if the saved stage is stale.
  if (hasContactHours && used >= limit) return appearances.IR;
  if (threshold.status === "safe" && !hasContactHours) return unavailable;
  return Object.hasOwn(appearances, threshold.status) ? appearances[threshold.status] : unavailable;
}
