import { apiFetch, ApiError, buildQuery } from "./client.js";
import { normalizeReportRows } from "../pages/auth/admin/reports/reportData.js";
import { prepareReportFilters } from "../lib/formInputs.js";

export async function generateAdminReport(filters = {}, options = {}) {
  const snapshot = prepareReportFilters(filters);
  const response = await apiFetch(`/api/admin/reports/export${buildQuery(snapshot)}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.message || "The report could not be generated.", response.status, payload?.errors);
  }
  const blob = await response.blob();
  if (blob.size > 32 * 1024 * 1024) throw new Error("The report is too large to preview. Narrow the filters and try again.");
  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error("The server did not return an Excel report.");
  // Version 6 reads locally without blob workers or relaxing the app's CSP.
  const { default: readXlsxFile } = await import("read-excel-file");
  const rows = normalizeReportRows(await readXlsxFile(blob));
  if (rows.length > 5000) throw new Error("The report exceeds the preview limit. Narrow the filters and try again.");
  return { rows, blob, filters: snapshot };
}

export function downloadGeneratedReport(report) {
  const url = URL.createObjectURL(report.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "alrm-requests-report.xlsx";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
