import { updateStaffRole } from "./admin.js";
import { getCollection, getCollectionPage } from "./collections.js";
import { updateAdminUserStatus } from "./dashboardData.js";
import { STAFF_ROLES, userPermissions, userStatus } from "../pages/auth/admin/userManagementData.js";

export function getUserManagementUsers(options) {
  // apiRequest/getAdminUsers unwrap data, losing the bounded collection metadata.
  return getCollection("/api/admin/users", options);
}

export async function getPendingUserPreview(options) {
  const page = await getCollectionPage("/api/admin/users?status=pending", { ...options, page: 1, perPage: 4 });
  return page.data;
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
