import { normalizeRole } from "./roles";

const PROFILE_SETUP_PREFIX = "alrm_profile_setup:";

function setupKey(user) {
  return `${PROFILE_SETUP_PREFIX}${user?.id || user?.email || "unknown"}`;
}

function readLocalSetup(user) {
  try {
    const raw = localStorage.getItem(setupKey(user));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function studentNumberFrom(user, localSetup) {
  return (
    user?.student_number ||
    user?.studentNumber ||
    user?.school_id ||
    user?.schoolId ||
    user?.student_id_number ||
    user?.studentIdNumber ||
    localSetup?.student_number ||
    localSetup?.studentNumber ||
    ""
  );
}

export function getStoredProfileSetup(user) {
  return readLocalSetup(user);
}

export function storeProfileSetup(user, setup) {
  localStorage.setItem(
    setupKey(user),
    JSON.stringify({
      ...setup,
      completed_at: new Date().toISOString(),
    }),
  );
}

export function splitVerifiedName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || "",
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

export function isProfileSetupComplete(user) {
  if (!user) return false;

  const localSetup = readLocalSetup(user);
  const role = normalizeRole(user.role || localSetup?.role);
  const programId = user.program_id || user.programId || localSetup?.program_id;
  const yearLevel = user.year_level || user.yearLevel || localSetup?.year_level;
  const studentNumber = studentNumberFrom(user, localSetup);

  if (!hasValue(role)) return false;
  if (role === "admin") return true;
  if (role === "program" || role === "instructor") return hasValue(programId);
  if (role === "student") {
    return hasValue(programId) && hasValue(yearLevel) && hasValue(studentNumber);
  }

  return false;
}

export function needsProfileSetup(user) {
  return Boolean(user) && !isProfileSetupComplete(user);
}
