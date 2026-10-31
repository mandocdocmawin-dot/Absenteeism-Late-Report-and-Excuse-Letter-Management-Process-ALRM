import { getStudentClasses, getStudentDashboard, getStudentRequests } from "@/api/student";
import { useApiResource } from "@/hooks/useApiResource";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isId = (value) => (typeof value === "string" && value.trim() !== "") || (typeof value === "number" && Number.isFinite(value));

async function loadList(load, label, valid) {
  const data = await load();
  if (!Array.isArray(data) || !data.every((item) => isRecord(item) && valid(item))) {
    throw new Error(`Your ${label} data is unavailable because the server returned an unexpected response.`);
  }
  return data;
}

function loadRequests() {
  return loadList(getStudentRequests, "request", (item) =>
    isId(item.id) && ["absence", "late"].includes(item.type) && typeof item.status === "string");
}

async function loadThreshold() {
  const dashboard = await getStudentDashboard();
  if (!isRecord(dashboard)) throw new Error("Your attendance threshold is unavailable because the server returned an unexpected response.");
  return isRecord(dashboard.threshold) ? dashboard.threshold : {};
}

function loadClasses() {
  return loadList(getStudentClasses, "class", (item) => isId(item.class_id)
    && [item.section, item.semester, item.school_year].every((value) => value == null || typeof value === "string" || typeof value === "number"));
}

export default function useStudentDashboardResources(userId) {
  const requests = useApiResource(loadRequests, userId, { cacheKey: `student:requests:${userId}` });
  const threshold = useApiResource(loadThreshold, userId, { cacheKey: `student:dashboard:${userId}` });
  const classes = useApiResource(loadClasses, userId, { cacheKey: `student:classes:${userId}` });
  return { requests, threshold, classes };
}
