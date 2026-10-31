export default function SectionBox({ children, invalid = false, title, className = "" }) {
  return (
    <section
      className={[
        "grid gap-4 rounded-[10px] border bg-[#F7F8FC] p-4",
        invalid ? "border-red-500 ring-2 ring-red-100" : "border-slate-200",
        className,
      ].join(" ")}
    >
      {title && (
        <h2 className="text-sm font-black uppercase tracking-normal text-[#101C4A]">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
