export default function FollowUpNotice({ notice, onDismiss }) {
  if (!notice) return null;
  const isError = notice.type === "error";
  return <div
    role={isError ? "alert" : "status"}
    className={`flex items-center justify-between gap-3 rounded-lg border p-4 text-sm ${isError ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}
  >
    <span>{notice.message}</span>
    <button type="button" onClick={onDismiss} aria-label="Dismiss follow-up notice" className="shrink-0 font-semibold underline">Dismiss</button>
  </div>;
}
