import { apiRequest } from "./client.js";

export function getAcademicPeriod(options = {}) {
  return apiRequest("/api/academic-period", options);
}

export async function updateAcademicPeriod(payload) {
  const updated = await apiRequest("/api/admin/academic-period", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (updated?.semester !== payload.semester || updated?.school_year !== payload.school_year) {
    throw new Error("The server did not confirm the academic period update. Reload before trying again.");
  }
  return updated;
}
