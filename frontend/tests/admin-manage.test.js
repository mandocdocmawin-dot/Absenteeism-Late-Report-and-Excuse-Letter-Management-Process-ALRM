import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { MemoryRouter } from "react-router-dom";
import { getAdminAssignments, assignClassInstructor } from "../src/api/adminAssignments.js";
import {
  assignmentSelection, changeAssignmentSelection, selectedAssignmentClass, validateAssignment,
} from "../src/pages/auth/admin/manage/assignments.js";

const classes = [
  { id: "c1", program_id: "p1", subject_name: "Data Structures", section: "3A", instructor_id: "i1" },
  { id: "c2", program_id: "p1", subject_name: "Data Structures", section: "3B", instructor_id: "i1" },
  { id: "c3", program_id: "p2", subject_name: "Data Structures", section: "3A", instructor_id: "i2" },
];
const instructors = [
  { id: "i1", role: "instructor", status: "approved", name: "Ada" },
  { id: "i2", role: "instructor", status: "approved", name: "Grace", program_id: "general-education" },
  { id: "pending", role: "instructor", status: "pending" },
  { id: "inactive", role: "instructor", status: "deactivated" },
  { id: "head", role: "program_head", status: "approved" },
];

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, value: { getItem: () => "mock-session", setItem() {}, removeItem() {} },
  });
  globalThis.window = new EventTarget();
  // Every request is mocked; an unexpected endpoint fails instead of reaching auth or production.
  mockApiFetch(async (url) => { throw new Error(`Unexpected request: ${url}`); });
});
afterEach(() => {
  mock.restoreAll();
  delete globalThis.localStorage;
  delete globalThis.window;
});

test("Edit starts from the actual class and its approved instructor", () => {
  assert.deepEqual(assignmentSelection(classes[1], instructors), {
    subject: "Data Structures", classId: "c2", instructorId: "i1",
  });
  assert.equal(assignmentSelection({ ...classes[0], instructor_id: "pending" }, instructors).instructorId, "");
});

test("changing instructor retains the selected subject and class", () => {
  const next = changeAssignmentSelection(assignmentSelection(classes[0], instructors), "instructorId", "i2");
  assert.deepEqual(next, { subject: "Data Structures", classId: "c1", instructorId: "i2" });
});

test("changing subject clears only the destination class", () => {
  const initial = assignmentSelection(classes[0], instructors);
  assert.deepEqual(changeAssignmentSelection(initial, "subject", "Programming"), {
    ...initial, subject: "Programming", classId: "",
  });
  assert.deepEqual(changeAssignmentSelection(initial, "classId", "c2"), {
    ...initial, classId: "c2",
  });
});

test("class selection is validated against the chosen subject", () => {
  const initial = assignmentSelection(classes[0], instructors);
  assert.equal(selectedAssignmentClass(classes, { ...initial, classId: "c3" })?.id, "c3");
  assert.equal(selectedAssignmentClass(classes, { ...initial, subject: "Other subject" }), undefined);
  assert.throws(() => validateAssignment(classes, instructors, { ...initial, classId: "missing" }), /existing class/i);
});

test("assignment validates instructor role and approval before sending", () => {
  const initial = assignmentSelection(classes[0], instructors);
  for (const instructorId of ["", "missing", "pending", "inactive", "head"]) {
    assert.throws(() => validateAssignment(classes, instructors, { ...initial, instructorId }), /approved instructor/i);
  }
  assert.deepEqual(validateAssignment(classes, instructors, { ...initial, instructorId: "i2" }), {
    classId: "c1", instructorId: "i2",
  });
});

test("General Education instructors can be assigned to another program's class", () => {
  const selection = { subject: "Data Structures", classId: "c1", instructorId: "i2" };
  assert.deepEqual(validateAssignment(classes, instructors, selection), { classId: "c1", instructorId: "i2" });
});

test("the same section in a different class or term resolves by actual class ID", () => {
  const duplicate = { ...classes[0], id: "c4", school_year: "2027-2028" };
  const selected = { ...assignmentSelection(classes[0], instructors), classId: "c4", instructorId: "i2" };
  assert.equal(validateAssignment([...classes, duplicate], instructors, selected).classId, "c4");
});

test("collection loading includes paginated classes, programs and approved role data", async () => {
  mockApiFetch(async (url) => {
    const request = new URL(url, "http://fixture.local");
    const page = Number(request.searchParams.get("page"));
    if (request.pathname === "/api/admin/programs") {
      assert.equal(request.searchParams.get("per_page"), "100");
      return Response.json({ data: [{ id: "p1", program_name: "BSIS" }], meta: { page, per_page: 100, total: 1, last_page: 1 } });
    }
    if (request.pathname === "/api/admin/users") {
      assert.equal(request.searchParams.get("per_page"), "100");
      assert.equal(request.searchParams.get("role"), "instructor");
      assert.equal(request.searchParams.get("status"), "approved");
      return Response.json({ data: instructors, meta: { page, per_page: 100, total: instructors.length, last_page: 1 } });
    }
    assert.equal(request.pathname, "/api/admin/classes");
    assert.equal(request.searchParams.get("per_page"), "25");
    // Use a full first page so pagination metadata and record counts agree.
    const firstPage = Array.from({ length: 25 }, (_, index) => ({ ...classes[0], id: `page1-${index}` }));
    return Response.json({ data: page === 1 ? firstPage : [classes[2]], meta: { page, per_page: 25, total: 26, last_page: 2 } });
  });
  const data = await getAdminAssignments();
  assert.equal(data.classes.length, 25);
  assert.equal(data.classes[0].id, "page1-0");
  assert.equal(data.classesMeta.last_page, 2);
  assert.deepEqual(data.programs.map(row => row.id), ["p1"]);
  assert.deepEqual(data.instructors.map(row => row.id), ["i1", "i2"]);
});

test("assignment PATCH sends only instructor_id and waits for the server response", async () => {
  let respond;
  mockApiFetch((url, options) => {
    assert.equal(url, "/api/admin/classes/class%2Fid");
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { instructor_id: "i2" });
    return new Promise(resolve => { respond = resolve; });
  });
  let completed = false;
  const saving = assignClassInstructor("class/id", "i2").then(data => { completed = true; return data; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(completed, false);
  respond(Response.json({ success: true, data: { id: "class/id", instructor_id: "i2" } }));
  assert.equal((await saving).instructor_id, "i2");
});

test("missing instructor cannot be sent as an unassignment", async () => {
  for (const instructorId of [null, "", undefined]) {
    await assert.rejects(assignClassInstructor("c1", instructorId), /instructor/i);
  }
});

test("backend validation errors remain available to the dialog", async () => {
  mockApiFetch(async () => Response.json({
    message: "Validation failed.", errors: { instructor_id: ["The selected instructor is invalid."] },
  }, { status: 422 }));
  await assert.rejects(assignClassInstructor("c1", "i2"), error => {
    assert.equal(error.status, 422);
    assert.deepEqual(error.errors.instructor_id, ["The selected instructor is invalid."]);
    return true;
  });
});

test("an unsuccessful or malformed success response cannot be reported as saved", async () => {
  for (const payload of [null, { success: false, message: "Assignment rejected." }, { data: { id: "c1", instructor_id: "i1" } }]) {
    mockApiFetch(async () => Response.json(payload));
    await assert.rejects(assignClassInstructor("c1", "i2"), /confirm|rejected/i);
  }
});

test("collection requests forward cancellation", async () => {
  const controller = new AbortController();
  mockApiFetch(async (url, options) => {
    assert.equal(options.signal, controller.signal);
    return Response.json({ data: [] });
  });
  assert.deepEqual(await getAdminAssignments({ signal: controller.signal }), { classes: [], classesMeta: null, programs: [], instructors: [] });
});

test("collection failures reject loading without supplying fake assignments", async () => {
  mockApiFetch(async () => Response.json({ message: "Service unavailable." }, { status: 503 }));
  await assert.rejects(getAdminAssignments(), /Service unavailable/);
});

test("assignment dialog has 20px corners and class removal is enabled with destructive styling", async () => {
  const data = {
    classes: [{ ...classes[0], year_level: "3rd" }, ...classes.slice(1), { id: "ge-class", program_id: "ge", subject_name: "General Education Subject", section: "1A" }],
    instructors: instructors.slice(0, 2),
    programs: [{ id: "p1", program_name: "BSIS" }, { id: "p2", program_name: "BSA" }, { id: "ge", program_name: "General Education" }],
  };
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "loaded-assignments", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/pages/auth/admin/AdminManage.jsx")) {
        return code.replace("useState(null)", `useState(${JSON.stringify(data)})`).replace("useState(true)", "useState(false)");
      }
    },
  }] });
  try {
    const AssignmentDialog = (await server.ssrLoadModule("/src/pages/auth/admin/manage/AssignmentDialog.jsx")).default;
    const dialog = renderToStaticMarkup(React.createElement(AssignmentDialog, { row: classes[0], data }));
    assert.match(dialog, /<dialog\b[^>]*rounded-\[20px\]/);
    const createDialog = renderToStaticMarkup(React.createElement(AssignmentDialog, { row: null, data: { ...data, classes } }));
    assert.ok(createDialog.indexOf('id="assignment-instructor"') < createDialog.indexOf('id="assignment-subject"'));
    assert.ok(createDialog.indexOf('id="assignment-subject"') < createDialog.indexOf('id="assignment-class"'));
    assert.doesNotMatch(createDialog, /id="assignment-program"/);
    assert.match(createDialog, /Grace/);
    assert.match(dialog, /BSIS · 3rd year · Section 3A/);
    const AdminManage = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const { Button } = await server.ssrLoadModule("/src/components/ui/button.jsx");
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminManage)));
    assert.doesNotMatch(html, /General Education/);
    const removeButtons = [...html.matchAll(/<button\b[^>]*>Remove<\/button>/g)];
    const deleteButton = renderToStaticMarkup(React.createElement(Button, { size: "sm", variant: "destructive" }, "Delete"));
    assert.equal(removeButtons.length, classes.length);
    for (const [remove] of removeButtons) {
      assert.equal(remove.match(/class="([^"]*)"/)[1], deleteButton.match(/class="([^"]*)"/)[1]);
      assert.doesNotMatch(remove, /\sdisabled=""/);
    }
    assert.doesNotMatch(html, /unassignment-explanation|cannot be removed without a replacement/);
  } finally {
    await server.close();
  }
});

test("edit assignment allows changing the subject and destination class", async () => {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  try {
    const AssignmentDialog = (await server.ssrLoadModule("/src/pages/auth/admin/manage/AssignmentDialog.jsx")).default;
    const data = {
      classes: [...classes, { id: "c4", program_id: "p2", subject_name: "Programming", section: "2A" }],
      instructors: instructors.slice(0, 2),
      programs: [{ id: "p1", program_name: "BSIS" }, { id: "p2", program_name: "BSA" }],
    };
    const dialog = renderToStaticMarkup(React.createElement(AssignmentDialog, { row: classes[0], data }));
    const subject = dialog.match(/<select\b[^>]*id="assignment-subject"[^>]*>/)?.[0] || "";
    const destination = dialog.match(/<select\b[^>]*id="assignment-class"[^>]*>/)?.[0] || "";
    assert.ok(subject, "Subject dropdown must render");
    assert.ok(destination, "Program, year and section dropdown must render");
    assert.doesNotMatch(subject, /\sdisabled(?:=|\s|$)/);
    assert.doesNotMatch(destination, /\sdisabled(?:=|\s|$)/);
  } finally {
    await server.close();
  }
});

test("Manage announces its heading and loads with matching filter, action and table skeletons", async () => {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  try {
    const AdminManage = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminManage)));
    assert.match(html, /<h1[^>]*>Manage<\/h1>/);
    assert.match(html, /aria-label="Loading instructor assignments"/);
    assert.match(html, /aria-busy="true"/);
    assert.equal((html.match(/data-slot="skeleton-row"/g) || []).length, 5);
    assert.match(html, /data-slot="skeleton"[^>]*w-\[260px\]/);
    assert.match(html, /data-slot="skeleton"[^>]*w-\[170px\]/);
    assert.doesNotMatch(html, /<(select|button)\b/);
    assert.doesNotMatch(html, /animate-spin/);
  } finally {
    await server.close();
  }
});
