import { NavLink, matchPath, useLocation } from "react-router-dom";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function SidebarNavigation({ items, wide, compact }) {
  const { pathname } = useLocation();
  return (
    <SidebarMenu className={wide || compact === "student" ? "gap-2" : "gap-3"}>
      {items.map(({ icon: Icon, label, path }) => {
        const end = path === "/" || path === "/dashboard";
        const isActive = Boolean(matchPath({ path, end }, pathname));
        return (
          <SidebarMenuItem key={path}>
            <SidebarMenuButton isActive={isActive} tooltip={label}
              render={<NavLink to={path} aria-label={label} end={end} />}
              className={cn(
                "gap-3 rounded-[6px] text-slate-100 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                wide ? "h-11 gap-4 px-5 text-[18px] font-semibold group-data-[collapsible=icon]:size-11!" : "h-9 px-4 text-[15px] font-bold group-data-[collapsible=icon]:size-10!",
                isActive && "bg-[#203b82] text-white hover:bg-[#203b82]",
              )}>
              <Icon className={`shrink-0 ${wide ? "size-[30px]" : "size-5"}`} strokeWidth={2.25} />
              <span className="group-data-[collapsible=icon]:hidden">{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export default SidebarNavigation;
