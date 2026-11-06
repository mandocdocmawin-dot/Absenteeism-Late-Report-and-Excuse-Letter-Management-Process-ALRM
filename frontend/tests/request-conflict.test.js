import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("only assignment-change conflicts trigger class refresh recovery", async () => {
  const requestForm = await server.ssrLoadModule("/src/pages/auth/student/request-form/useRequestForm.js");
  const isAssignmentConflict = requestForm.isTeachingAssignmentConflict;

  assert.equal(isAssignmentConflict?.({ status: 409, message: "The instructor assignment changed. Refresh the class list before submitting." }), true);
  assert.equal(isAssignmentConflict?.({ status: 409, message: "This request was already submitted. Please check your records." }), false);
  assert.equal(isAssignmentConflict?.({ status: 409, message: "Another request conflict occurred." }), false);
  assert.equal(isAssignmentConflict?.({ status: 422, message: "The instructor assignment changed." }), false);
});
