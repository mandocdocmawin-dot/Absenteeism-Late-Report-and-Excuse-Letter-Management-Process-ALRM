import { Download, Search } from "lucide-react";
import { requestStatuses } from "./requestData";

const control = "h-9 max-w-full rounded-[5px] border border-[#A9B9D9] bg-white text-xs text-slate-900 focus:outline-blue-600 disabled:opacity-50";

export default function RequestFilters({ search, subject, status, classes, onSearch, onChange, onExport, disabled, exportDisabled, showSubject = true }) {
  return <div className="flex flex-wrap items-center gap-3">
    <label className="relative min-w-40 flex-1 sm:max-w-72">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
      <input type="search" aria-label="Search Name" placeholder="Search Name..." maxLength={50} value={search} onChange={event => onSearch(event.target.value.slice(0, 50))} className={`${control} w-full pl-9 pr-3`} />
    </label>
    {showSubject && <select aria-label="Filter Subject" value={subject} onChange={event => onChange({ subject: event.target.value })} disabled={disabled} className={`${control} w-52 pl-3`}>
      <option value="">Filter Subject</option>
      {subject && !classes.some(course => course.id === subject) && <option value={subject}>Class unavailable</option>}
      {classes.filter(course => course.id).map(course => <option key={course.id} value={course.id}>{course.label}</option>)}
    </select>}
    <select aria-label="Filter Request" value={status} onChange={event => onChange({ status: event.target.value })} disabled={disabled} className={`${control} w-40 pl-3 capitalize`}>
      <option value="">Filter Request</option>
      {requestStatuses.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
    </select>
    <button type="button" onClick={onExport} disabled={exportDisabled} className="flex h-9 items-center gap-2 rounded-[5px] bg-[#203B82] px-4 text-xs font-semibold text-white hover:bg-[#173166] disabled:opacity-50"><Download aria-hidden="true" className="size-4" />Export</button>
  </div>;
}
