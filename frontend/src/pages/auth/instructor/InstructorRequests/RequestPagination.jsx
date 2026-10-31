import { ChevronLeft, ChevronRight } from "lucide-react";

export default function RequestPagination({ pagination, total, onPage }) {
  const { currentPage, totalPages, firstRecord, pageRecords, pageButtons } = pagination;
  const button = "flex size-8 items-center justify-center rounded border border-slate-200 text-xs disabled:opacity-40";
  return <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
    <span>{total ? firstRecord + 1 : 0}-{firstRecord + pageRecords.length} of {total}</span>
    <nav aria-label="Request pagination" className="flex gap-1">
      <button type="button" aria-label="Previous page" title="Previous page" disabled={currentPage === 1} onClick={() => onPage(currentPage - 1)} className={button}><ChevronLeft aria-hidden="true" className="size-4" /></button>
      {pageButtons.map(page => <button key={page} type="button" aria-label={`Page ${page}`} aria-current={page === currentPage ? "page" : undefined} onClick={() => onPage(page)} className={`${button} ${page === currentPage ? "bg-[#203B82] text-white" : "hover:bg-slate-50"}`}>{page}</button>)}
      <button type="button" aria-label="Next page" title="Next page" disabled={currentPage === totalPages} onClick={() => onPage(currentPage + 1)} className={button}><ChevronRight aria-hidden="true" className="size-4" /></button>
    </nav>
  </div>;
}
