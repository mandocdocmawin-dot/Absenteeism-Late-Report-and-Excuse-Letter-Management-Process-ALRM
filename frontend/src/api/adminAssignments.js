import { apiRequest } from "./client.js";
import { getCollection } from "./collections.js";

export async function getAdminAssignments({ signal } = {}) {
  const [classes, programs, users] = await Promise.all([
    getCollection("/api/admin/classes", { signal, perPage: 50 }),
    getCollection("/api/admin/programs", { signal }),
    getCollection("/api/admin/users?role=instructor&status=approved", { signal }),
  ]);
  return {
    classes, programs,
    instructors: users.filter(user => user.role === "instructor" && user.status === "approved"),
  };
}

export function getAdminClass(classId) {
  return apiRequest(`/api/admin/classes/${encodeURIComponent(classId)}`);
}

export async function setClassInstructor(classId, instructorId) {
  const id = String(classId || "").trim();
  const normalizedInstructorId = instructorId === null ? null : String(instructorId || "").trim();
  if (!id) throw new Error("Select an existing class.");
  if (normalizedInstructorId === "") throw new Error("Select an approved instructor.");

  const updated = await apiRequest(`/api/admin/classes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ instructor_id: normalizedInstructorId }),
  });
  const confirmedInstructorId = updated?.instructor_id ?? null;
  if (String(updated?.id) !== id || confirmedInstructorId !== normalizedInstructorId) {
    throw new Error("The server did not confirm the instructor assignment. Reload the page before trying again.");
  }
  return updated;
}

export function assignClassInstructor(classId, instructorId) {
  if (instructorId === null) throw new Error("Select an approved instructor.");
  return setClassInstructor(classId, instructorId);
}
