import { apiDownload, apiRequest, buildQuery } from "./client.js";
import { getCollection } from "./collections.js";
import { prepareClassInput, prepareProgramInput, prepareReportFilters } from "../lib/formInputs.js";
import { assertValidInputs } from "../lib/inputValidation.js";

export function getAdminDashboard() {
  return apiRequest("/admin/dashboard");
}

export function getAdminAuditLogs() {
  return getCollection("/admin/audit-logs");
}

export function getAdminUsers() {
  return apiRequest("/admin/users");
}

export function updateStaffRole(userId, role) {
  assertValidInputs({ role: ["instructor", "program_head", "administrator"].includes(role) ? "" : "Select an available staff role." });
  return apiRequest(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function getPrograms() {
  return apiRequest("/admin/programs");
}

export function createProgram(data) {
  return apiRequest("/admin/programs", {
    method: "POST",
    body: JSON.stringify(prepareProgramInput(data)),
  });
}

export function updateProgram(programId, data) {
  return apiRequest(`/admin/programs/${encodeURIComponent(programId)}`, {
    method: "PATCH",
    body: JSON.stringify(prepareProgramInput(data, true)),
  });
}

export function deleteProgram(programId) {
  return apiRequest(`/admin/programs/${encodeURIComponent(programId)}`, { method: "DELETE" });
}

export function getClasses() {
  return getCollection("/admin/classes");
}

export function createClass(data) {
  return apiRequest("/admin/classes", {
    method: "POST",
    body: JSON.stringify(prepareClassInput(data)),
  });
}

export function updateClass(classId, data) {
  return apiRequest(`/admin/classes/${encodeURIComponent(classId)}`, {
    method: "PATCH",
    body: JSON.stringify(prepareClassInput(data, true)),
  });
}

export async function deleteClass(classId) {
  const result = await apiRequest(`/admin/classes/${encodeURIComponent(classId)}`, { method: "DELETE" });
  if (result?.success === false) throw new Error(result.message || "The class could not be removed.");
  return result;
}

export function downloadReport(filters = {}) {
  return apiDownload(
    `/admin/reports/export${buildQuery(prepareReportFilters(filters))}`,
    "alrm-requests-report.xlsx",
  );
}
