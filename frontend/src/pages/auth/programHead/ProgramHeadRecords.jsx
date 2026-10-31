import { useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { resolveProgramHeadFlag } from "@/api/programHead";
import { formatRiskPercentage, requestClass, requestStudent } from "./programHeadData";

const panel = "overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

export function FlaggedRecords({ flags, onRefresh }) {
  const [status, setStatus] = useState("");
  const [resolving, setResolving] = useState("");
  const [error, setError] = useState("");
  const visible = flags.filter((flag) => !status || flag.status === status);

  async function resolveFlag(flagId) {
    setResolving(flagId);
    setError("");
    try {
      await resolveProgramHeadFlag(flagId);
      onRefresh?.();
    } catch (requestError) {
      setError(requestError?.message || "Could not resolve this flag.");
    } finally {
      setResolving("");
    }
  }

  return <section className="space-y-4"><header><h1 className="text-2xl font-bold">Students at risk</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cases escalated to you by instructors</p></header>
    <div className="flex gap-2" role="group" aria-label="Filter by status">{["", "open", "resolved"].map((value) => <button key={value || "all"} type="button" onClick={() => setStatus(value)} className={`rounded-md border px-3 py-1.5 text-sm capitalize ${status === value ? "border-blue-900 bg-blue-900 text-white" : "border-slate-300 dark:border-slate-700"}`}>{value || "All"}</button>)}</div>
    {error ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    {visible.length ? <div className={panel}><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Flagged</th><th className="px-4 py-3">Threshold</th><th className="px-4 py-3">Percentage</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{visible.map((flag) => <tr key={flag.id}><td className="px-4 py-3 font-medium">{requestStudent(flag.request || {})}</td><td className="px-4 py-3">{requestClass(flag.request || {})?.subject_name || "Unavailable"}</td><td className="px-4 py-3">{flag.flagged_date ? new Date(flag.flagged_date).toLocaleDateString() : "—"}</td><td className="px-4 py-3 capitalize">{flag.threshold || "Unavailable"}</td><td className="px-4 py-3">{formatRiskPercentage(flag.percentage)}</td><td className="px-4 py-3">{flag.status === "open" ? <button type="button" disabled={Boolean(resolving)} onClick={() => resolveFlag(flag.id)} className="rounded-md bg-blue-900 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{resolving === flag.id ? "Resolving..." : "Resolve"}</button> : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No matching flagged students" />}
  </section>;
}

export function RequestRecords({ requests }) {
  const [status, setStatus] = useState("");
  const visible = requests.filter((request) => !status || request.status === status);
  return <section className="space-y-4"><header><h1 className="text-2xl font-bold">Program requests</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Late and absence requests in your program</p></header>
    <label className="block text-sm font-medium">Status <select value={status} onChange={(event) => setStatus(event.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"><option value="">All</option>{["pending", "approved", "noted", "invalid"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    {visible.length ? <div className={panel}><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{visible.map((request) => <tr key={request.id}><td className="px-4 py-3 font-medium">{requestStudent(request)}</td><td className="px-4 py-3">{requestClass(request)?.subject_name || "Unavailable"}</td><td className="px-4 py-3 capitalize">{request.type}</td><td className="px-4 py-3"><StatusBadge value={request.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No matching requests" />}
  </section>;
}
