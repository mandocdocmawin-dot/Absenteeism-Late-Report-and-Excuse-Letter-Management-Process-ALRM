import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function UploadProgress({ label = "Uploading file...", className, ...props }) {
  return <div role="status" aria-live="polite" aria-busy="true" className={cn("flex items-center gap-2 text-sm text-slate-600", className)} {...props}>
    <Spinner role={undefined} aria-label={undefined} aria-hidden="true" className="size-6 shrink-0 text-blue-700" />
    <span>{label}</span>
  </div>;
}
