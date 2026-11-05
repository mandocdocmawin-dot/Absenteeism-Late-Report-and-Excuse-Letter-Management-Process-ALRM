import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server, Context, Overview, AdminLog, ProgramLog, ProgramAccess, AdminReports;
const request = { id: "r1", type: "absence", status: "pending", date_submitted: "2026-10-01T10:00:00Z", enrollment: { student: { name: "Test Student" }, class: { id: "c1", subject_name: "Test Class", instructor: { name: "Test Instructor" } } } };
const data = {
  getAdminDashboard: { total_programs: 1, total_students: 12, warning_count: 1, ir_count: 1, pending_requests: 1, programs_summary: [{ id: "p1", program_name: "BSIS", student_count: 12 }], recent_flags: [{ id: "f1", flagged_date: "2026-10-01", request }] },
  getAdminAuditLogs: [{ id: "audit-one", action: "decided_request_approved", description: "Approved a request", timestamp: "2026-10-02T10:00:00Z", actor: { id: "i1", name: "Audit Instructor", role: "instructor" }, request: { id: "r1", type: "absence", student: { id: "s1", name: "Audit Student" }, class: { id: "c1", subject_name: "Audit Class", program_id: "p1", instructor_id: "i1" } } }],
  getProgramHeadAuditLogs: [{ id: "program-audit-one", action: "followed_up_request", description: "Followed up a request", timestamp: "2026-10-03T10:00:00Z", actor: { id: "s2", name: "Program Audit Actor", role: "student" }, request: { id: "r2", type: "late", student: { id: "s2", name: "Program Audit Student" }, class: { id: "c2", subject_name: "Program Audit Class", program_id: "p1", instructor_id: "i1" } } }],
  loadClasses: [{ id: "c1", program_id: "p1", instructor_id: "i1", instructor: { name: "Test Instructor" } }],
  loadRequests: [request], loadFlags: [{ id: "f1", flagged_date: "2026-10-01", request: { ...request, enrollment: { ...request.enrollment, class: { id: "c1", subject_name: "Test Class" } } } }],
};
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{ name: "figma-resource-states", enforce: "pre", transform(code, id) {
    if (id.replaceAll("\\", "/").endsWith("/src/hooks/useApiResource.js")) return `import { createContext, useContext } from 'react'; export const TestResourceContext = createContext(null); export function useApiResource(load) { return useContext(TestResourceContext)(load.name); }`;
    if (id.replaceAll("\\", "/").endsWith("/src/context/AuthContext.jsx")) return `export function useAuth() { return { user: { id: 'instructor-test', role: 'instructor' } }; }`;
  } }] });
  ({ TestResourceContext: Context } = await server.ssrLoadModule("/src/hooks/useApiResource.js"));
  ({ default: Overview } = await server.ssrLoadModule("/src/pages/auth/admin/AdminProgramOverview.jsx"));
  ({ default: AdminLog } = await server.ssrLoadModule("/src/pages/auth/admin/AdminActivityLog.jsx"));
  ({ default: ProgramLog } = await server.ssrLoadModule("/src/pages/auth/programHead/ProgramHeadActivityLog.jsx"));
  ({ default: ProgramAccess } = await server.ssrLoadModule("/src/routes/ProgramHeadAccess.jsx"));
  ({ default: AdminReports } = await server.ssrLoadModule("/src/pages/auth/admin/reports/AdminReports.jsx"));
});
after(async () => { await server?.close(); });
function render(Page, path = "/", loading = false) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Context.Provider, { value: name => ({ data: loading ? null : data[name], loading, error: "", reload() {} }) }, React.createElement(Page))));
}
test("overview renders only database-backed program row values", () => {
  const html = render(Overview);
  assert.match(html, /Program Overview/);
  assert.match(html, />12</);
  for (const heading of ["Department", "Students", "Classes", "Instructors"]) assert.match(html, new RegExp(`>${heading}<`));
  assert.doesNotMatch(html, /No data yet|Students at Risk/);
  assert.doesNotMatch(html, /<th[^>]*>Pending Requests<\/th>/);
  const managePrograms = html.match(/<a\b[^>]*>Manage programs<\/a>/)?.[0];
  assert.ok(managePrograms);
  assert.match(managePrograms, /bg-\[#172f6b\]/);
  assert.match(managePrograms, /text-white/);
  assert.match(html, /href="\/programs"/);
});
test("administrator activity renders real recent flags without the informational notice", () => {
  const html = render(AdminLog);
  assert.doesNotMatch(html, /up to ten recent escalations|Full submission, follow-up, and decision audit history|bg-blue-50|border-blue-200/);
  assert.match(html, /Audit Student/);
  assert.match(html, /Audit Instructor/);
  assert.match(html, />Approved</);
  assert.match(html, />Instructor</);
  assert.match(html, /aria-label="Search activity"/);
  assert.match(html, /aria-label="Filter activity"/);
  assert.match(html, />Clear filters<\/button>/);
  assert.doesNotMatch(html, /<select|>Refresh<\/button>/);
});
test("program head activity renders its scoped audit log", () => {
  const html = render(ProgramLog, "/program-head/activity-log");
  assert.match(html, /Program Audit Student/);
  assert.match(html, /Program Audit Actor/);
  assert.match(html, />Followed up</);
  assert.match(html, />Instructor</);
  assert.doesNotMatch(html, /role="tab"|Flagged by|<select/);
});
test("administrator report status filter omits noted", () => {
  const html = renderToStaticMarkup(React.createElement(AdminReports, { programs: [] }));
  for (const status of ["All statuses", "Pending", "Approved", "Invalid"]) assert.match(html, new RegExp(`>${status}<`));
  assert.doesNotMatch(html, /<option value="noted">Noted<\/option>/);
});
test("activity loading replaces filters and rows with skeletons", () => {
  const html = render(AdminLog, "/activity-log", true);
  assert.match(html, /Loading activity/);
  assert.match(html, /data-slot="skeleton-row"/);
  assert.doesNotMatch(html, /<select|Test Student/);
});
test("instructor program access waits for server membership and never renders denied content", () => {
  function gate(resource) {
    return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Context.Provider, { value: () => ({ data: null, loading: false, error: "", reload() {}, ...resource }) }, React.createElement(ProgramAccess, null, React.createElement("p", null, "PROGRAM CONTENT")))));
  }
  assert.match(gate({ data: true }), /PROGRAM CONTENT/);
  assert.doesNotMatch(gate({ data: false }), /PROGRAM CONTENT/);
  assert.match(gate({ loading: true }), /Checking program access/);
  assert.doesNotMatch(gate({ loading: true }), /PROGRAM CONTENT/);
  assert.match(gate({ error: "Network unavailable" }), /Retry program access/);
  assert.doesNotMatch(gate({ error: "Network unavailable" }), /PROGRAM CONTENT/);
});
