import { primaryUserProgramId } from "../../../lib/userProgram.js";

// Count each instructor once; program heads qualify when they handle a class.
export function facultyCounts(users, classes) {
  if (!Array.isArray(users) || !Array.isArray(classes)) return null;
  const teachingIds = new Set(classes.map(item => item.instructor_id ?? item.instructor?.id).filter(id => id != null).map(String));
  const seen = new Set();
  const result = { total: 0, byProgram: {}, unassigned: 0 };
  for (const user of users) {
    const teaches = user.role === "instructor" || (user.role === "program_head" && teachingIds.has(String(user.id)));
    if (user.id == null || !teaches || seen.has(String(user.id))) continue;
    seen.add(String(user.id));
    result.total++;
    const programId = primaryUserProgramId(user);
    if (programId == null || programId === "") result.unassigned++;
    else result.byProgram[String(programId)] = (result.byProgram[String(programId)] || 0) + 1;
  }
  return result;
}
