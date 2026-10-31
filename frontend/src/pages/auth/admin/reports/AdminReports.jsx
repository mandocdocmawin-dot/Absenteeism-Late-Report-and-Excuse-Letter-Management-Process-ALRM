import { useEffect, useRef, useState } from "react";
import { generateAdminReport, downloadGeneratedReport } from "@/api/adminReports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import RequestPagination from "@/pages/auth/instructor/InstructorRequests/RequestPagination";
import { paginateRecords } from "@/pages/auth/student/records/pagination";
import { getSelectablePrograms } from "@/lib/programs";
import { reportHeadings as headings } from "./reportData.js";

const emptyFilters = { program_id: "", status: "", date_from: "", date_to: "" };
const field = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

export default function AdminReports({ programs }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pending = useRef(null);
  const selectablePrograms = getSelectablePrograms(programs);
  useEffect(() => () => pending.current?.abort(), []);
  const pagination = paginateRecords(report?.rows || [], page);
  function change(event) { setFilters(current => ({ ...current, [event.target.name]: event.target.value })); }
  async function generate(event) {
    event.preventDefault();
    if (pending.current) return;
    if (filters.program_id && !selectablePrograms.some(program => String(program.id) === filters.program_id)) { setError("Select a program from the available list."); return; }
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) { setError("The end date must be on or after the start date."); return; }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError(""); setReport(null);
    try {
      const next = await generateAdminReport(filters, { signal: controller.signal });
      if (!controller.signal.aborted) { setReport(next); setPage(1); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || "The report could not be generated.");
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setLoading(false); }
    }
  }
  return <div className="grid min-w-0 gap-6">
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h1 className="mb-5 text-lg font-semibold">Generate requests report</h1>
      <form className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={generate}>
        <label className="grid gap-2 text-sm">Program<select name="program_id" value={filters.program_id} onChange={change} className={field}><option value="">All programs</option>{selectablePrograms.map(program => <option key={program.id} value={program.id}>{program.program_name}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Status<select name="status" value={filters.status} onChange={change} className={field}><option value="">All statuses</option>{["pending", "approved", "invalid"].map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
        <label className="grid gap-2 text-sm">From<Input name="date_from" type="date" value={filters.date_from} onChange={change} className="h-11" /></label>
        <label className="grid gap-2 text-sm">To<Input name="date_to" type="date" min={filters.date_from || undefined} value={filters.date_to} onChange={change} className="h-11" /></label>
        <Button type="submit" disabled={loading} className="h-11 bg-[#172f6b] text-white hover:bg-[#203f8a]">Generate</Button>
      </form>
    </section>
    {error && <ErrorState message={error} />}
    {loading && <LoadingSkeleton variant="table" columns={headings.length} rows={10} label="Generating report" />}
    {report && <section aria-labelledby="generated-report-title" className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
      <h2 id="generated-report-title" className="text-lg font-semibold">Generated report</h2>
      <p className="mt-2 text-sm text-slate-600">{report.rows.length} records · {programs.find(program => program.id === report.filters.program_id)?.program_name || "All programs"} · {report.filters.status || "All statuses"}{report.filters.date_from ? ` · From ${report.filters.date_from}` : ""}{report.filters.date_to ? ` · To ${report.filters.date_to}` : ""}</p>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[#bccae5] text-[#203B82]">{headings.map(heading => <th key={heading} scope="col" className="px-3 py-4 font-semibold">{heading}</th>)}</tr></thead><tbody>{pagination.pageRecords.map((row, index) => <tr key={`${row["Request ID"]}-${index}`} className="border-b border-[#cbd6ed]">{headings.map(heading => <td key={heading} className="break-words px-3 py-4">{row[heading] || "—"}</td>)}</tr>)}{!report.rows.length && <tr><td colSpan={headings.length} className="py-10 text-center text-slate-500">No requests match the generated report.</td></tr>}</tbody></table></div>
      <div className="mt-5"><RequestPagination pagination={pagination} total={report.rows.length} onPage={setPage} /></div>
      <div className="mt-6 flex justify-end"><Button onClick={() => downloadGeneratedReport(report)} className="h-11 bg-[#172f6b] px-6 py-3 text-white hover:bg-[#203f8a]">Download</Button></div>
    </section>}
  </div>;
}
