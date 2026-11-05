export const STAFF_ROLES = ["instructor", "program_head", "administrator"];
export const ROLE_LABELS = {
  student: "Student",
  instructor: "Instructor",
  program_head: "Program Head",
  administrator: "Administrator",
};

export function userDisplayId(user) {
  return user.school_id_number || (user.role === "student" ? "Unassigned" : user.faculty_id || user.employee_id || "Unavailable");
}

function headedPrograms(user, programs) {
  return user.id == null ? [] : programs.filter((program) => program.program_head_id != null && String(program.program_head_id) === String(user.id));
}

export function userDepartment(user, programs = []) {
  const program = user.program || (user.program_id != null && programs.find((item) => String(item.id) === String(user.program_id)));
  return program?.program_name || program?.name
    || headedPrograms(user, programs).map((item) => item.program_name || item.name).filter(Boolean).join(" / ")
    || (user.role === "student" ? "Unassigned" : "Unavailable");
}

export function userStatus(user) {
  return user.status === "inactive" ? "deactivated" : user.status;
}

export function userPermissions(user, currentUserId) {
  const editable = Boolean(user?.id && currentUserId && String(user.id) !== String(currentUserId));
  return {
    changeRole: editable && STAFF_ROLES.includes(user.role),
    changeStatus: editable && ["pending", "approved", "deactivated"].includes(userStatus(user)),
  };
}

export function studentYearSection(user) {
  const year = String(user.year_level || "").trim();
  const section = typeof user.section === "string" ? user.section.trim() : "";
  return [year, section].filter(Boolean).join(" / ") || "Unassigned";
}

export function filterUsers(users, { tab = "approved", status = "approved", role = "", program = "", year = "", search = "" } = {}, programs = []) {
  const query = search.trim().toLocaleLowerCase();
  const result = users.filter((user) => {
    if (userStatus(user) !== (tab === "waiting" ? "pending" : status)) return false;
    const headed = headedPrograms(user, programs);
    const matchesRole = role === "program_head"
      ? user.role === role || user.heads_program === true || user.headed_program_exists === true || headed.length > 0
      : user.role === role;
    if (role && !matchesRole) return false;
    if (role === "student" && year && (String(user.year_level || "").match(/^[1-4]/)?.[0] || "unassigned") !== year) return false;
    if (program && String(user.program_id || user.program?.id) !== String(program)
      && !headed.some((item) => String(item.id) === String(program))) return false;
    return !query || [user.name, user.email, userDisplayId(user), userDepartment(user, programs)]
      .some((value) => String(value || "").toLocaleLowerCase().includes(query));
  });
  return result.sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || "")) || String(a.id).localeCompare(String(b.id));
  });
}

export function paginateUsers(users, requestedPage = 1) {
  const pageCount = Math.max(1, Math.ceil(users.length / 10));
  const page = Math.max(1, Math.min(Math.trunc(Number(requestedPage)) || 1, pageCount));
  const start = (page - 1) * 10;
  return { rows: users.slice(start, start + 10), page, pageCount, start, total: users.length };
}

export function userErrorMessage(error) {
  const validation = Object.values(error?.errors || {}).flat().find(Boolean);
  return validation || error?.message || "The server could not complete this request.";
}
