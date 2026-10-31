import { apiRequest } from "./client.js";

export function getInstructorDashboard() {
  return apiRequest("/instructor/dashboard");
}

export function getInstructorRequests() {
  return apiRequest("/instructor/requests");
}

export async function getInstructorClassRecords() {
  const data = await getInstructorRequests();
  if (!Array.isArray(data)) throw new Error("The server returned an unexpected class records response.");
  return data;
}

export function decideRequest(requestId, status) {
  return apiRequest(`/instructor/requests/${requestId}/decision`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
