import { decideRequest, getInstructorRequests } from "@/api/instructor";

export async function loadRequests() {
  const data = await getInstructorRequests();
  if (!Array.isArray(data)) throw new Error("The server returned an unexpected requests response.");
  return data.filter(record => record && record.id != null);
}

export function createDecisionGate() {
  let busy = false;
  const reviewed = new Set();
  return async (request, status) => {
    if (busy) throw new Error("A decision is already in progress.");
    if (reviewed.has(String(request.id))) throw new Error("This request has already been reviewed.");
    if (request.status !== "pending") throw new Error("Only pending requests can be reviewed.");
    if (!["approved", "invalid"].includes(status)) throw new Error("Unsupported decision.");
    busy = true;
    try {
      const fresh = await decideRequest(encodeURIComponent(request.id), status);
      if (!fresh || String(fresh.id) !== String(request.id) || fresh.status !== status) {
        throw new Error("The server did not confirm this decision. Reload requests before trying again.");
      }
      reviewed.add(String(request.id));
      return fresh;
    } finally {
      busy = false;
    }
  };
}
