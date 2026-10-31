import { apiFetch } from "./client.js";

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

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesYear(studentYear, selectedYear) {
  if (!selectedYear) return true;

  const selected = normalized(selectedYear).replace(/\s+year$/, "");
  const actual = normalized(studentYear).replace(/\s+year$/, "");
  return actual === selected;
}

function filterStudents(students, filters) {
  const search = normalized(filters.search);

  return students.filter((student) => {
    const searchable = [
      student?.name,
      student?.email,
      student?.school_id_number,
      student?.student_id,
    ]
      .map(normalized)
      .join(" ");

    const matchesSearch = !search || searchable.includes(search);
    const matchesProgram =
      !filters.programId ||
      String(student?.program_id ?? "") === String(filters.programId);

    return (
      matchesSearch &&
      matchesProgram &&
      matchesYear(student?.year_level, filters.yearLevel)
    );
  });
}

export async function getAdminStudents(filters = {}) {
  const params = new URLSearchParams();

  params.set("role", "student");
  if (filters.status) params.set("status", filters.status);

  const query = params.toString();
  const path = `/api/admin/users?${query}`;
  const res = await apiFetch(path);
  const body = await expectJson(res, path);

  return filterStudents(listFrom(body), filters);
}

export async function getAdminStudent(studentId) {
  const students = await getAdminStudents();
  const student = students.find(
    (item) => String(item?.id ?? item?.user_id) === String(studentId),
  );

  if (!student) {
    const error = new Error("The requested student could not be found.");
    error.status = 404;
    throw error;
  }

  if (student.program || !student.program_id) return student;

  try {
    const path = "/api/admin/programs";
    const response = await apiFetch(path);
    const programs = listFrom(await expectJson(response, path));
    const program = programs.find((item) =>
      String(item?.id ?? item?.program_id) === String(student.program_id)
    );
    return program ? { ...student, program } : student;
  } catch {
    return student;
  }
}
