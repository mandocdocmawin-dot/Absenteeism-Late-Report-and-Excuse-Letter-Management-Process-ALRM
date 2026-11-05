import assert from "node:assert/strict";
import test from "node:test";
import { resolveThresholdPresentation } from "../src/pages/auth/student/dashboard/thresholdPresentation.js";
import { programThresholdSummary, flagThresholdLabel } from "../src/pages/auth/programHead/programHeadData.js";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

test("canonical threshold states retain their server meaning", () => {
  for (const [status, label] of [["safe", "Safe"], ["warning", "Warning"], ["critical", "Critical"], ["IR", "Incident Report"]]) {
    assert.equal(resolveThresholdPresentation({ status, used: 1, limit: 4 }).label, label);
  }
});

test("canonical contact hours reaching a positive limit display Incident Report", () => {
  assert.equal(resolveThresholdPresentation({ status: "safe", used: 4, limit: 4 }).label, "Incident Report");
  assert.equal(resolveThresholdPresentation({ status: "warning", used: 5, limit: 4 }).label, "Incident Report");
  assert.equal(resolveThresholdPresentation({ used: "4", limit: "4" }).label, "Incident Report");
  assert.equal(resolveThresholdPresentation({ status: "safe", used: 0, limit: 0 }).label, "Unavailable");
  for (const used of [null, undefined, "", " ", false, -1, NaN, Infinity]) {
    assert.equal(resolveThresholdPresentation({ status: "safe", used, limit: 4 }).label, "Unavailable");
  }
  assert.equal(resolveThresholdPresentation({ status: "safe", used: 1, limit: null }).label, "Unavailable");
  assert.equal(resolveThresholdPresentation({}).label, "Unavailable");
  assert.equal(resolveThresholdPresentation({ status: "unexpected" }).label, "Unavailable");
});

test("flag threshold severity is distinct from open or resolved case status", () => {
  assert.equal(flagThresholdLabel({ threshold: "critical", status: "open" }), "Critical");
  assert.equal(flagThresholdLabel({ threshold: "IR", status: "resolved" }), "Incident Report");
  assert.equal(flagThresholdLabel({ threshold: "warning" }), "Warning");
  assert.equal(flagThresholdLabel({ status: "open" }), "Threshold unavailable");
});

test("program threshold totals preserve missing data and count enrollment cases", () => {
  assert.deepEqual(programThresholdSummary({ warning_count: 2, critical_count: 1, ir_count: 1 }), { warning: 2, critical: 1, ir: 1, total: 4 });
  assert.equal(programThresholdSummary({ warning_count: 0, critical_count: 0, ir_count: 0 }).total, 0);
  assert.equal(programThresholdSummary({ warning_count: 2 }).total, null);
  assert.equal(programThresholdSummary({ warning_count: -1 }).warning, null);
});

test("threshold UI exposes contradictions and keeps program student totals independent of request lists", async () => {
  const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{ name: "threshold-auth", enforce: "pre", transform(code, id) {
    if (id.replaceAll("\\", "/").endsWith("/src/context/AuthContext.jsx")) return "export function useAuth() { return { user: { name: 'Head' } }; }";
  } }] });
  try {
    const Student = (await server.ssrLoadModule("/src/pages/auth/student/dashboard/AttendanceThreshold.jsx")).default;
    const studentHtml = renderToStaticMarkup(React.createElement(Student, { threshold: { status: "safe", used: 4, limit: 4 } }));
    assert.match(studentHtml, /Incident Report/);
    assert.doesNotMatch(studentHtml, />Safe</);
    const Head = (await server.ssrLoadModule("/src/pages/auth/programHead/ProgramHeadOverview.jsx")).default;
    const headHtml = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Head, { dashboard: { total_students: 25, warning_count: 2, critical_count: 1, ir_count: 1 }, flags: [], requests: [] })));
    assert.match(headHtml, /Total students<\/p><p[^>]*>25</);
    assert.match(headHtml, /Attendance thresholds/);
    assert.match(headHtml, /student enrollments by class/);
    assert.match(headHtml, /Warning<\/dt><dd[^>]*>2</);
    const renderHead = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Head, { dashboard: { total_students: 25 }, flags: [], requests: [], ...props })));
    assert.match(renderHead({ dashboard: { warning_count: 0, critical_count: 0, ir_count: 0 } }), /Warning<\/dt><dd[^>]*>0</);
    assert.match(renderHead({}), /Warning<\/dt><dd[^>]*>Unavailable</);
    assert.doesNotMatch(renderHead({ errors: { dashboard: "Unavailable" } }), /id="program-threshold-title"/);
    const riskHtml = renderHead({ flags: [{ id: "flag", status: "open", threshold: "critical" }] });
    assert.match(riskHtml, /Critical/);
    assert.match(riskHtml, /Case: open/);
  } finally { await server.close(); }
});
