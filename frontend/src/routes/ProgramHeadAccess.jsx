import { apiRequest } from "@/api/client";
import { useApiResource } from "@/hooks/useApiResource";
import HttpErrorPage from "@/pages/HttpErrorPage";

async function loadMembership() {
  try {
    const dashboard = await apiRequest("/program-head/dashboard");
    return Boolean(dashboard?.program_name);
  } catch (error) {
    if (error.status === 403) return false;
    throw error;
  }
}

// Program heads can retain an instructor role; the server verifies assignment.
export default function ProgramHeadAccess({ children }) {
  const { data, loading, error, reload } = useApiResource(loadMembership);
  if (loading) return <p role="status" className="p-8 text-sm text-slate-600">Checking program access…</p>;
  if (error) return <div role="alert" className="space-y-3 p-8 text-sm"><p>{error}</p><button type="button" onClick={reload} className="text-blue-800 underline">Retry program access</button></div>;
  return data ? children : <HttpErrorPage status={403} />;
}
