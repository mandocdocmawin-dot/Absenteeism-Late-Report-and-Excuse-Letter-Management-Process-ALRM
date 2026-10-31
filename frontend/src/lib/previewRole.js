import { normalizeRole } from "./roles.js";

export const PREVIEW_ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "instructor", label: "Instructor" },
  { value: "program", label: "Program Head" },
  { value: "admin", label: "Administrator" },
];

export function previewRoleLabel(role) {
  return PREVIEW_ROLE_OPTIONS.find((option) => option.value === normalizeRole(role))?.label || "User";
}

export function canPreviewRole(user) {
  return normalizeRole(user?.role) === "student" &&
    String(user?.email || "").toLowerCase().endsWith("@student.laverdad.edu.ph");
}

export function getPreviewRole(user) {
  const actualRole = normalizeRole(user?.role);
  if (!canPreviewRole(user)) return actualRole;

  try {
    const storedRole = normalizeRole(localStorage.getItem(`alrm_preview_role:${user.id}`));
    return PREVIEW_ROLE_OPTIONS.some((option) => option.value === storedRole)
      ? storedRole
      : actualRole;
  } catch {
    return actualRole;
  }
}
