import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  canPreviewRole,
  getPreviewRole,
  previewRoleLabel,
} from "../src/lib/previewRole.js";

const student = {
  id: "student-1",
  role: "student",
  email: "someone@student.laverdad.edu.ph",
};

afterEach(() => {
  delete globalThis.localStorage;
});

test("school students can preview roles without changing their account role", () => {
  globalThis.localStorage = {
    getItem: (key) => key === "alrm_preview_role:student-1" ? "program" : null,
  };

  assert.equal(canPreviewRole(student), true);
  assert.equal(getPreviewRole(student), "program");
  assert.equal(student.role, "student");
  assert.equal(previewRoleLabel("program_head"), "Program Head");
});

test("other accounts and invalid stored roles retain their server role", () => {
  globalThis.localStorage = { getItem: () => "admin" };
  assert.equal(getPreviewRole({ ...student, email: "someone@example.com" }), "student");

  globalThis.localStorage = { getItem: () => "unknown" };
  assert.equal(getPreviewRole(student), "student");
});

test("blocked browser storage does not block the account role", () => {
  globalThis.localStorage = { getItem: () => { throw new Error("blocked"); } };
  assert.equal(getPreviewRole(student), "student");
});
