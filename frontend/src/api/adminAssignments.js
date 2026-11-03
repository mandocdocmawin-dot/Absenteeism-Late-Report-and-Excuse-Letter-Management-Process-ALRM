import { apiRequest } from "./client.js";
import { getCollection, getCollectionPage } from "./collections.js";

export function getAdminClassesPage({
  signal,
  page = 1,
  perPage = 25,
  filters = {},
} = {}) {
  const classQuery = new URLSearchParams();
  if (filters.search?.trim()) classQuery.set("search", filters.search.trim());
  if (filters.programId) classQuery.set("program_id", filters.programId);
  const classPath = `/api/admin/classes${classQuery.toString() ? `?${classQuery}` : ""}`;
  return getCollectionPage(classPath, { signal, page, perPage });
}

export function getAdminPrograms({ signal } = {}) {
  return getCollection("/api/admin/programs", { signal });
}

export async function getApprovedInstructors({ signal } = {}) {
  const users = await getCollection(
    "/api/admin/users?role=instructor&status=approved",
    { signal },
  );
  return users.filter(
    (user) => user.role === "instructor" && user.status === "approved",
  );
}

export async function getAdminAssignments(options = {}) {
  const [classes, programs, instructors] = await Promise.all([
    getAdminClassesPage(options),
    getAdminPrograms(options),
    getApprovedInstructors(options),
  ]);
  return {
    classes: classes.data,
    classesMeta: classes.meta,
    programs,
    instructors,
  };
}

export function getAdminAssignmentCandidates({ signal } = {}) {
  return getCollection("/api/admin/classes", { signal });
}

export async function changeTeachingAssignment(classId, payload) {
  const id = String(classId || "").trim();
  if (!id) throw new Error("Select an existing class.");

  const result = await apiRequest(
    `/api/admin/classes/${encodeURIComponent(id)}/assignment`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!Array.isArray(result?.classes)
    || !result.classes.some((item) => String(item?.id) === id)) {
    throw new Error("The server did not confirm the teaching assignment change. Reload the page before trying again.");
  }
  return result;
}
