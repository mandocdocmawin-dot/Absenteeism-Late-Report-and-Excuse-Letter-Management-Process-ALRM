import { X } from "lucide-react";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, studentYearSection, userDepartment, userDisplayId, userPermissions, userStatus } from "./userManagementData.js";

function openDialog(element) {
  if (!element.open) element.showModal();
  return () => { if (element.open) element.close(); };
}

export default function ManagedAccountDialog({ user, currentUserId, programs, working, actionError, onChange, onClose }) {
  const permissions = userPermissions(user, currentUserId);
  const status = userStatus(user);
  function close() {
    if (!working) onClose();
  }

  return (
    <dialog ref={openDialog} id="managed-account" aria-modal="true" aria-labelledby="managed-account-title" aria-busy={working}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={(event) => { if (!event.currentTarget.open) close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl space-y-5 overflow-y-auto rounded-[20px] border border-slate-200 bg-white p-5 text-slate-950 shadow-xl backdrop:bg-black/40 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="managed-account-title" className="text-lg font-semibold">Account details</h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close account details" disabled={working} onClick={close}><X aria-hidden="true" /></Button>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {[["Name", user.name || "Unnamed user"], ["ID", userDisplayId(user)], [user.role === "student" ? "Program" : "Department", userDepartment(user, programs)], ["Email", user.email || "Unavailable"], ["Role", ROLE_LABELS[user.role] || "Role unavailable"], ["Status", status || "Status unavailable"], ...(user.role === "student" ? [["Year/Section", studentYearSection(user)]] : [])].map(([label, value]) => (
          <div key={label} className="min-w-0"><dt className="text-slate-600">{label}</dt><dd className="break-words font-medium">{value}</dd></div>
        ))}
      </dl>
      {String(user.id) === String(currentUserId) && <p className="text-sm text-slate-600">You cannot change your own role or account status.</p>}
      {status === "pending" && <p className="text-sm text-slate-600">{user.role === "student" ? "The server checks whether this student account can be approved." : "Pre-registered accounts activate on their first Google sign-in. The server checks whether this account can be approved."}</p>}
      {actionError && <div role="alert"><ErrorState title="Account change failed" message={actionError} /></div>}
      <footer className="flex flex-wrap items-center justify-start gap-3 border-t border-slate-200 pt-5">
        {permissions.changeStatus && <Button type="button" variant={status === "approved" ? "destructive" : "outline"} className={`h-10 rounded-lg px-4 ${status === "approved" ? "bg-[#e44343] font-semibold text-white hover:bg-red-600" : ""}`} disabled={working} onClick={() => onChange("status", status === "approved" ? "deactivated" : "approved")}>
          {status === "pending" ? "Approve" : status === "approved" ? "Deactivate Account" : "Reactivate Account"}
        </Button>}
        {working && <span role="status" className="text-sm text-slate-600">Saving account change…</span>}
      </footer>
    </dialog>
  );
}
