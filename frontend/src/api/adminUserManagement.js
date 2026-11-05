import { updateStaffRole } from "./admin.js";
import { getCollection, getCollectionPage } from "./collections.js";
import { updateAdminUserStatus } from "./dashboardData.js";
import { STAFF_ROLES, userPermissions, userStatus } from "../pages/auth/admin/userManagementData.js";

export function getUserManagementUsers(options) {
  // apiRequest/getAdminUsers unwrap data, losing the bounded collection metadata.
  return getCollection("/api/admin/users", options);
}

const yearLevels = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

export function userManagementPageCacheKey(page, filters = {}) {
  const normalized = {
    search: String(filters.search || "").trim(),
    status: filters.status || "",
    role: filters.role || "",
    program: filters.program || "",
    year: filters.year || "",
  };
  return `admin:user-management:users:${page}:${JSON.stringify(normalized)}`;
}

export function getUserManagementUsersPage({ signal, page = 1, perPage = 10, filters = {} } = {}) {
  if (filters.year === "unassigned") {
    throw new Error("Filtering users with an unassigned year is not supported by the server.");
  }
  const query = new URLSearchParams();
  const search = String(filters.search || "").trim();
  if (search) query.set("search", search);
  if (filters.status) query.set("status", filters.status);
  if (filters.role) query.set("role", filters.role);
  if (filters.program) query.set("program_id", filters.program);
  if (filters.year) query.set("year_level", yearLevels[filters.year] || filters.year);
  const endpoint = query.size ? `/api/admin/users?${query}` : "/api/admin/users";
  return getCollectionPage(endpoint, { signal, page, perPage, allowOutOfRange: true });
}

export function getUserManagementPrograms(options) {
  return getCollection("/api/admin/programs", options);
}

export async function changeManagedUser(user, currentUserId, field, value) {
  const permissions = userPermissions(user, currentUserId);
  const allowed = field === "role"
    ? permissions.changeRole && STAFF_ROLES.includes(value) && value !== user.role
    : field === "status" && permissions.changeStatus && value !== userStatus(user)
      && ["approved", "deactivated"].includes(value);
  if (!allowed) throw new Error("This account change is not available.");

  const response = await (field === "role"
    ? updateStaffRole(user.id, value)
    : updateAdminUserStatus(user.id, value));
  if (!response || String(response.id) !== String(user.id) || response[field] !== value || response.success === false) {
    throw new Error("The server did not confirm the account change. Refresh the list before trying again.");
  }
  return response;
}
