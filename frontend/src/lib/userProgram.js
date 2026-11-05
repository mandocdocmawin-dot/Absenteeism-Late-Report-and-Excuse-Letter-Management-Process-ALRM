export function primaryUserProgramId(user) {
  const primary = user.program_id ?? user.program?.id;
  if (primary != null && primary !== "") return String(primary);
  const memberships = [...new Set((Array.isArray(user.programs) ? user.programs : [])
    .map(program => program?.id).filter(id => id != null && id !== "").map(String))];
  return memberships.length === 1 ? memberships[0] : null;
}
