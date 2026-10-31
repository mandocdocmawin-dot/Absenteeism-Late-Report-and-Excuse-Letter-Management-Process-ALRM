import { apiRequest } from "./client.js";

export function getStudentClasses() {
  return apiRequest("/classes");
}

export function getStudentRequests() {
  return apiRequest("/requests");
}

export function getStudentAttendanceSummary() {
  return apiRequest("/attendance/summary");
}

export function getStudentDashboard() {
  return apiRequest("/dashboard");
}

export { createStudentRequest } from "./studentRequests.js";
