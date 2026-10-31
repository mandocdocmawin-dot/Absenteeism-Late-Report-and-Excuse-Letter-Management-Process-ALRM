import { AlertCircle } from "lucide-react";

export function ErrorState({ title = "Something went wrong", message }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {message ? <p className="mt-1 text-sm text-rose-700">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
