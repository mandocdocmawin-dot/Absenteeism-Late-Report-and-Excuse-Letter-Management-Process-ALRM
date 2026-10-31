import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { MemoryRouter } from "react-router-dom";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("page skeletons announce one loading state without showing interactive or fake data", async () => {
  const Skeleton = (await server.ssrLoadModule("/src/components/loading/LoadingSkeleton.jsx")).default;
  for (const variant of ["page", "dashboard", "table", "form", "profile", "list", "field"]) {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant, label: "Loading student records" }));
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Loading student records/);
    assert.equal((html.match(/role="status"/g) || []).length, 1);
    assert.match(html, /data-slot="skeleton"/);
    assert.doesNotMatch(html, /<(button|input|select|a)\b/);
  }
});

test("resource loading replaces children but keeps loaded, empty and error results unchanged", async () => {
  const { ResourceState } = await server.ssrLoadModule("/src/components/dashboard/ResourceState.jsx");
  const render = (props) => renderToStaticMarkup(React.createElement(ResourceState, props, React.createElement("p", null, "Ready records")));
  const loading = render({ loading: true });
  assert.match(loading, /data-slot="skeleton"/);
  assert.doesNotMatch(loading, /Ready records/);
  assert.match(render({}), /Ready records/);
  assert.match(render({ empty: "No records" }), /No records/);
  const failed = render({ error: "Backend unavailable", onRetry() {} });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Retry/);
  assert.doesNotMatch(failed, /data-slot="skeleton"/);
});

test("upload indicator is a circular status with an honest phase label, not invented progress", async () => {
  const UploadProgress = (await server.ssrLoadModule("/src/components/loading/UploadProgress.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(UploadProgress, { label: "Uploading supporting document..." }));
  assert.match(html, /Uploading supporting document/);
  assert.match(html, /data-slot="spinner"/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.doesNotMatch(html, /\d+%/);
});

test("review attachment remains read-only even when editing callbacks are supplied", async () => {
  const Attachment = (await server.ssrLoadModule("/src/pages/auth/student/request-form/components/ReviewAttachment.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Attachment, { processing: true, file: { name: "proof.pdf" }, updateField() {}, onFileChange() {} }));
  assert.match(html, /proof.pdf/);
  assert.doesNotMatch(html, /<(input|button)\b/);
});

test("initial data loading renders skeletons in every role dashboard and student data page", async () => {
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const pages = [
    ["/src/pages/auth/student/StudentDashboard.jsx", "default"],
    ["/src/pages/auth/student/StudentRecords.jsx", "default"],
    ["/src/pages/auth/student/StudentNotificationsPage.jsx", "default"],
    ["/src/pages/auth/student/StudentSettings.jsx", "default"],
    ["/src/pages/auth/admin/AdminDashboard.jsx", "AdminDashboard"],
    ["/src/pages/auth/instructor/InstructorDashboard.jsx", "InstructorDashboard"],
    ["/src/pages/auth/programHead/ProgramHeadDashboard.jsx", "ProgramHeadDashboard"],
    ["/src/pages/auth/programHead/ProgramHeadInstructors.jsx", "ProgramHeadInstructors"],
    ["/src/pages/auth/programHead/ProgramHeadReports.jsx", "ProgramHeadReports"],
  ];
  const originalWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, localStorage: { getItem: () => null } };
  try {
    for (const [path, name] of pages) {
      const Component = (await server.ssrLoadModule(path))[name];
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
        React.createElement(AuthProvider, null, React.createElement(Component, { user: { id: "student", name: "Student" } }))));
      assert.match(html, /data-slot="skeleton"/, `${path} must have a loading placeholder`);
      assert.match(html, /aria-busy="true"/);
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("request class loading keeps the selector unavailable until backend classes arrive", async () => {
  const ClassSection = (await server.ssrLoadModule("/src/pages/auth/student/request-form/steps/details/ClassSection.jsx")).default;
  const props = { form: { requestType: "late", classId: "" }, fieldErrors: {}, classes: [{ class_id: "class-1", subject_name: "Math" }], updateField() {} };
  const loading = renderToStaticMarkup(React.createElement(ClassSection, { ...props, classesLoading: true }));
  assert.match(loading, /data-slot="skeleton"/);
  assert.doesNotMatch(loading, /<select/);
  const ready = renderToStaticMarkup(React.createElement(ClassSection, { ...props, classesLoading: false }));
  assert.match(ready, /<select/);
  assert.match(ready, /Math/);
  assert.doesNotMatch(ready, /data-slot="skeleton"/);
});

test("final request step distinguishes uploading from submitting and prevents duplicate submission", async () => {
  const ReviewStep = (await server.ssrLoadModule("/src/pages/auth/student/request-form/steps/ReviewStep.jsx")).default;
  const { initialForm } = await server.ssrLoadModule("/src/pages/auth/student/request-form/constants.js");
  const props = { step: 6, form: { ...initialForm, requestType: "late", declaration: true }, user: { name: "Student" }, classes: [], fieldErrors: {}, submitting: true, updateField() {}, onBack() {} };
  const upload = renderToStaticMarkup(React.createElement(ReviewStep, { ...props, uploading: true }));
  assert.match(upload, /Uploading supporting document/);
  assert.match(upload, /data-slot="spinner"/);
  assert.match(upload, /<button[^>]*type="submit"[^>]*disabled=""/);
  const submit = renderToStaticMarkup(React.createElement(ReviewStep, { ...props, uploading: false }));
  assert.match(submit, /Submitting\.\.\./);
  assert.doesNotMatch(submit, /Uploading supporting document/);
});
