import { useRef } from "react";
import { DoorOpen } from "lucide-react";
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function LogoutConfirmationBody({ onLogout, cancelRef }) {
  return <>
    <div className="grid justify-items-center gap-3 text-center">
      <div className="mb-1 flex size-18 items-center justify-center rounded-full bg-red-50 text-[#e44343]">
        <DoorOpen aria-hidden="true" className="size-8" strokeWidth={2.5} />
      </div>
      <AlertDialogTitle className="text-xl font-bold text-slate-950">Already leaving?</AlertDialogTitle>
      <AlertDialogDescription className="text-sm leading-5 text-slate-500">You can sign back in anytime with your LV email account to access your dashboard.</AlertDialogDescription>
    </div>
    <div className="flex flex-col gap-2">
      <AlertDialogAction type="button" onClick={onLogout} className="h-12 w-full rounded-full bg-[#e44343] text-base font-bold text-white hover:bg-red-600">Yes, Log out</AlertDialogAction>
      <AlertDialogCancel ref={cancelRef} variant="ghost" className="h-11 w-full rounded-full text-base font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800">No, I am staying</AlertDialogCancel>
    </div>
  </>;
}

export default function LogoutConfirmation({ onLogout }) {
  const cancelRef = useRef(null);
  return <AlertDialogContent size="sm" initialFocus={cancelRef} className="w-[calc(100%-2rem)] max-w-[360px]! gap-6 rounded-[24px] border-slate-200 bg-white p-6 text-slate-950 shadow-2xl ring-0">
    <LogoutConfirmationBody onLogout={onLogout} cancelRef={cancelRef} />
  </AlertDialogContent>;
}
