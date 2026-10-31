import { apiFetch } from "./client.js";
import { prepareAccountInput } from "../lib/formInputs.js";

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
    error.fieldErrors = body?.errors || null;
    error.errors = body?.errors || null;
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
    body: JSON.stringify(prepareAccountInput(payload)),
  });

  return expectJson(res);
}

export function createInstructor(form) {
  return createAdminUser({ ...form, role: "instructor" });
}

export function createStudent(form) {
  return createAdminUser({ ...form, role: "student" });
}
