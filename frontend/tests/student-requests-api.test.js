import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import {
  createStudentRequest,
  getStudentRequest,
  openEvidence,
  updateStudentRequest,
} from "../src/api/studentRequests.js";

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "test-session", setItem() {}, removeItem() {} },
  });
  globalThis.window = new EventTarget();
});

afterEach(() => {
  mock.restoreAll();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.localStorage;
});

function captureJsonRequest(responseBody) {
  const requests = [];
  mockApiFetch(async (url, options) => {
    requests.push({
      url: String(url),
      method: options.method || "GET",
      body: options.body ? JSON.parse(options.body) : null,
    });
    return Response.json(responseBody);
  });
  return requests;
}

function captureEvidenceViewer(type) {
  const popup = { opener: {}, location: { href: "" }, closed: false, close() { this.closed = true; } };
  const link = { click: mock.fn() };
  window.open = () => popup;
  globalThis.document = { createElement: () => link };
  mockApiFetch(async () => new Response("file bytes", { headers: { "Content-Type": type } }));
  mock.method(URL, "createObjectURL", () => "blob:test-attachment");
  mock.method(URL, "revokeObjectURL", () => {});
  mock.method(globalThis, "setTimeout", (callback) => { callback(); return 0; });
  return { popup, link };
}

test("evidence viewer downloads PDFs instead of opening them", async () => {
  const { popup, link } = captureEvidenceViewer("application/pdf");
  await openEvidence("request-one");
  assert.equal(popup.opener, null);
  assert.equal(popup.closed, true);
  assert.equal(popup.location.href, "");
  assert.equal(link.download, "attachment.pdf");
  assert.equal(link.click.mock.callCount(), 1);
});

test("evidence viewer opens allowed images without an opener", async () => {
  const { popup, link } = captureEvidenceViewer("image/jpeg");
  await openEvidence("request-one");
  assert.equal(popup.opener, null);
  assert.equal(popup.location.href, "blob:test-attachment");
  assert.equal(link.click.mock.callCount(), 0);
});

test("evidence viewer rejects HTML attachment responses", async () => {
  const { popup, link } = captureEvidenceViewer("text/html");
  await assert.rejects(openEvidence("request-one"), /Unsupported attachment/);
  assert.equal(popup.closed, true);
  assert.equal(popup.location.href, "");
  assert.equal(link.click.mock.callCount(), 0);
});

test("request edit reads proof selections from the detail endpoint", async () => {
  const record = { id: "request-one", proof_types: ["Medical Certificate"] };
  const requests = captureJsonRequest({ success: true, data: record });
  assert.deepEqual(await getStudentRequest("request-one"), record);
  assert.equal(requests[0].method, "GET");
  assert.ok(requests[0].url.endsWith("/api/requests/request-one"));
});

test("request update sends selected and cleared proofs via PATCH", async () => {
  const requests = captureJsonRequest({ success: true, data: { id: "request-one", proof_types: [] } });
  await updateStudentRequest("request-one", { reason: "Family Emergency", proof_types: ["Others"] });
  await updateStudentRequest("request-one", { reason: "Family Emergency", proof_types: [] });
  assert.equal(requests[0].method, "PATCH");
  assert.ok(requests[0].url.endsWith("/api/requests/request-one"));
  assert.deepEqual(requests[0].body.proof_types, ["Others"]);
  assert.deepEqual(requests[1].body.proof_types, []);
});

test("create and update preserve backend field errors after local validation succeeds", async () => {
  const errors = { proof_types: ["Invalid array."], "proof_types.0": ["Invalid proof label."] };
  mockApiFetch(async () => Response.json({ message: "Validation failed.", errors }, { status: 422 }));
  for (const submit of [
    () => createStudentRequest({ class_id: "class-one", type: "late", subjects_missed: "Math", minutes_late: 5, reason: "Traffic", guardian_name: "Alex Parent", contact_number: "09123456789", proof_types: [] }),
    () => updateStudentRequest("request-one", { proof_types: [] }),
  ]) {
    await assert.rejects(submit, (error) => {
      assert.equal(error.status, 422);
      assert.deepEqual(error.validationErrors, errors);
      return true;
    });
  }
});
