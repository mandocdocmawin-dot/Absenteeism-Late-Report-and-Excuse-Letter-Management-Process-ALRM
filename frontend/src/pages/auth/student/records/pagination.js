const RECORDS_PER_PAGE = 10;

export function paginateRecords(records, page = 1) {
  const totalPages = Math.max(1, Math.ceil(records.length / RECORDS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const firstRecord = (currentPage - 1) * RECORDS_PER_PAGE;
  const firstPageButton = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return {
    totalPages, currentPage, firstRecord,
    pageRecords: records.slice(firstRecord, firstRecord + RECORDS_PER_PAGE),
    pageButtons: Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageButton + index),
  };
}
