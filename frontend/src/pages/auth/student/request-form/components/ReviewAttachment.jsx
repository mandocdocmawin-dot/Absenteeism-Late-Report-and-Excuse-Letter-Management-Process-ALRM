import ErrorText from "./ErrorText";

export default function ReviewAttachment({ file, error }) {
  return <div className="grid min-w-0 gap-2 sm:col-span-2">
    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Supporting document</p>
    <p className="break-words text-sm text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">{file?.name || "No file selected"}</p>
    {error && <div id="review-evidence-error" role="alert"><ErrorText message={error} /></div>}
  </div>;
}
