import { getStudentRequests } from "../../../../api/student.js";
import { recentRequestActivity } from "../dashboard/studentOverview.js";

export async function loadRequestActivity() {
  const requests = await getStudentRequests();
  if (!Array.isArray(requests)) throw new Error("The server returned an unexpected request activity response.");
  return recentRequestActivity(requests, Infinity);
}
