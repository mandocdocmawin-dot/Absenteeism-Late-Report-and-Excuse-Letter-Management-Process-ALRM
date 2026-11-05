import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { MemoryRouter } from "react-router-dom";
import {
  getAdminAssignmentCandidates,
  getAdminAssignments,
  getAdminClassesPage,
  getAdminPrograms,
  getApprovedInstructors,
} from "../src/api/adminAssignments.js";
import {
  activeTeachingAssignment, assignmentCandidates, assignmentSelection, buildAssignmentPayload,
  changeAssignmentSelection, mergeAssignmentClasses,
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

function buttonHtml(html, label) {
  return [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match => match[0]).find(button => button.includes(label)) || "";
}

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

test("class page loading does not request program or instructor lookups", async () => {
  const requested = [];
  mockApiFetch(async (url) => {
    const request = new URL(url, "http://fixture.local");
    requested.push(request.pathname);
    return Response.json({
      data: classes,
      meta: { page: 1, per_page: 25, total: 3, last_page: 1 },
    });
  });

  const result = await getAdminClassesPage({
    page: 1,
    perPage: 25,
    filters: { search: "Data", programId: "p1" },
  });

  assert.deepEqual(requested, ["/api/admin/classes"]);
  assert.deepEqual(result.data, classes);
  assert.equal(result.meta.total, 3);
});

test("program and approved-instructor lookups load independently", async () => {
  mockApiFetch(async (url) => {
    const request = new URL(url, "http://fixture.local");
    if (request.pathname === "/api/admin/programs") {
      return Response.json({ data: [{ id: "p1", program_name: "BSIS" }] });
    }
    assert.equal(request.pathname, "/api/admin/users");
    return Response.json({ data: instructors });
  });

  assert.deepEqual(await getAdminPrograms(), [{ id: "p1", program_name: "BSIS" }]);
  assert.deepEqual((await getApprovedInstructors()).map((row) => row.id), ["i1", "i2"]);
});

test("assignment candidates load every backend page in 100-record batches", async () => {
  mockApiFetch(async (url) => {
    const request = new URL(url, "http://fixture.local");
    const page = Number(request.searchParams.get("page"));
    assert.equal(request.pathname, "/api/admin/classes");
    assert.equal(request.searchParams.get("per_page"), "100");
    return Response.json({ data: [{ id: `class-${page}` }], meta: { page, per_page: 100, total: 2, last_page: 2 } });
  });
  assert.deepEqual((await getAdminAssignmentCandidates()).map(item => item.id), ["class-1", "class-2"]);
});

test("assignment actions use only eligible classes and exact versioned payloads", () => {
  const source = { ...classes[0], semester: "1st", school_year: "2026-2027", assignment_revision: 4 };
  const unassigned = { ...classes[1], instructor_id: null, semester: "1st", school_year: "2026-2027", assignment_revision: 2 };
  const other = { ...classes[2], semester: "1st", school_year: "2026-2027", assignment_revision: 7 };
  const wrongTerm = { id: "c4", instructor_id: null, semester: "2nd", school_year: "2026-2027" };
  assert.deepEqual(assignmentCandidates([source, unassigned, other, wrongTerm], source, "change_subject").map(item => item.id), ["c2"]);
  assert.deepEqual(assignmentCandidates([source, unassigned, other, wrongTerm], source, "swap").map(item => item.id), ["c3"]);
  assert.deepEqual(buildAssignmentPayload("change_instructor", source, { instructorId: "i2" }, "Load change"), {
    action: "change_instructor", expected_revision: 4, instructor_id: "i2", reason: "Load change",
  });
  assert.deepEqual(buildAssignmentPayload("swap", source, { targetClass: other }, "Schedule swap"), {
    action: "swap", expected_revision: 4, target_class_id: "c3", target_expected_revision: 7, reason: "Schedule swap",
  });
});

test("returned assignment classes merge into existing rows without changing pagination membership", () => {
  const current = [{ id: "c1", assignment_revision: 1, subject_name: "Data" }, { id: "c2", assignment_revision: 2 }];
  const merged = mergeAssignmentClasses(current, [{ id: "c1", assignment_revision: 3, active_teaching_assignment: { instructor_id: "i2" } }, { id: "later-page" }]);
  assert.deepEqual(merged, [{ id: "c1", assignment_revision: 3, subject_name: "Data", active_teaching_assignment: { instructor_id: "i2" } }, current[1]]);
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

test("assigned-class dialog exposes every non-destructive backend action", async () => {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  try {
    const AssignmentDialog = (await server.ssrLoadModule("/src/pages/auth/admin/manage/AssignmentDialog.jsx")).default;
    const data = { classes, instructors: instructors.slice(0, 2), programs: [] };
    const html = renderToStaticMarkup(React.createElement(AssignmentDialog, { row: classes[0], data }));
    assert.match(html, /id="assignment-action"/);
    assert.match(html, /value="change_instructor"/);
    assert.match(html, /value="change_subject"/);
    assert.match(html, /value="swap"/);
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
    assert.doesNotMatch(html, /data-slot="skeleton"[^>]*w-28/);
    assert.doesNotMatch(html, /<(select|button)\b/);
    assert.doesNotMatch(html, /animate-spin/);
  } finally {
    await server.close();
  }
});

test("Manage renders loaded classes while assignment lookups are still loading", async () => {
  const classData = {
    classes: [{ ...classes[0], instructor_id: null }],
    classesMeta: { page: 1, per_page: 25, total: 1, last_page: 1 },
  };
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "progressive-manage-page", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/pages/auth/admin/AdminManage.jsx")) {
        return code
          .replace("const [classData, setClassData] = useState(cached?.data || null);", `const [classData, setClassData] = useState(${JSON.stringify(classData)});`)
          .replace("const [classLoading, setClassLoading] = useState(!cached);", "const [classLoading, setClassLoading] = useState(false);");
      }
    },
  }] });
  try {
    const AdminManage = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminManage)));
    assert.match(html, /Data Structures/);
    assert.doesNotMatch(html, /aria-label="Loading instructor assignments"/);
    assert.match(buttonHtml(html, "Assign Instructor"), /\sdisabled(?:=|\s|>)/);
    assert.match(buttonHtml(html, "Assign instructor"), /\sdisabled(?:=|\s|>)/);
  } finally {
    await server.close();
  }
});

test("search refresh keeps the search control and loaded table mounted", async () => {
  const classData = { classes: [classes[0]], classesMeta: { page: 1, per_page: 25, total: 1, last_page: 1 } };
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "refreshing-manage-search", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/pages/auth/admin/AdminManage.jsx")) {
        return code
          .replace("const [classData, setClassData] = useState(cached?.data || null);", `const [classData, setClassData] = useState(${JSON.stringify(classData)});`)
          .replace("const [classLoading, setClassLoading] = useState(!cached);", "const [classLoading, setClassLoading] = useState(true);");
      }
    },
  }] });
  try {
    const Page = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)));
    assert.match(html, /aria-label="Search instructor assignments"/);
    assert.match(html, /Data Structures/);
    assert.doesNotMatch(html, /aria-label="Loading instructor assignments"/);
    assert.match(html, /Updating instructor assignments/);
  } finally { await server.close(); }
});

test("lookup failures keep the class table visible and offer a retry", async () => {
  const classData = {
    classes: [classes[0]],
    classesMeta: { page: 1, per_page: 25, total: 1, last_page: 1 },
  };
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "failed-manage-lookups", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/pages/auth/admin/AdminManage.jsx")) {
        return code
          .replace("const [classData, setClassData] = useState(cached?.data || null);", `const [classData, setClassData] = useState(${JSON.stringify(classData)});`)
          .replace("const [classLoading, setClassLoading] = useState(!cached);", "const [classLoading, setClassLoading] = useState(false);")
          .replace('const [lookupError, setLookupError] = useState("");', 'const [lookupError, setLookupError] = useState("Instructor options could not be loaded.");');
      }
    },
  }] });
  try {
    const AdminManage = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminManage)));
    assert.match(html, /Data Structures/);
    assert.match(html, /Instructor options could not be loaded/);
    assert.match(html, />Retry lookups<\/button>/);
  } finally {
    await server.close();
  }
});

test("Manage keeps class administration out of the instructor assignment workflow", async () => {
  const data = {
    classes: [],
    classesMeta: { page: 1, per_page: 25, total: 0, last_page: 1 },
    instructors: [],
    programs: [],
  };
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "loaded-manage-page", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/pages/auth/admin/AdminManage.jsx")) {
        return code
          .replace("const [classData, setClassData] = useState(cached?.data || null);", `const [classData, setClassData] = useState(${JSON.stringify({ classes: data.classes, classesMeta: data.classesMeta })});`)
          .replace("const [classLoading, setClassLoading] = useState(!cached);", "const [classLoading, setClassLoading] = useState(false);");
      }
    },
  }] });
  try {
    const AdminManage = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminManage)));
    assert.match(html, />Assign Instructor<\/button>/);
    assert.match(buttonHtml(html, "Assign Instructor"), /\sdisabled(?:=|\s|>)/);
    assert.doesNotMatch(html, /href="\/classes"/);
    assert.doesNotMatch(html, />Manage classes<\/a>/i);
  } finally {
    await server.close();
  }
});

test("global Assign stays enabled when only the current page is fully assigned", async () => {
  const data = {
    classes: [{ ...classes[0], active_teaching_assignment: { instructor_id: "i1" } }],
    classesMeta: { page: 1, per_page: 25, total: 26, last_page: 2 },
    instructors: [instructors[0]], programs: [],
  };
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "assigned-current-page", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/pages/auth/admin/AdminManage.jsx")) {
        return code
          .replace("const [classData, setClassData] = useState(cached?.data || null);", `const [classData, setClassData] = useState(${JSON.stringify({ classes: data.classes, classesMeta: data.classesMeta })});`)
          .replace("const [classLoading, setClassLoading] = useState(!cached);", "const [classLoading, setClassLoading] = useState(false);")
          .replace("const [instructors, setInstructors] = useState(cachedInstructors?.data || []);", `const [instructors, setInstructors] = useState(${JSON.stringify(data.instructors)});`);
      }
    },
  }] });
  try {
    const AdminManage = (await server.ssrLoadModule("/src/pages/auth/admin/AdminManage.jsx")).default;
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminManage)));
    const button = buttonHtml(html, "Assign Instructor");
    assert.ok(button);
    assert.doesNotMatch(button, /\sdisabled(?:=|\s|>)/);
  } finally {
    await server.close();
  }
});
