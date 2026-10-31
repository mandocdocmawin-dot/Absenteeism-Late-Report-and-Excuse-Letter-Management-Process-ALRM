import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { programShortName } from "@/lib/programs";
import { generateAdminReport } from "@/api/adminReports";
import { Skeleton } from "@/components/ui/skeleton";
import { departmentWeekRows, schoolWeek } from "../reports/reportData.js";

export default function AdminDepartmentChart({ programs = [] }) {
  const [weeksAgo, setWeeksAgo] = useState(0);
  const week = schoolWeek(new Date(), weeksAgo);
  const key = JSON.stringify(week);
  const cachedWeeks = useRef(new Map());
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState({ key: "", loading: true, data: null, error: "" });
  useEffect(() => {
    if (cachedWeeks.current.has(key)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => generateAdminReport(JSON.parse(key), { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) { cachedWeeks.current.set(key, data); setReport({ key, loading: false, data, error: "" }); } },
      failure => { if (!controller.signal.aborted) setReport({ key, loading: false, data: null, error: failure.message || "Weekly reports could not be loaded." }); },
    ), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, revision]);
  function changeWeek(index) {
    if (weeksAgo === index) return;
    const nextKey = JSON.stringify(schoolWeek(new Date(), index));
    const data = cachedWeeks.current.get(nextKey);
    setWeeksAgo(index);
    setReport({ key: nextKey, loading: !data, data: data || null, error: "" });
  }
  const data = departmentWeekRows(programs, report.data?.rows || [], week).map(row => ({ ...row, name: programShortName(row.name) }));
  return <section aria-labelledby="department-chart-title" className="min-w-0 rounded-md border border-[#D0D0D0] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="department-chart-title" className="text-base font-semibold">Absences and Tardiness by Department</h2><p className="mt-1 text-xs text-slate-500">{week.date_from} – {week.date_to}</p></div>
      <div className="flex gap-3 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#ED2532]" />Absences</span><span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-[#FF7814]" />Lates</span></div>
    </div>
    <div className="mt-4 flex gap-2" aria-label="Weekly report period">{["This week", "Last week"].map((label, index) => <button key={label} type="button" aria-pressed={weeksAgo === index} onClick={() => changeWeek(index)} className={`rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[#203B82] ${weeksAgo === index ? "border-[#203B82] bg-blue-50 text-[#203B82]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div>
    {report.loading || report.key !== key ? <div role="status" aria-label="Loading weekly reports" className="mt-4 h-64"><Skeleton className="h-full w-full" /></div> : report.error ? <div role="alert" className="flex h-64 flex-col items-center justify-center gap-3 text-center text-sm text-slate-600"><p>{report.error}</p><button type="button" onClick={() => { setReport(current => ({ ...current, loading: true })); setRevision(value => value + 1); }} className="text-blue-800 underline">Retry weekly reports</button></div> : <div className="relative mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 256 }}>
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 10, left: -24 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "#94A3B8" }} tick={{ fill: "#475569", fontSize: 11 }} interval={0} />
          <YAxis domain={[0, dataMax => Math.max(3, dataMax)]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="absences" name="Absences" fill="#ED2532" isAnimationActive={false} />
          <Bar dataKey="lates" name="Lates" fill="#FF7814" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {!data.some(row => row.absences > 0) && <p className="pointer-events-none absolute inset-x-10 top-1/2 text-center text-sm text-slate-500">No absence reports for this week.</p>}
      <ul className="sr-only">{data.map(row => <li key={row.name}>{row.name}: {row.absences} absence reports. Late total unavailable.</li>)}</ul>
    </div>}
    <p className="mt-3 text-xs text-slate-500">Counts reflect submitted absence reports. Late totals are currently unavailable.</p>
  </section>;
}
