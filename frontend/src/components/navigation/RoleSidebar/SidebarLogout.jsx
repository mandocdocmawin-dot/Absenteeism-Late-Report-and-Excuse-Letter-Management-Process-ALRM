import { LogOut } from "lucide-react";
import {
  AlertDialog, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import LogoutConfirmation from "./LogoutConfirmation";

function SidebarLogout({ onLogout, wide }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger aria-label="Logout" render={<SidebarMenuButton type="button" tooltip="Logout" className={`gap-3 rounded-[6px] text-slate-100 hover:bg-red-500/15 hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! ${wide ? "h-11 gap-4 px-5 text-[18px] font-semibold group-data-[collapsible=icon]:size-11!" : "h-9 px-4 text-[15px] font-bold group-data-[collapsible=icon]:size-10!"}`} />}>
        <LogOut className={`shrink-0 ${wide ? "size-[30px]" : "size-5"}`} strokeWidth={2.25} />
        <span className="group-data-[collapsible=icon]:hidden">Logout</span>
      </AlertDialogTrigger>
      <LogoutConfirmation onLogout={onLogout} />
    </AlertDialog>
  );
}

export default SidebarLogout;
