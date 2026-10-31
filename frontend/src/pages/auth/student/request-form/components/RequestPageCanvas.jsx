export default function RequestPageCanvas({ children }) {
  return (
    <div className="-mx-5 -my-7 min-h-[calc(100vh-70px)] bg-[#F5F6FA] px-5 py-8 transition-colors dark:bg-slate-950 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      {children}
    </div>
  );
}
