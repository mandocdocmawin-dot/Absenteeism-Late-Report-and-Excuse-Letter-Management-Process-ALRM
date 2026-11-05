import assert from "node:assert/strict";
import { test } from "node:test";
import { facultyCounts } from "../src/pages/auth/admin/facultyCounts.js";

test("instructor counts include teaching program heads once in their primary department", () => {
  const users = [
    { id: "teacher", role: "instructor", program_id: "p1", programs: [{ id: "p2" }] },
    { id: "head", name: "Jerreck", role: "program_head", program: { id: "p2" } },
    { id: "non-teaching-head", role: "program_head", program_id: "p2" },
    { id: "teacher", role: "instructor", program_id: "p1" },
    { id: "unassigned", role: "instructor" },
    { id: "student", role: "student", program_id: "p1" },
    { id: "admin", role: "administrator", program_id: "p1" },
  ];
  const classes = [{ instructor_id: "head", program_id: "p1" }, { instructor: { id: "head" }, program_id: "p2" }];
  assert.deepEqual(facultyCounts(users, classes), { total: 3, byProgram: { p1: 1, p2: 1 }, unassigned: 1 });
  assert.deepEqual(facultyCounts(users, []), { total: 2, byProgram: { p1: 1 }, unassigned: 1 });
});

test("empty and missing roster counts remain distinct", () => {
  assert.deepEqual(facultyCounts([], []), { total: 0, byProgram: {}, unassigned: 0 });
  assert.equal(facultyCounts(null, []), null);
  assert.equal(facultyCounts([], null), null);
});

test("new dual-role accounts follow role and assignment changes without duplicate counting", () => {
  const teacher = { id: "new-teacher", role: "instructor", heads_program: true, program_id: "bsis" };
  const head = { id: "new-head", role: "program_head", program_id: "bsis" };
  const users = [teacher, head];
  assert.equal(facultyCounts(users, []).total, 1);
  const classes = [{ instructor_id: head.id }, { instructor_id: head.id }];
  assert.deepEqual(facultyCounts(users, classes), { total: 2, byProgram: { bsis: 2 }, unassigned: 0 });
  assert.equal(facultyCounts([teacher, { ...head, role: "instructor" }], classes).total, 2);
  assert.equal(facultyCounts(users, [{ instructor_id: teacher.id }]).total, 1);
});

test("new staff use their sole program membership only when no primary department is stored", () => {
  const users = [
    { id: "new", role: "instructor", program_id: null, programs: [{ id: "bsis" }] },
    { id: "other", role: "instructor", program_id: "act", programs: [{ id: "bsis" }] },
    { id: "ambiguous", role: "instructor", programs: [{ id: "act" }, { id: "bsis" }] },
  ];
  assert.deepEqual(facultyCounts(users, []), { total: 3, byProgram: { bsis: 1, act: 1 }, unassigned: 1 });
});
