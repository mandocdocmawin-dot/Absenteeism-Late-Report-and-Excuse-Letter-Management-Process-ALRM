import { useState } from "react";
import { Funnel, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function RadioFilterGroup({ name, label, value, options, disabled, onChange }) {
  return <fieldset disabled={disabled} className="grid min-w-0 gap-1 border-0 p-0">
    <legend className="mb-1.5 text-sm font-semibold text-slate-900">{label}</legend>
    {options.map(option => <label key={option.value} className="flex min-h-7 items-start gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 has-disabled:cursor-not-allowed has-disabled:opacity-50">
      <input type="radio" name={`user-filter-${name}`} value={option.value} checked={String(value || "") === option.value} disabled={option.disabled} onChange={() => onChange(name, option.value)} className="mt-1 shrink-0 accent-[#203B82]" />
      <span className="min-w-0 break-words">{option.label}</span>
    </label>)}
  </fieldset>;
}

export default function FilterMenu({ children, chips = [], disabled, onChange, label = "Filter users" }) {
  const [open, setOpen] = useState(false);
  return <div aria-label={label} className="flex flex-wrap items-center gap-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger type="button" aria-label={label} title={label} disabled={disabled} className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172f6b] disabled:opacity-50">
        <Funnel aria-hidden="true" className="size-3.5" />Filter<Plus aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[min(20rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-lg bg-white p-0 text-slate-950 shadow-lg ring-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <PopoverTitle className="text-sm font-semibold">Filters</PopoverTitle>
          <button type="button" aria-label="Close filters" onClick={() => setOpen(false)} className="flex size-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#172f6b]"><X aria-hidden="true" className="size-4" /></button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-3">{children}</div>
      </PopoverContent>
    </Popover>
    {chips.map(({ name, label: chipLabel, reset = "", Icon }) => <span key={name} className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white pl-2 pr-1 text-xs text-slate-700">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" /><span className="max-w-52 truncate" title={chipLabel}>{chipLabel}</span>
      <button type="button" aria-label={`Remove ${name} filter`} disabled={disabled} onClick={() => onChange(name, reset)} className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#172f6b] disabled:opacity-50"><X aria-hidden="true" className="size-3.5" /></button>
    </span>)}
  </div>;
}
