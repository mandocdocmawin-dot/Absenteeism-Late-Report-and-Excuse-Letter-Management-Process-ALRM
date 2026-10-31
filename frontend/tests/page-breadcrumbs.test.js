import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

async function render(items) {
  assert.ok(existsSync(new URL("../src/components/navigation/PageBreadcrumbs/PageBreadcrumbs.jsx", import.meta.url)), "nested role pages need a shared breadcrumb component");
  const Breadcrumbs = (await server.ssrLoadModule("/src/components/navigation/PageBreadcrumbs/PageBreadcrumbs.jsx")).default;
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Breadcrumbs, { items })));
}

test("breadcrumbs link ancestors and announce only the last item as the current page", async () => {
  const html = await render([{ label: "Class Records", to: "/instructor/class-records" }, { label: "Courses", to: "/instructor/class-records?subject=finance" }, { label: "Financial Literacy & Personal Management" }]);
  assert.match(html, /<nav[^>]*aria-label="Breadcrumb"/);
  assert.match(html, /<ol/);
  assert.match(html, /href="\/instructor\/class-records\?subject=finance"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /<span[^>]*aria-current="page"[^>]*>Financial Literacy &amp; Personal Management<\/span>/);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /aria-hidden="true"/);
});

test("single-level pages do not gain redundant breadcrumbs", async () => {
  assert.equal(await render([]), "");
  assert.equal(await render([{ label: "Dashboard" }]), "");
});

test("breadcrumbs wrap long labels without truncating the current page name", async () => {
  const label = "Applications Development and Emerging Technologies ".repeat(3);
  const html = await render([{ label: "Courses", to: "/instructor/class-records" }, { label }]);
  assert.ok(html.includes(label));
  assert.match(html, /flex-wrap/);
  assert.match(html, /break-words/);
  assert.doesNotMatch(html, /truncate/);
});

test("all existing nested role pages use the shared breadcrumb instead of duplicate back links", async () => {
  for (const file of ["instructor/InstructorClassRecords/InstructorClassRecords.jsx", "admin/StudentProfile.jsx", "admin/AdminUserForm.jsx", "programHead/ProgramHeadInstructors.jsx"]) {
    const source = await readFile(new URL(`../src/pages/auth/${file}`, import.meta.url), "utf8");
    assert.match(source, /<PageBreadcrumbs\s/, file);
    assert.doesNotMatch(source, /ArrowLeft|Back to Students/, file);
  }
  for (const [file, label] of [["AddStudent", "Students"], ["AddInstructor", "Instructors"]]) {
    const source = await readFile(new URL(`../src/pages/auth/admin/${file}.jsx`, import.meta.url), "utf8");
    assert.ok(source.includes(`parentLabel="${label}"`));
  }
});
