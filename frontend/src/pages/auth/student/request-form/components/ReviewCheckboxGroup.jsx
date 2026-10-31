import ErrorText from "./ErrorText";

export default function ReviewCheckboxGroup({ name, label, options, selected, onToggle, error }) {
  return <fieldset aria-invalid={Boolean(error)} aria-describedby={error ? `review-${name}-error` : undefined} className={`grid min-w-0 gap-2 rounded-md border p-3 sm:col-span-2 ${error ? "border-red-500" : "border-slate-200 dark:border-slate-700"}`}>
    <legend className="px-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</legend>
    {options.map((option) => <label key={option} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input type="checkbox" name={name} checked={selected.includes(option)} onChange={() => onToggle(name, option)} className="mt-1 accent-[#101C4A]" />
      {option}
    </label>)}
    {error && <div id={`review-${name}-error`} role="alert"><ErrorText message={error} /></div>}
  </fieldset>;
}
