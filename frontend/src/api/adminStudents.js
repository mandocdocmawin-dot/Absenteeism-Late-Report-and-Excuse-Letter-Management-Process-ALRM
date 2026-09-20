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

function endpointMessage(status, path) {
  if (status === 404) {
    return `The endpoint ${path} could not be found.`;
  }

  return `Request failed with status ${status}.`;
}

async function expectJson(res, path) {
  const body = await readJson(res);

  if (!res.ok) {
    const message =
      validationMessage(body?.errors) ||
      body?.message ||
      endpointMessage(res.status, path);

    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body;
}

function payloadFrom(body) {
  return body?.data ?? body;
}

function listFrom(body) {
  const payload = payloadFrom(body);

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.students)) return payload.students;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
}

function itemFrom(body) {
  const payload = payloadFrom(body);

  return payload?.student ?? payload?.data ?? payload ?? null;
}

export async function getAdminStudents(filters = {}) {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.programId) params.set("program_id", filters.programId);
  if (filters.yearLevel) params.set("year_level", filters.yearLevel);

  const query = params.toString();
  const path = `/api/admin/students${query ? `?${query}` : ""}`;
  const res = await apiFetch(path);
  const body = await expectJson(res, path);

  return listFrom(body);
}

export async function getAdminStudent(studentId) {
  const path = `/api/admin/students/${studentId}`;
  const res = await apiFetch(path);
  const body = await expectJson(res, path);

  return itemFrom(body);
}
