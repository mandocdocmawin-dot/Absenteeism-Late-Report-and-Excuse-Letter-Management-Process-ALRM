import { useSidebar } from "@/components/ui/sidebar";
import lvLogo from "@/assets/lv-logo-sidebar.webp";

function SidebarBrand({ wide = false }) {
  const { toggleSidebar, hoverEnabled } = useSidebar();

  return (
    <button data-slot="sidebar-brand" type="button" aria-label="Toggle sidebar"
      onClick={(event) => { if (!hoverEnabled || event.detail === 0) toggleSidebar(); }}
      onPointerUp={hoverEnabled ? (event) => { if (event.pointerType === "touch") toggleSidebar(); } : undefined}
      className={`flex w-full items-center justify-center gap-3 text-white hover:bg-white/5 hover:text-white group-data-[collapsible=icon]:px-0 ${wide ? "h-[89px] px-5" : "h-[70px] px-4"}`}>
      <img src={lvLogo} alt="ALRM System logo" width="48" height="48" loading="eager" fetchPriority="high" className="size-12 shrink-0 object-contain" />
      <span className="whitespace-nowrap text-[20px] font-semibold leading-none tracking-normal group-data-[collapsible=icon]:hidden">ALRM SYSTEM</span>
    </button>
  );
}

export default SidebarBrand;
