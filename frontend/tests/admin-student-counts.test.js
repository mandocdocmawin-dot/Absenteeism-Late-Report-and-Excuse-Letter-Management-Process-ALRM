import assert from "node:assert/strict";
import { test } from "node:test";
import { studentCounts } from "../src/pages/auth/admin/studentCounts.js";

test("three BSIS students count only in their registered program despite additional memberships", () => {
  const users = [1, 2, 3].map(id => ({ id, role: "student", program_id: "bsis", programs: [{ id: "bsis" }, { id: "act" }] }));
  users.push(users[0], { id: "teacher", role: "instructor", program_id: "act" });
  assert.deepEqual(studentCounts(users), { total: 3, byProgram: { bsis: 3 }, unassigned: 0 });
  assert.deepEqual(studentCounts(users.map(user => user.id === 3 ? { ...user, program_id: "act" } : user)), { total: 3, byProgram: { bsis: 2, act: 1 }, unassigned: 0 });
});

test("student counts match the role-only user roster and preserve unassigned and unavailable data", () => {
  assert.deepEqual(studentCounts([{ id: "pending", role: "student", status: "pending" }, { id: "inactive", role: "student", status: "deactivated" }]), { total: 2, byProgram: {}, unassigned: 2 });
  assert.deepEqual(studentCounts([]), { total: 0, byProgram: {}, unassigned: 0 });
  assert.equal(studentCounts(null), null);
});
