const ROLE_ALIASES = {
  admin: "admin",
  administrator: "admin",
  program: "program",
  program_head: "program",
  programhead: "program",
  instructor: "instructor",
  student: "student",
};

export function normalizeRole(role) {
  const key = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return ROLE_ALIASES[key] || key || null;
}

export function roleMatches(role, allowedRoles = []) {
  const normalizedRole = normalizeRole(role);
  const normalizedAllowedRoles = allowedRoles.map((allowedRole) =>
    normalizeRole(allowedRole),
  );

  return normalizedAllowedRoles.includes(normalizedRole);
}
