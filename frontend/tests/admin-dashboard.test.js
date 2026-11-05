import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { academicTermLabel, pendingAccounts } from "../src/pages/auth/admin/dashboard/adminOverviewData.js";

test("academic terms come from classes, without inventing a current semester", () => {
  assert.equal(academicTermLabel([{ semester: "1st", school_year: "2026-2027" }]), "1st Semester, A.Y. 2026-2027");
  assert.equal(academicTermLabel([]), "College-wide overview");
  assert.equal(academicTermLabel([{ semester: "1st", school_year: "2026-2027" }, { semester: "2nd", school_year: "2026-2027" }]), "College-wide overview");
});

test("pending approvals include actual pending students and staff only", () => {
  const users = [{ id: "approved", status: "approved" }, { id: "s", name: "Zoe Student", role: "student", status: "pending" }, { id: "i", name: "Ana Instructor", role: "instructor", status: "pending" }];
  assert.deepEqual(pendingAccounts(users).map(user => user.id), ["i", "s"]);
  assert.equal(users[1].name, "Zoe Student");
});

let server, Overview;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  ({ default: Overview } = await server.ssrLoadModule("/src/pages/auth/admin/dashboard/AdminOverview.jsx"));
});
after(async () => { await server?.close(); });
const resources = { dashboard: { total_students: 110, total_instructors: 20, total_programs: 4, pending_staff_approvals: 14 }, users: [{ id: "one", name: "Ana Student", role: "student", status: "pending", year_level: "1st", program: { program_name: "Information Systems" } }], programs: [], classes: [], loading: {}, ready: {}, errors: {} };
const render = props => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Overview, { resources, onRetry() {}, ...props })));

test("overview matches the four metrics, approval preview and working navigation targets", () => {
  const html = render();
  for (const label of ["Welcome back, Admin!", "Total Students", "Total Instructors", "Total Programs", "Pending for Approval", ">110<", ">20<", ">14<", "Pending Account Approvals", "Ana Student", "Quick Access", "Manage users", "Export Report", "System Settings"]) assert.ok(html.includes(label), label);
  for (const path of ["/user-management", "/reports", "/settings", "/user-management?tab=waiting", "/user-management?tab=waiting&amp;user=one"]) assert.ok(html.includes(`href="${path}"`), path);
  assert.doesNotMatch(html, /Staff role assignment|Create class|Create program/);
  assert.match(html, /This week/);
  assert.match(html, /Last week/);
  assert.match(html, /Loading weekly reports/);
});

test("dashboard skeleton matches four cards and independently loading chart and approvals", () => {
  const html = render({ resources: { ...resources, dashboard: null, users: [], loading: { dashboard: true, users: true, programs: true, classes: true } } });
  assert.match(html, /data-slot="dashboard-skeleton"/);
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 4);
  assert.match(html, /data-slot="activity-chart-placeholder"/);
  assert.match(html, /data-slot="approval-placeholder"/);
  assert.doesNotMatch(html, />110<|Ana Student/);
});

test("admin total programs excludes General Education when program data has loaded", () => {
  const html = render({ resources: {
    ...resources,
    programs: [{ id: "ge", program_name: "General Education" }, { id: "bsis", program_name: "BS in Information Systems" }],
    ready: { programs: true },
  } });
  assert.match(html, /Total Programs<\/p><p[^>]*>1<\/p>/);
});
