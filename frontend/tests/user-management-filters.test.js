import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server, Filters, Options;
const props = { filters: { tab: "approved", role: "student", program: "p1", year: "3", status: "approved" }, programs: [{ id: "p1", program_name: "Information Systems" }], onChange() {} };
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  ({ default: Filters, UserFilterOptions: Options } = await server.ssrLoadModule("/src/pages/auth/admin/UserManagementFilters.jsx"));
});
after(async () => { await server?.close(); });
const renderOptions = (filters = {}, options = {}) => renderToStaticMarkup(React.createElement(Options, { ...props, ...options, filters: { ...props.filters, ...filters } }));

test("the filter icon is a labeled popover trigger with no toolbar selects", () => {
  const html = renderToStaticMarkup(React.createElement(Filters, props));
  assert.match(html, /aria-label="Filter users"/);
  assert.match(html, /lucide-funnel/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /<select/);
  for (const label of ["Remove role filter", "Remove program filter", "Remove year filter"]) assert.ok(html.includes(`aria-label="${label}"`));
  assert.match(html, /Role: Student/);
  assert.match(html, /Year: 3rd year/);
  assert.match(html, /Program: Information Systems/);
});

test("radio choices expose roles, actual programs, student years and account status", () => {
  const html = renderOptions();
  for (const text of ["All roles", "Student", "Instructor", "Program Head", "Administrator", "All programs", "Information Systems", "All years", "1st year", "4th year", "Unassigned", "Approved accounts", "Deactivated accounts"]) assert.ok(html.includes(text), text);
  const radios = [...html.matchAll(/<input\b[^>]*type="radio"[^>]*>/g)].map(([input]) => input);
  assert.ok(radios.find(input => input.includes('name="user-filter-year"') && input.includes('value="3"')).includes('checked=""'));
  assert.doesNotMatch(renderOptions({ role: "instructor", tab: "waiting" }), /user-filter-year|user-filter-status/);
});

test("General Education is absent from admin program filters", () => {
  const html = renderOptions({}, { programs: [...props.programs, { id: "ge", program_name: "General Education" }] });
  assert.doesNotMatch(html, /General Education/);
  assert.match(html, /Information Systems/);
});

test("unavailable programs remain labeled and all-program reset stays usable", () => {
  const html = renderOptions({}, { programError: "Unavailable" });
  assert.match(html, /Programs could not be loaded/);
  const radios = [...html.matchAll(/<input\b[^>]*name="user-filter-program"[^>]*>/g)].map(([input]) => input);
  assert.ok(radios.find(input => input.includes('value="p1"')).includes('disabled=""'));
  assert.ok(!radios.find(input => input.includes('value=""')).includes('disabled=""'));
});
