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

export function dashboardAttendance(dashboard) {
  const subjects = dashboard?.subject_thresholds;
  if (!isRecord(dashboard?.threshold) || !Array.isArray(subjects)
    || !subjects.every((subject) => isRecord(subject) && isId(subject.class_id)
      && typeof subject.subject_name === "string" && typeof subject.status === "string")) {
    throw new Error("Your attendance threshold is unavailable because the server returned an unexpected response.");
  }
  return { ...dashboard.threshold, subject_thresholds: subjects };
}

async function loadThreshold() {
  return dashboardAttendance(await getStudentDashboard());
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
