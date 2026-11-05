import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import * as assignments from "../src/api/adminAssignments.js";
import { mockApiFetch } from "./helpers/mockApiFetch.js";

let server;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
});

after(async () => {
  await server?.close();
});

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "mock-session", setItem() {}, removeItem() {} },
  });
  globalThis.window = new EventTarget();
});

afterEach(() => {
  mock.restoreAll();
  delete globalThis.localStorage;
  delete globalThis.window;
});

test("teaching assignment changes use the versioned backend action", async () => {
  assert.equal(typeof assignments.changeTeachingAssignment, "function");
  const payload = {
    action: "change_subject",
    expected_revision: 3,
    target_class_id: "22222222-2222-4222-8222-222222222222",
    target_expected_revision: 0,
    reason: "Teaching load adjustment",
  };
  mockApiFetch(async (url, options) => {
    assert.equal(url, "/api/admin/classes/11111111-1111-4111-8111-111111111111/assignment");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ success: true, data: {
      event_id: "33333333-3333-4333-8333-333333333333",
      classes: [{ id: "11111111-1111-4111-8111-111111111111", assignment_revision: 4 }],
    } });
  });

  const result = await assignments.changeTeachingAssignment(
    "11111111-1111-4111-8111-111111111111",
    payload,
  );
  assert.equal(result.classes[0].assignment_revision, 4);
});

test("teaching assignment success must confirm affected classes", async () => {
  assert.equal(typeof assignments.changeTeachingAssignment, "function");
  mockApiFetch(async () => Response.json({ success: true, data: { event_id: "event", classes: [] } }));
  await assert.rejects(
    assignments.changeTeachingAssignment("11111111-1111-4111-8111-111111111111", {
      action: "remove", expected_revision: 2, reason: "Schedule correction",
    }),
    /confirm/i,
  );
});

test("assignment dialog requires an administrator reason", async () => {
  const AssignmentDialog = (await server.ssrLoadModule("/src/pages/auth/admin/manage/AssignmentDialog.jsx")).default;
  const unassigned = {
    id: "11111111-1111-4111-8111-111111111111", subject_name: "Data Structures",
    program_id: "program-one", year_level: "3rd", semester: "1st", school_year: "2026-2027",
    assignment_revision: 0, active_teaching_assignment: null,
  };
  const data = {
    classes: [unassigned], programs: [{ id: "program-one", program_name: "BSIS" }],
    instructors: [{ id: "instructor-one", name: "Ada" }],
  };

  const assignHtml = renderToStaticMarkup(React.createElement(AssignmentDialog, { row: unassigned, data }));
  assert.match(assignHtml, /id="assignment-reason"[^>]*required/);
});
