export default function OptionLabel({ children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-[#101C4A]/40">
      {children}
    </label>
  );
}
