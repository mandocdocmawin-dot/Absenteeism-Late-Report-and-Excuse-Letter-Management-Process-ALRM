import { Tabs } from "@base-ui/react/tabs";

const types = [{ value: "absence", label: "Absent" }, { value: "late", label: "Late" }];

export default function RecordTypeTabs({ value, onValueChange, children }) {
  return <Tabs.Root value={value} onValueChange={onValueChange} className="grid min-w-0 gap-4">
    <Tabs.List aria-label="Record type" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
      {types.map(type => <Tabs.Tab key={type.value} value={type.value} className="min-h-10 min-w-24 border-b-2 border-transparent px-5 py-2 text-sm font-bold text-slate-500 hover:text-[#173D83] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 data-active:border-[#173D83] data-active:text-[#173D83] dark:text-slate-400 dark:hover:text-blue-300 dark:data-active:border-blue-400 dark:data-active:text-blue-300">{type.label}</Tabs.Tab>)}
    </Tabs.List>
    {types.map(type => <Tabs.Panel key={type.value} value={type.value} className="min-w-0 outline-none">
      {value === type.value ? children : null}
    </Tabs.Panel>)}
  </Tabs.Root>;
}
