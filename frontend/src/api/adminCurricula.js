import { apiRequest, buildQuery } from "./client.js";
import { getCollection } from "./collections.js";

export function getCurricula(programId) {
  return getCollection(`/admin/curricula${buildQuery({ program_id: programId })}`);
}

export function getCurriculum(curriculumId) {
  return apiRequest(`/admin/curricula/${encodeURIComponent(curriculumId)}`);
}
