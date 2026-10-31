import { Inbox } from "lucide-react";

export function EmptyState({ title = "Nothing here yet", message }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center">
      <Inbox className="mb-3 size-7 text-slate-400" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p> : null}
    </div>
  );
}
