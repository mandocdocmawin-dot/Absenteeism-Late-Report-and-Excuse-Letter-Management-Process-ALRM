import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function CourseTick({ x, y, payload, courses }) {
  const course = courses.find(item => String(item.id) === String(payload.value));
  if (!course) return null;
  const label = course.subjectName.length > 24 ? `${course.subjectName.slice(0, 21)}...` : course.subjectName;
  return <g transform={`translate(${x},${y})`}><title>{course.subjectName} {course.section}</title>
    <text textAnchor="middle" fill="#334155" fontSize={11}><tspan x="0" dy="16">{label}</tspan><tspan x="0" dy="16" fill="#64748b">{course.section}</tspan></text>
  </g>;
}

export default function WeeklyReportsChart({ courses, week, onPreviousWeek, onNextWeek }) {
  const hasReports = courses.some(course => course.weeklyAbsences || course.weeklyLates);
  return <section aria-labelledby="weekly-chart-title" className="min-w-0 rounded-[4px] border border-[#D0D0D0] bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="weekly-chart-title" className="text-base font-semibold">Weekly Bar Chart</h2><div className="mt-1 flex flex-wrap items-center gap-2"><p aria-live="polite" className="text-xs text-slate-600">{week.label} / Reported requests</p><div className="flex gap-1">
        <button type="button" aria-label="Previous week" title="Previous week" onClick={onPreviousWeek} disabled={!week.hasPrevious || !onPreviousWeek} className="inline-flex size-7 items-center justify-center rounded border border-slate-200 text-[#203B82] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="size-4" aria-hidden="true" /></button>
        <button type="button" aria-label="Next week" title="Next week" onClick={onNextWeek} disabled={!week.hasNext || !onNextWeek} className="inline-flex size-7 items-center justify-center rounded border border-slate-200 text-[#203B82] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="size-4" aria-hidden="true" /></button>
      </div></div></div>
      <div className="flex gap-4 text-xs text-slate-700"><span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-[#ED2532]" />Absences</span><span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-[#FF7814]" />Lates</span></div>
    </div>
    {courses.length ? <>
      <div className="mt-5 overflow-x-auto" tabIndex={0} aria-label="Weekly reported requests by course">
        <div className="h-[260px]" style={{ minWidth: Math.max(520, courses.length * 170) }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: Math.max(520, courses.length * 170), height: 260 }}>
            <BarChart data={courses} margin={{ top: 22, right: 12, left: -12, bottom: 12 }} barGap={6} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#F1F3F7" />
              <XAxis dataKey="id" interval={0} height={52} tickLine={false} axisLine={{ stroke: "#94A3B8" }} tick={<CourseTick courses={courses} />} />
              <YAxis allowDecimals={false} domain={[0, dataMax => Math.max(12, Math.ceil(dataMax / 3) * 3)]} tickCount={5} tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "#F8FAFC" }} labelFormatter={id => { const course = courses.find(item => item.id === id); return course ? `${course.subjectName} / ${course.section}` : id; }} />
              <Bar dataKey="weeklyAbsences" name="Absences" fill="#ED2532" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}><LabelList dataKey="weeklyAbsences" position="top" fill="#64748B" fontSize={11} /></Bar>
              <Bar dataKey="weeklyLates" name="Lates" fill="#FF7814" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}><LabelList dataKey="weeklyLates" position="top" fill="#64748B" fontSize={11} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="sr-only"><table><caption>Weekly reported requests, {week.label}</caption><thead><tr><th>Course and section</th><th>Absences</th><th>Lates</th></tr></thead><tbody>{courses.map(course => <tr key={course.id}><th>{course.subjectName} {course.section}</th><td>{course.weeklyAbsences}</td><td>{course.weeklyLates}</td></tr>)}</tbody></table></div>
      {!hasReports && <p className="mt-1 text-center text-sm text-slate-500">No reported requests this week.</p>}
    </> : <p className="flex min-h-[260px] items-center justify-center text-center text-sm text-slate-500">No reported requests to chart this week.</p>}
  </section>;
}
