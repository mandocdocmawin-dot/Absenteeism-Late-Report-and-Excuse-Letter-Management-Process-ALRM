import { useState } from "react";
import { FileDown, FileText } from "lucide-react";
import { downloadProgramHeadReport } from "@/api/programHead";
import { ErrorState } from "@/components/common/ErrorState";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import { filterReportRows, formatRiskPercentage, requestClass, requestDate, requestStudent } from "./programHeadData";
import { useProgramHeadRecords } from "./useProgramHeadRecords";
import { isValidDate } from "@/lib/inputValidation";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";

function ReportFilters({ draft, change, programName, generate, invalid }) {
  return <form onSubmit={generate} className="grid gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto] xl:items-end">
    <label className="grid gap-2 text-sm font-medium">Report type<select className={field} value={draft.type} onChange={(event) => change("type", event.target.value)}><option value="activity">Absenteeism &amp; tardiness</option><option value="risk">Students at risk</option></select></label>
    <label className="grid gap-2 text-sm font-medium">Program<input className={field} value={programName || "Assigned program"} readOnly /></label>
    <label className="grid gap-2 text-sm font-medium">From<input className={field} type="date" value={draft.from} onChange={(event) => change("from", event.target.value)} /></label>
    <label className="grid gap-2 text-sm font-medium">To<input className={field} type="date" value={draft.to} onChange={(event) => change("to", event.target.value)} /></label>
    <button type="submit" disabled={invalid} className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Generate report</button>
    {invalid ? <p role="alert" className="text-sm text-rose-600 sm:col-span-2 xl:col-span-5">Choose valid dates with the end date on or after the start date.</p> : null}
  </form>;
}

function ReportTable({ type, rows }) {
  const risk = type === "risk";
  return <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">{risk ? "Flagged date" : "Submitted"}</th><th className="px-4 py-3">{risk ? "Threshold" : "Type"}</th>{risk ? <th className="px-4 py-3">Percentage</th> : null}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{rows.map((row) => { const request = risk ? row.request || {} : row; const date = risk ? row.flagged_date : request.date_submitted || request.created_at; return <tr key={row.id}><td className="px-4 py-3 font-medium">{requestStudent(request)}</td><td className="px-4 py-3">{requestClass(request)?.subject_name || "Unavailable"}</td><td className="px-4 py-3">{date ? new Date(date).toLocaleDateString() : "—"}</td><td className="px-4 py-3 capitalize">{risk ? row.threshold || "Unavailable" : request.type}</td>{risk ? <td className="px-4 py-3">{formatRiskPercentage(row.percentage)}</td> : null}</tr>; })}</tbody></table></div>;
}

export function ProgramHeadReports() {
  const { dashboard, flags, requests, errors, loading, refresh } = useProgramHeadRecords();
  const [draft, setDraft] = useState({ type: "activity", from: "", to: "" });
  const [applied, setApplied] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const invalid = !["activity", "risk"].includes(draft.type) || Boolean((draft.from && !isValidDate(draft.from)) || (draft.to && !isValidDate(draft.to)) || (draft.from && draft.to && draft.from > draft.to));
  const rows = applied ? filterReportRows(applied.type === "risk" ? flags : requests, applied.from, applied.to, (row) => applied.type === "risk" ? row.flagged_date && new Date(row.flagged_date) : requestDate(row)) : [];
  const relevantError = errors[applied?.type === "risk" ? "flags" : "requests"];
  function generate(event) { event.preventDefault(); if (invalid) return; setApplied({ ...draft }); refresh(); }
  async function exportReport() {
    setExporting(true);
    setExportError("");
    try { await downloadProgramHeadReport(applied); }
    catch (error) { setExportError(error?.message || "Could not export this report."); }
    finally { setExporting(false); }
  }
  return <div className="space-y-6"><header><p className="text-sm font-medium text-blue-900 dark:text-blue-300">System report</p><h1 className="mt-1 text-2xl font-bold">Program reports</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review submitted requests and escalated students in your program</p></header>
    <section className="space-y-5 rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><ReportFilters draft={draft} change={(key, value) => setDraft((previous) => ({ ...previous, [key]: value }))} programName={dashboard?.program_name} generate={generate} invalid={invalid} />
      {exportError ? <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{exportError}</p> : null}
      {loading ? <LoadingSkeleton variant="table" columns={applied?.type === "risk" ? 5 : 4} label="Loading program data" /> : relevantError ? <ErrorState message={relevantError} /> : applied ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{applied.type === "risk" ? "Students at risk" : "Absenteeism & tardiness"}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{rows.length} {rows.length === 1 ? "record" : "records"}</p></div>{rows.length ? <button type="button" disabled={exporting} onClick={exportReport} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"><FileDown className="size-4" />{exporting ? "Exporting..." : "Export CSV"}</button> : null}</div>{rows.length ? <ReportTable type={applied.type} rows={rows} /> : <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No records for this report and date range.</p>}</> : <div className="grid min-h-40 place-content-center gap-2 text-center text-slate-500 dark:text-slate-400"><FileText className="mx-auto size-8" /><p className="text-sm">Choose report filters and generate a report.</p></div>}
    </section><p className="text-xs text-slate-500 dark:text-slate-400">Risk thresholds and percentages use the backend attendance calculation for the current enrollment.</p>
  </div>;
}
