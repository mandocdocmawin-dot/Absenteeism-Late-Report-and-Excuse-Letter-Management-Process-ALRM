import { apiFetch } from "./client.js";
import { prepareRequestInput } from "../pages/auth/student/request-form/requestInputs.js";

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
    error.validationErrors = body?.errors || {};
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

export async function getStudentClasses({ signal } = {}) {
  const res = await apiFetch("/api/classes", { signal });
  const body = await expectJson(res);

  return listFrom(body);
}

export async function createStudentRequest(payload) {
  const res = await apiFetch("/api/requests", {
    method: "POST",
    body: JSON.stringify(prepareRequestInput(payload)),
  });

  return expectJson(res);
}

export async function getStudentRequest(requestId, options = {}) {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(requestId)}`, options);
  const body = await expectJson(res);
  return body?.data ?? body;
}

export async function updateStudentRequest(requestId, payload) {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: JSON.stringify(prepareRequestInput(payload, true)),
  });
  const body = await expectJson(res);
  return body?.data ?? body;
}

export async function followUpStudentRequest(requestId, { signal } = {}) {
  const res = await apiFetch(`/api/requests/${encodeURIComponent(requestId)}/follow-up`, {
    method: "POST",
    signal,
  });
  const body = await expectJson(res);
  if (body?.success !== true || !body?.data?.id) {
    throw new Error(typeof body?.message === "string" ? body.message : "The server did not confirm your follow-up. Please check your request before trying again.");
  }
  return body;
}

// NEW: i-upload ang attachment. Ibinabalik ang { path (attachment ID), name, type }
export async function uploadEvidence(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch("/api/requests/evidence", {
    method: "POST",
    body: formData,
  });
  const body = await expectJson(res);

  return body?.data;
}

// NEW: buksan ang attachment ng isang request (para sa instructor/program head/admin page).
// Kailangan ng Authorization header, kaya hindi pwede ang plain link.
export async function openEvidence(requestId) {
  const popup = window.open("", "_blank"); // buksan agad para hindi ma-block ng browser
  if (popup) popup.opener = null;

  try {
    const res = await apiFetch(`/api/requests/${requestId}/evidence`);
    if (!res.ok) throw new Error("No attachment available.");

    const file = await res.blob();
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      throw new Error("Unsupported attachment type.");
    }
    const url = URL.createObjectURL(file);
    // Blob navigation does not carry the response's Content-Disposition header.
    try {
      if (file.type === "application/pdf") {
        popup?.close();
        const link = document.createElement("a");
        link.href = url;
        link.download = "attachment.pdf";
        link.click();
      } else {
        if (!popup || popup.closed) throw new Error("Allow popups to view this image.");
        popup.location.href = url;
      }
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  } catch (error) {
    popup?.close();
    throw error;
  }
}
