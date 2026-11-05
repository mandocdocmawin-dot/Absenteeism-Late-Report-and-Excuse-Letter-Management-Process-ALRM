import { primaryUserProgramId } from "../../../lib/userProgram.js";

export function studentCounts(users) {
  if (!Array.isArray(users)) return null;
  const seen = new Set();
  const result = { total: 0, byProgram: {}, unassigned: 0 };
  for (const user of users) {
    if (user.id == null || user.role !== "student" || seen.has(String(user.id))) continue;
    seen.add(String(user.id));
    result.total++;
    const programId = primaryUserProgramId(user);
    if (programId == null || programId === "") result.unassigned++;
    else result.byProgram[programId] = (result.byProgram[programId] || 0) + 1;
  }
  return result;
}
