import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function updatedLabel(updatedAt) {
  if (!updatedAt) return "Not loaded yet";
  return `Last updated ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(updatedAt)}`;
}

export default function ResourceRefresh({ updatedAt, loading, onRefresh }) {
  return <div className="flex items-center gap-2 text-xs text-slate-500">
    <span>{updatedLabel(updatedAt)}</span>
    <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={onRefresh} className="h-8 gap-1.5 px-2 text-xs">
      <RefreshCw aria-hidden="true" className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
    </Button>
  </div>;
}
