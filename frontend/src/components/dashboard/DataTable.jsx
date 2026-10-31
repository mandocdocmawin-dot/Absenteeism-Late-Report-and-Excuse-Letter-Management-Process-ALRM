function DataTable({ columns, rows, empty = "No records found.", rowKey = (row) => row.id }) {
  return <div className="overflow-x-auto border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        <tr>{columns.map((column) => <th key={column.key} scope="col" className="px-4 py-3">{column.label}</th>)}</tr>
      </thead>
      <tbody>{rows.map((row) => <tr key={rowKey(row)} className="border-t border-slate-200 text-slate-900 dark:border-slate-800 dark:text-slate-100">{columns.map((column) => <td key={column.key} className="px-4 py-3 align-top">{column.render ? column.render(row) : row[column.key] ?? "—"}</td>)}</tr>)}</tbody>
    </table>
    {!rows.length && <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{empty}</p>}
  </div>;
}

export default DataTable;
