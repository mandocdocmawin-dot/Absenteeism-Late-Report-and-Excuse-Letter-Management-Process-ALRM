import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminUserForm from "./AdminUserForm";

function openDialog(element) {
  if (element && !element.open) element.showModal();
}

export default function AddUserDialog({ onClose, onCreated }) {
  return <dialog
    ref={openDialog}
    id="add-user-dialog"
    aria-modal="true"
    aria-labelledby="add-user-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={(event) => { if (!event.currentTarget.open) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-[16px] border border-slate-200 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-black/40 sm:p-7"
  >
    <div className="mb-1 flex justify-end">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Close Add User" onClick={onClose}><X aria-hidden="true" /></Button>
    </div>
    <AdminUserForm embedded onCancel={onClose} onCreated={onCreated} />
  </dialog>;
}
