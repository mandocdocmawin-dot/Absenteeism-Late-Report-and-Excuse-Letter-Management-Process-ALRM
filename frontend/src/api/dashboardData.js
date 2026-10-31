import { apiRequest, buildQuery } from "./client.js";
export { createProgram } from "./admin.js";

export function getAdminDashboard() {
  return apiRequest("/admin/dashboard");
}

export function getInstructorDashboard() {
  return apiRequest("/instructor/dashboard");
}

export function getProgramHeadRequests(status = "") {
  return apiRequest(`/program-head/requests${buildQuery({ status })}`);
}

export function getFlaggedStudents(status = "") {
  return apiRequest(`/program-head/students/flagged${buildQuery({ status })}`);
}

export function decideInstructorRequest(requestId, status) {
  return apiRequest(`/instructor/requests/${requestId}/decision`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateAdminUserStatus(userId, status) {
  return apiRequest(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
