import { apiFetch } from "./client";

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function validationMessage(errors) {
  if (!errors) return null;

  const firstField = Object.keys(errors)[0];
  const firstError = firstField ? errors[firstField]?.[0] : null;

  return firstError || null;
}

async function expectJson(res) {
  const body = await readJson(res);

  if (!res.ok) {
    const message =
      validationMessage(body?.errors) ||
      body?.message ||
      `Request failed with status ${res.status}.`;

    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body;
}

export async function getAdminPrograms() {
  const res = await apiFetch("/api/admin/programs");
  const body = await expectJson(res);

  return body?.data ?? [];
}

export async function createAdminUser(payload) {
  const res = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return expectJson(res);
}

export function createInstructor(form) {
  return createAdminUser({
    name: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    role: "instructor",
    program_id: Number(form.programId),
    status: form.status === "active" ? "approved" : "pending",
    employee_id: form.employeeId.trim(),
    subject_handled: form.subjectHandled.trim(),
  });
}

export function createStudent(form) {
  return createAdminUser({
    name: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    role: "student",
    program_id: Number(form.programId),
    status: form.status === "active" ? "approved" : "pending",
    student_id: form.studentId.trim(),
    year_level: form.yearLevel.trim(),
  });
}
