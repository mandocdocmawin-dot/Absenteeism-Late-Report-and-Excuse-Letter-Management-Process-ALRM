export default function PendingRequestsList({ classRow, count: countProp, error = "", loading = false, requests = [] }) {
  if (!classRow) return null;
  const count = countProp ?? (requests.length || Number(classRow.pending_requests_count || 0));
  if (!count && !error && !loading) return null;
  return <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <p className="font-semibold">{count || "Pending"} pending {count === 1 ? "request must" : "requests must"} be resolved first for {classRow.subject_name || "this class"}.</p>
    {loading && <p className="mt-1 text-xs">Loading blocking requests…</p>}
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    {requests.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
      {requests.map(request => <li key={request.id}>{request.enrollment?.student?.name || request.student?.name || "Student"} — {request.type === "late" ? "Late request" : "Absence request"}</li>)}
    </ul>}
  </section>;
}
