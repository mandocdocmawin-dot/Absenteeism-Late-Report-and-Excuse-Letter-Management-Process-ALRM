import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { mockApiFetch } from "./helpers/mockApiFetch.js";
import { getAcademicPeriod, updateAcademicPeriod } from "../src/api/academicPeriod.js";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "test-session" },
  });
  globalThis.window = new EventTarget();
});

afterEach(() => mock.restoreAll());

test("academic period uses the shared read route and admin update route", async () => {
  const requests = [];
  mockApiFetch(async (url, options) => {
    requests.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    return Response.json({ data: { semester: "2nd", school_year: "2026-2027" } });
  });

  assert.deepEqual(await getAcademicPeriod(), { semester: "2nd", school_year: "2026-2027" });
  assert.deepEqual(await updateAcademicPeriod({ semester: "2nd", school_year: "2026-2027" }), { semester: "2nd", school_year: "2026-2027" });
  assert.ok(requests[0].url.endsWith("/api/academic-period"));
  assert.deepEqual(requests[0], { ...requests[0], method: "GET", body: null });
  assert.ok(requests[1].url.endsWith("/api/admin/academic-period"));
  assert.deepEqual(requests[1].method, "PUT");
  assert.deepEqual(requests[1].body, { semester: "2nd", school_year: "2026-2027" });
});

test("academic period update rejects a response that does not confirm the requested values", async () => {
  mockApiFetch(async () => Response.json({ data: { semester: "1st", school_year: "2025-2026" } }));
  await assert.rejects(
    updateAcademicPeriod({ semester: "2nd", school_year: "2026-2027" }),
    /did not confirm/i,
  );
});

test("admin policy settings show the backend rules and editable academic period", async () => {
  const { AdminPolicyCard } = await server.ssrLoadModule("/src/pages/auth/Settings.jsx");
  const html = renderToStaticMarkup(React.createElement(AdminPolicyCard));
  for (const text of ["3 invalid late reports = 1 absence hour", "After 1 week", "After 2 weeks", "20% of semester hours, rounded up", "Save academic period"]) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /id="academic-semester"/);
  assert.match(html, /id="academic-school-year"/);
});
