import { apiRequest } from "./client.js";
import { getCollection, getCollectionPage } from "./collections.js";

export async function getAdminAssignments({
  signal,
  page = 1,
  perPage = 25,
  filters = {},
} = {}) {
  const classQuery = new URLSearchParams();
  if (filters.search?.trim()) classQuery.set("search", filters.search.trim());
  if (filters.programId) classQuery.set("program_id", filters.programId);
  const classPath = `/api/admin/classes${classQuery.toString() ? `?${classQuery}` : ""}`;
  const [classes, programs, users] = await Promise.all([
    getCollectionPage(classPath, { signal, page, perPage }),
    getCollection("/api/admin/programs", { signal }),
    getCollection("/api/admin/users?role=instructor&status=approved", {
      signal,
    }),
  ]);
  return {
    classes: classes.data,
    classesMeta: classes.meta,
    programs,
    instructors: users.filter(
      (user) => user.role === "instructor" && user.status === "approved",
    ),
  };
}

export function getAdminClass(classId) {
  return apiRequest(`/api/admin/classes/${encodeURIComponent(classId)}`);
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
