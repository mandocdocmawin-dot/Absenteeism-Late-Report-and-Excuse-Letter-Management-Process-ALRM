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
  if (Array.isArray(payload?.programs)) return payload.programs;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
}

export async function getProfileSetupPrograms() {
  const primary = await apiFetch("/api/admin/programs");

  if (primary.ok) {
    return listFrom(await primary.json());
  }

  if (![403, 404, 405].includes(primary.status)) {
    await expectJson(primary);
  }

  const fallback = await apiFetch("/api/test/programs");
  const body = await expectJson(fallback);

  return listFrom(body);
}

export async function saveProfileSetup(payload) {
  const res = await apiFetch("/api/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  if ([404, 405].includes(res.status)) {
    return {
      savedToBackend: false,
      message:
        "The backend does not currently expose a self-profile update route.",
    };
  }

  const body = await expectJson(res);

  return {
    savedToBackend: true,
    body,
  };
}
