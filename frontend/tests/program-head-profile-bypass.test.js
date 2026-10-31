import assert from "node:assert/strict";
import test from "node:test";
import { isProfileSetupComplete, needsProfileSetup } from "../src/lib/profileSetup.js";

test("program heads skip profile setup after login", () => {
  for (const role of ["program_head", "program"]) {
    const user = { id: `head-${role}`, role, program_id: null, programs: [] };
    assert.equal(isProfileSetupComplete(user, { sessionVersion: "unconfirmed", storage: null }), true);
    assert.equal(needsProfileSetup(user, { sessionVersion: "unconfirmed", storage: null }), false);
  }
});

test("incomplete instructors and students still require profile setup", () => {
  assert.equal(needsProfileSetup({ id: "instructor-1", role: "instructor", program_id: null }), true);
  assert.equal(needsProfileSetup({ id: "student-1", role: "student", program_id: null }), true);
});
