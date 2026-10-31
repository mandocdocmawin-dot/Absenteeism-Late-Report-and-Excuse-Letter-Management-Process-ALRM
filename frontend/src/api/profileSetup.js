import { apiFetch } from "./client.js";
import { prepareProfileInput } from "../lib/formInputs.js";

// Kumpirmado sa route:list: GET api/complete-profile/programs -> Auth\ProfileController@programs
export const PROGRAMS_ENDPOINT = "/api/complete-profile/programs";
export const COMPLETE_PROFILE_ENDPOINT = "/api/complete-profile";

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
    error.fieldErrors = body?.errors || null; // { field: ["msg"] } mula sa 422
    throw error;
  }

  return body;
}

function listFrom(body) {
  const payload = body?.data ?? body;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.programs)) return payload.programs;

  return [];
}

export async function getProfileSetupPrograms() {
  // Walang fallback sa /api/test/programs: pekeng ID ang pinagmulan ng bug.
  const body = await expectJson(await apiFetch(PROGRAMS_ENDPOINT));
  const programs = listFrom(body);

  if (programs.length === 0) {
    throw new Error(
      "The program list is empty. Please contact an administrator.",
    );
  }

  return programs;
}

/**
 * POST /api/complete-profile
 * Student:  { program_id, school_id_number, year_level }
 * Instructor: { program_id, school_id_number }
 * Hindi na nilulunok ang 404/405/409/422: lahat ay itinatapon bilang Error
 * (may .status at .fieldErrors) para makita ng screen.
 */
export async function saveProfileSetup(payload) {
  const res = await apiFetch(COMPLETE_PROFILE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(prepareProfileInput(payload)),
  });

  return expectJson(res);
}
