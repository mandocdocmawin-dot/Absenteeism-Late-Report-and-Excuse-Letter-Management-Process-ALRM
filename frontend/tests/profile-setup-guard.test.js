import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import * as profileSetup from "../src/lib/profileSetup.js";

const yearOptions = [
  { value: "1st", label: "1st Year" },
  { value: "2nd", label: "2nd Year" },
];

let server;
let ProfileSetup;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false },
    appType: "custom",
    plugins: [{
      name: "profile-setup-guard-state",
      enforce: "pre",
      transform(code, id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/src/context/AuthContext.jsx")) {
          return "export function useAuth() { return globalThis.__profileSetupAuth; }";
        }
        if (path.endsWith("/src/pages/ProfileSetup.jsx")) {
          return code
            .replace("useState([])", "useState(globalThis.__profileSetupPrograms || [])")
            .replace("const [programsLoading, setProgramsLoading] = useState(true);", "const [programsLoading, setProgramsLoading] = useState(false);");
        }
      },
    }],
  });
  ({ default: ProfileSetup } = await server.ssrLoadModule("/src/pages/ProfileSetup.jsx"));
});

after(async () => { await server?.close(); });

function renderProfile(user, programs = [{ id: "program-1", program_name: "BSIS" }]) {
  globalThis.__profileSetupAuth = { user, refreshUser() {} };
  globalThis.__profileSetupPrograms = programs;
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(ProfileSetup)));
}

function submitButton(html) {
  return html.match(/<button\b[^>]*type="submit"[^>]*>Continue to Dashboard<\/button>/)?.[0] || "";
}

function isDisabled(button) {
  return /\sdisabled(?:=""|(?=[\s>]))/.test(button);
}

test("students cannot continue until every required profile field is complete", () => {
  assert.equal(typeof profileSetup.isProfileSetupReady, "function");

  const complete = {
    role: "student",
    userId: "student-1",
    programId: "program-1",
    selectedProgramId: "program-1",
    schoolIdNumber: "24-001",
    yearLevel: "1st",
    yearOptions,
  };

  assert.equal(profileSetup.isProfileSetupReady(complete), true);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, programId: "" }), false);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, selectedProgramId: "program-2" }), false);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, schoolIdNumber: "   " }), false);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, yearLevel: "4th" }), false);
});

test("instructors require their entered instructor ID and a loaded matching program", () => {
  const complete = {
    role: "instructor",
    userId: "staff-1",
    schoolIdNumber: "FAC-2026-001",
    programId: "program-1",
    selectedProgramId: "program-1",
  };

  assert.equal(profileSetup.isProfileSetupReady(complete), true);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, schoolIdNumber: "" }), false);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, selectedProgramId: "" }), false);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, role: "program_head", schoolIdNumber: "" }), true);
  assert.equal(profileSetup.isProfileSetupReady({ ...complete, role: "admin" }), false);
});

test("persisted profile fields keep instructors complete across login sessions", () => {
  const instructor = {
    id: "instructor-1",
    role: "instructor",
    program_id: "program-1",
    school_id_number: "FAC-2026-001",
    programs: [{ id: "program-1" }],
  };

  assert.equal(profileSetup.isProfileSetupComplete(instructor, { sessionVersion: "session-one" }), true);
  assert.equal(profileSetup.isProfileSetupComplete(instructor, { sessionVersion: "session-two" }), true);
  assert.equal(profileSetup.needsProfileSetup(instructor), false);

  const programHead = { ...instructor, id: "head-1", role: "program_head" };
  assert.equal(profileSetup.isProfileSetupComplete(programHead), true);
  assert.equal(profileSetup.needsProfileSetup(programHead), false);
});

test("profile completion requires the persisted fields for each role", () => {
  const instructor = { id: "staff", role: "instructor", program_id: "program-1", school_id_number: "FAC-2026-002" };
  const student = { id: "student", role: "student", program_id: "program-1", school_id_number: "24-001", year_level: "1st" };

  assert.equal(profileSetup.isProfileSetupComplete(instructor), true);
  assert.equal(profileSetup.isProfileSetupComplete({ ...instructor, program_id: null, programs: [] }), false);
  assert.equal(profileSetup.isProfileSetupComplete({ ...instructor, school_id_number: "" }), false);
  assert.equal(profileSetup.isProfileSetupComplete(student), true);
  for (const field of ["program_id", "school_id_number", "year_level"]) {
    assert.equal(profileSetup.isProfileSetupComplete({ ...student, [field]: "" }), false, field);
  }
  assert.equal(profileSetup.isProfileSetupComplete({ id: "admin", role: "administrator" }), true);
  assert.equal(profileSetup.isProfileSetupComplete({ id: "head", role: "program_head" }), true);
});

test("the form button is unavailable until the role-specific fields are complete", () => {
  const incompleteStudent = renderProfile({ id: "student-1", role: "student", program_id: "", school_id_number: "", year_level: "" });
  assert.equal(isDisabled(submitButton(incompleteStudent)), true);

  const completeStudent = renderProfile({ id: "student-1", role: "student", program_id: "program-1", school_id_number: "24-001", year_level: "1st" });
  assert.equal(isDisabled(submitButton(completeStudent)), false);

  const instructorWithoutId = renderProfile({ id: "database-uuid", role: "instructor", program_id: "program-1" });
  assert.equal(isDisabled(submitButton(instructorWithoutId)), true);
  assert.match(instructorWithoutId, /Instructor ID/);
  assert.doesNotMatch(instructorWithoutId, /value="database-uuid"/);

  const completeInstructor = renderProfile({ id: "database-uuid", role: "instructor", program_id: "program-1", school_id_number: "FAC-2026-001" });
  assert.equal(isDisabled(submitButton(completeInstructor)), false);
  assert.match(completeInstructor, /value="FAC-2026-001"/);
  assert.doesNotMatch(completeInstructor, /value="database-uuid"/);

  const completeStaff = renderProfile({ id: "staff-1", role: "program_head", program_id: "program-1" });
  assert.equal(isDisabled(submitButton(completeStaff)), false);
  assert.doesNotMatch(completeStaff, /Account ID/);
});
