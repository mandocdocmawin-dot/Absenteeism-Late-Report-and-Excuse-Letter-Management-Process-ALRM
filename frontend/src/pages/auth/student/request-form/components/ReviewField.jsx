import { Input } from "@/components/ui/input";
import ErrorText from "./ErrorText";
import { controlClass } from "../utils";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import ContactNumberInput from "./ContactNumberInput";

export default function ReviewField({ name, label, value, onChange, error, options, multiline, wide, loading, phone, ...props }) {
  const id = `review-${name}`;
  const shared = {
    ...props, id, name, value: value ?? "",
    onChange: onChange ? (event) => onChange(event.target.value) : undefined,
    "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined,
    className: controlClass(error, "w-full min-w-0 rounded-md border px-3 py-2 text-sm text-slate-800 focus-visible:outline-blue-600 dark:bg-slate-950 dark:text-slate-100"),
  };
  return <div className={`grid min-w-0 content-start gap-2 ${wide ? "sm:col-span-2" : ""}`}>
    <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
    {loading ? <LoadingSkeleton variant="field" label={`Loading ${label.toLowerCase()}...`} /> : options ? <select {...shared}>
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : phone ? <ContactNumberInput {...props} id={id} value={value} onChange={onChange} error={error} aria-describedby={shared["aria-describedby"]} /> : multiline ? <textarea {...shared} rows={4} /> : <Input {...shared} />}
    {error && <div id={`${id}-error`} role="alert"><ErrorText message={error} /></div>}
  </div>;
}
