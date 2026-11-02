import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { changeTeachingAssignment } from "@/api/adminAssignments";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { removeAssignmentDescription } from "./removeAssignmentText.js";

export default function RemoveAssignmentDialog({ row, instructors, onClose, onSaved }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await changeTeachingAssignment(row.id, {
        action: "remove",
        expected_revision: Number(row.assignment_revision || 0),
        reason: reason.trim(),
      });
      await onSaved([row.id], "Instructor assignment removed.");
    } catch (failure) {
      const messages = Object.values(failure.errors || {}).flat().filter(value => typeof value === "string");
      setError(messages.join(" ") || failure.message || "The assignment could not be removed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <AlertDialog open onOpenChange={open => { if (!open && !lock.current) onClose(); }}>
    <AlertDialogContent aria-busy={busy} className="rounded-[20px] bg-white">
      <AlertDialogTitle>Remove instructor assignment?</AlertDialogTitle>
      <AlertDialogDescription>{removeAssignmentDescription(row, instructors)}</AlertDialogDescription>
      <label htmlFor="remove-assignment-reason" className="grid gap-2 text-sm font-medium">Reason<textarea id="remove-assignment-reason" required maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><Button type="button" disabled={busy || !reason.trim()} onClick={remove} className="bg-[#e44343] text-white hover:bg-red-600">{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Removing…" : "Remove assignment"}</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
