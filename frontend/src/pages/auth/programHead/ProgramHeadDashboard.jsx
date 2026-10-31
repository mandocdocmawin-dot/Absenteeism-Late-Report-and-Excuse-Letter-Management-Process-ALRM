import { ErrorState } from "@/components/common/ErrorState";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import ProgramHeadOverview from "./ProgramHeadOverview";
import { FlaggedRecords, RequestRecords } from "./ProgramHeadRecords";
import { useProgramHeadRecords } from "./useProgramHeadRecords";

export function ProgramHeadDashboard({ view = "dashboard" }) {
  const needed = view === "flagged" ? ["flags"] : view === "requests" ? ["requests"] : ["dashboard", "flags", "requests"];
  const { dashboard, flags, requests, errors, resourceLoading, ready, refresh } = useProgramHeadRecords(needed);
  const loading = needed.some((key) => resourceLoading[key]);
  const waiting = needed.some((key) => resourceLoading[key] && !ready[key]);
  const failed = needed.some((key) => errors[key]);
  return <div className="space-y-5" data-slot={view === "dashboard" && loading ? "dashboard-skeleton" : undefined} data-variant={view === "dashboard" ? "program" : undefined}>
    {view === "dashboard" && loading ? <span role="status" aria-busy="true" className="sr-only">Loading program records</span> : null}
    {view !== "dashboard" && waiting ? <LoadingSkeleton variant="table" columns={4} label="Loading program records" /> : null}
    {view !== "dashboard" ? needed.filter((key) => errors[key]).map((key) => <ErrorState key={key} title={`Could not load ${key}`} message={errors[key]} />) : null}
    {view === "dashboard" ? <ProgramHeadOverview dashboard={dashboard} flags={flags} requests={requests} errors={errors} resourceLoading={resourceLoading} ready={ready} /> : null}
    {failed ? <button type="button" onClick={refresh} className="text-sm font-medium text-blue-800 underline dark:text-blue-300">Retry loading</button> : null}
    {view === "flagged" && !waiting && !errors.flags ? <FlaggedRecords flags={flags} onRefresh={refresh} /> : null}
    {view === "requests" && !waiting && !errors.requests ? <RequestRecords requests={requests} /> : null}
  </div>;
}
