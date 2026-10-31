import { apiDownload, apiRequest, buildQuery } from "./client.js";
import { getCollection } from "./collections.js";

export function getProgramHeadDashboard() {
  return apiRequest("/program-head/dashboard");
}

export function getFlaggedStudents(filters = {}) {
  return apiRequest(`/program-head/students/flagged${buildQuery(filters)}`);
}

export function getProgramHeadRequests(filters = {}) {
  return getCollection(`/program-head/requests${buildQuery(filters)}`);
}

export function getProgramHeadAuditLogs() {
  return getCollection("/program-head/audit-logs");
}

export function resolveProgramHeadFlag(flagId) {
  return apiRequest(`/program-head/followup-flags/${encodeURIComponent(flagId)}/resolve`, { method: "PATCH" });
}

export function downloadProgramHeadReport({ type, from, to }) {
  const query = buildQuery({ report_type: type, date_from: from, date_to: to });
  return apiDownload(`/program-head/reports/export${query}`, `program-${type}-report.csv`);
}
