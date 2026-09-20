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

function listFrom(body) {
  const payload = body?.data ?? body;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.classes)) return payload.classes;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
}

export async function getStudentClasses() {
  const res = await apiFetch("/api/classes");
  const body = await expectJson(res);

  return listFrom(body);
}

export async function createStudentRequest(payload) {
  const res = await apiFetch("/api/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return expectJson(res);
}
