import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { generateAdminReport, downloadGeneratedReport } from "../src/api/adminReports.js";
import { mockApiFetch } from "./helpers/mockApiFetch.js";
import { reportWorkbook } from "./helpers/reportWorkbook.js";

const originalParser = globalThis.DOMParser;
afterEach(() => { mock.restoreAll(); if (originalParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = originalParser; });
test("generation reads actual Excel rows through authenticated API without downloading and snapshots filters", async () => {
  globalThis.DOMParser = DOMParser;
  const bytes = reportWorkbook([["r1", "Demo Student", "BSIS", "Math", "Demo Instructor", "absence", "2026-10-20", "2026-10-20", "Medical", "pending"]]);
  const endpoint = mockApiFetch(async () => new Response(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }));
  const filters = { date_from: "2026-10-19", date_to: "2026-10-25", program_id: "p1" };
  const result = await generateAdminReport(filters);
  filters.program_id = "p2";
  assert.equal(endpoint.mock.calls[0].arguments[0], "/api/admin/reports/export?date_from=2026-10-19&date_to=2026-10-25&program_id=p1");
  assert.equal(result.rows[0].Student, "Demo Student");
  assert.equal(result.filters.program_id, "p1");
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), bytes);
});
test("report failures retain API validation errors and reject non-Excel success responses", async () => {
  let response = Response.json({ message: "Narrow the date range." }, { status: 422 });
  mockApiFetch(async () => response);
  await assert.rejects(generateAdminReport({}), /Narrow the date range/);
  response = Response.json({ success: true });
  await assert.rejects(generateAdminReport({}), /Excel report/);
});
test("download uses the already generated blob without another network request", () => {
  const blob = new Blob(["saved snapshot"]);
  const create = mock.method(URL, "createObjectURL", value => { assert.equal(value, blob); return "blob:report"; });
  const click = mock.fn();
  const anchor = { click };
  const originalDocument = globalThis.document, originalWindow = globalThis.window;
  globalThis.document = { createElement: () => anchor };
  globalThis.window = { setTimeout: () => {} };
  try { downloadGeneratedReport({ blob }); assert.equal(anchor.href, "blob:report"); assert.equal(anchor.download, "alrm-requests-report.xlsx"); assert.equal(click.mock.callCount(), 1); assert.equal(create.mock.callCount(), 1); }
  finally { if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; }
});
