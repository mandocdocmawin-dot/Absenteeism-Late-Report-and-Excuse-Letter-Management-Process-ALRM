export default function ClassRecordsTable({ columns, empty, children, caption }) {
  return <div className="min-w-0 overflow-x-auto">
    <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm leading-5">
      <caption className="sr-only">{caption}</caption>
      <colgroup>{columns.map(column => <col key={column.label} style={{ width: column.width }} />)}</colgroup>
      <thead className="border-b border-[#B9C7E0] text-xs font-bold text-[#203B82]">
        <tr>{columns.map(column => <th key={column.label} scope="col" className={`px-3 py-3 ${column.center ? "text-center" : ""}`}>
          <span title={column.description}>{column.label}</span>
        </th>)}</tr>
      </thead>
      <tbody className="divide-y divide-[#CCD5E7] border-b border-[#CCD5E7] text-slate-950">
        {empty ? <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-slate-500">{empty}</td></tr> : children}
      </tbody>
    </table>
  </div>;
}
