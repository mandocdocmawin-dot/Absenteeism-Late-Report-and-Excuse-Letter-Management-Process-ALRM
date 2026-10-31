import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("table skeletons render one continuous full-width bar per row, regardless of column count", async () => {
  const Loading = (await server.ssrLoadModule("/src/components/loading/LoadingSkeleton.jsx")).default;
  for (const columns of [1, 4, 6]) {
    const html = renderToStaticMarkup(React.createElement(Loading, { variant: "table", rows: 3, columns }));
    assert.equal((html.match(/data-slot="skeleton"/g) || []).length, 3);
    assert.equal((html.match(/data-slot="skeleton-row"/g) || []).length, 3);
    assert.doesNotMatch(html, /grid-template-columns|max-w-48/);
    assert.equal((html.match(/role="status"/g) || []).length, 1);
  }
});

test("records placeholders include matching tabs, filter groups and headings without real controls", async () => {
  const Page = (await server.ssrLoadModule("/src/components/loading/TablePageSkeleton.jsx")).default;
  for (const layout of ["requests", "courses", "course-detail", "student-records"]) {
    const html = renderToStaticMarkup(React.createElement(Page, { layout, label: "Loading records" }));
    assert.match(html, /data-slot="table-page-skeleton"/);
    assert.match(html, new RegExp(`data-layout="${layout}"`));
    assert.equal((html.match(/role="status"/g) || []).length, 1);
    assert.doesNotMatch(html, /<(input|select|button|table)\b|role="tab"/);
    assert.equal(html.includes('data-slot="skeleton-tabs"'), layout !== "courses");
    assert.equal(html.includes('data-slot="skeleton-toolbar"'), layout === "requests" || layout === "student-records");
    assert.equal((html.match(/data-slot="skeleton-row"/g) || []).length, layout === "student-records" ? 10 : 8);
  }
});

test("initial request, course and student record pages replace the whole loading area, not just the table body", async () => {
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const originalWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, localStorage: { getItem: () => null } };
  try {
    const cases = [
      ["/src/pages/auth/instructor/InstructorRequests/index.js", "/instructor/class-requests", "/instructor/class-requests?type=late", "Class requests", "courses"],
      ["/src/pages/auth/instructor/InstructorRequests/index.js", "/instructor/class-requests/:classId", "/instructor/class-requests/one", "Class requests", "requests"],
      ["/src/pages/auth/instructor/InstructorClassRecords/index.js", "/instructor/class-records", "/instructor/class-records", "Class records", "courses"],
      ["/src/pages/auth/instructor/InstructorClassRecords/index.js", "/instructor/class-records/:classId", "/instructor/class-records/one", "Class records", "course-detail"],
      ["/src/pages/auth/student/StudentRecords.jsx", "/student/records", "/student/records", "My Records", "student-records"],
    ];
    for (const [path, route, initial, name, layout] of cases) {
      const Page = (await server.ssrLoadModule(path)).default;
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [initial] }, React.createElement(AuthProvider, null, React.createElement(Routes, null, React.createElement(Route, { path: route, element: React.createElement(Page) })))));
      const content = html.match(new RegExp(`<section aria-label="${name}"[^>]*>([\\s\\S]*?)</section>`))?.[1];
      assert.ok(content, `${name} section must exist`);
      assert.match(content, new RegExp(`data-layout="${layout}"`));
      assert.doesNotMatch(content, /<(input|select|button|table)\b|role="tab"|Search Name\.\.\.|Filter Subject|Filter Request|>Absent<|>Late</);
      assert.equal((content.match(/role="status"/g) || []).length, 1);
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

