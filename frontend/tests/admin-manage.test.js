import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { MemoryRouter } from "react-router-dom";
import { getAdminAssignments } from "../src/api/adminAssignments.js";
import {
  activeTeachingAssignment, assignmentSelection, changeAssignmentSelection,
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

test("assignment selection distinguishes assigned and unassigned classes", () => {
  assert.deepEqual(assignmentSelection(classes[1], instructors), {
    sourceClassId: "c2", instructorId: "", programId: "", yearLevel: "", semester: "", targetClassId: "",
  });
  assert.equal(assignmentSelection({ ...classes[0], instructor_id: null }).targetClassId, "c1");
  assert.equal(activeTeachingAssignment(classes[0]).instructor_id, "i1");
});

test("changing a program clears dependent assignment filters", () => {
  const selection = { ...assignmentSelection(), programId: "p1", yearLevel: "3rd", semester: "2nd", targetClassId: "c1" };
  assert.deepEqual(changeAssignmentSelection(selection, "programId", "p2"), {
    ...selection, programId: "p2", yearLevel: "", semester: "",
  });
});

test("changing a year clears only the semester filter", () => {
  const selection = { ...assignmentSelection(), programId: "p1", yearLevel: "3rd", semester: "2nd" };
  assert.deepEqual(changeAssignmentSelection(selection, "yearLevel", "4th"), {
    ...selection, yearLevel: "4th", semester: "",
  });
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

test("assignment dialog has 20px corners and the expected assignment controls", async () => {
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
    assert.ok(createDialog.indexOf('id="assignment-instructor"') < createDialog.indexOf('id="assignment-program"'));
    assert.ok(createDialog.indexOf('id="assignment-program"') < createDialog.indexOf('id="assignment-class"'));
    assert.match(createDialog, /Grace/);
    assert.match(dialog, /Data Structures — Section 3A/);
    assert.match(createDialog, /id="assignment-reason"/);
  } finally {
    await server.close();
  }
});

test("edit assignment allows filtering and selecting the destination class", async () => {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  try {
    const AssignmentDialog = (await server.ssrLoadModule("/src/pages/auth/admin/manage/AssignmentDialog.jsx")).default;
    const data = {
      classes: [...classes, { id: "c4", program_id: "p2", subject_name: "Programming", section: "2A" }],
      instructors: instructors.slice(0, 2),
      programs: [{ id: "p1", program_name: "BSIS" }, { id: "p2", program_name: "BSA" }],
    };
    const dialog = renderToStaticMarkup(React.createElement(AssignmentDialog, { row: classes[0], data }));
    const program = dialog.match(/<select\b[^>]*id="assignment-program"[^>]*>/)?.[0] || "";
    const year = dialog.match(/<select\b[^>]*id="assignment-year"[^>]*>/)?.[0] || "";
    const semester = dialog.match(/<select\b[^>]*id="assignment-semester"[^>]*>/)?.[0] || "";
    const destination = dialog.match(/<select\b[^>]*id="assignment-class"[^>]*>/)?.[0] || "";
    for (const [control, label] of [[program, "Program"], [year, "Year"], [semester, "Semester"], [destination, "Class"]]) {
      assert.ok(control, `${label} dropdown must render`);
      assert.doesNotMatch(control, /\sdisabled(?:=|\s|$)/);
    }
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
