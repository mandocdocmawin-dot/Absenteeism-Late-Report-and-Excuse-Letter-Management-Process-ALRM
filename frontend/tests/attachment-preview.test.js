import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { initialForm } from "../src/pages/auth/student/request-form/constants.js";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

async function renderAttachment(file = null, fieldErrors = {}, formFields = {}) {
  const Step = (await server.ssrLoadModule("/src/pages/auth/student/request-form/steps/AttachmentStep.jsx")).default;
  return renderToStaticMarkup(React.createElement(Step, { step: 5,
    form: { ...initialForm, requestType: "late", evidenceFile: file, ...formFields }, user: {},
    fieldErrors, updateField() {}, toggleListField() {},
  }));
}

test("an empty attachment area shows the drop prompt and chooser", async () => {
  const html = await renderAttachment();
  assert.match(html, /Drag and drop your file here/);
  assert.match(html, />Choose file</);
  assert.doesNotMatch(html, /aria-label="Remove file"/);
  assert.match(html, /Required/);
  const next = [...html.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)].find(([button]) => />Continue<\/button>$/.test(button));
  assert.ok(next[1].includes('disabled=""'));
});

test("a selected image replaces the drop prompt with a visible preview and file actions", async () => {
  const html = await renderAttachment(new File(["selected image"], "proof.png", { type: "image/png" }));
  assert.doesNotMatch(html, /Drag and drop your file here|>Choose file</);
  assert.match(html, /<img[^>]*alt="Preview of proof.png"/);
  for (const text of ["proof.png", ">Preview<", ">Change<", 'aria-label="Remove file"']) assert.ok(html.includes(text), text);
  const next = [...html.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)].find(([button]) => />Continue<\/button>$/.test(button));
  assert.ok(!next[1].includes('disabled=""'));
});

test("a missing required document has an accessible validation message", async () => {
  const html = await renderAttachment(null, { evidenceFile: "Upload a supporting document before continuing." });
  assert.match(html, /role="alert"/);
  assert.match(html, /Upload a supporting document before continuing\./);
  assert.match(html, /aria-invalid="true"/);
});

test("a selected PDF replaces the drop prompt with a safe document preview and download", async () => {
  const html = await renderAttachment(new File(["%PDF-1.7"], "proof.pdf", { type: "application/pdf" }));
  assert.doesNotMatch(html, /Drag and drop your file here|>Choose file</);
  assert.match(html, /aria-label="Preview of proof.pdf"/);
  assert.match(html, />Download</);
  assert.match(html, />Change</);
  assert.doesNotMatch(html, /<(iframe|embed|object)\b/);
});

test("the absence proof checklist appears above upload and retains selected proof types", async () => {
  const html = await renderAttachment(null, {}, { requestType: "absence", proof_types: ["Medical Certificate"] });
  for (const label of ["Explanation", "Supporting Documents/ Proof of Absence", "Medical Certificate", "Prescription / Medical Record", "Death Certificate / Funeral Notice", "School Activity Endorsement", "Letter from Parent/Guardian", "Others"]) assert.ok(html.includes(label), label);
  assert.ok(html.indexOf('absence-proof-heading') < html.indexOf('attachment-heading'));
  const checkboxes = [...html.matchAll(/<input\b[^>]*type="checkbox"[^>]*>/g)].map(([input]) => input);
  assert.equal(checkboxes.length, 6);
  assert.ok(checkboxes.every(input => input.includes('name="proof_types"')));
  assert.ok(checkboxes.find(input => input.includes('value="Medical Certificate"')).includes('checked=""'));
  assert.doesNotMatch(await renderAttachment(), /absence-proof-heading|Supporting Documents\/ Proof of Absence/);
});

test("the final review keeps its attachment read-only before and after Edit for both request types", async () => {
  const Summary = (await server.ssrLoadModule("/src/pages/auth/student/request-form/components/RequestSummary.jsx")).default;
  for (const requestType of ["late", "absence"]) {
    for (const editing of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(Summary, {
        form: { ...initialForm, requestType, evidenceFile: new File(["proof"], "original-proof.pdf", { type: "application/pdf" }) },
        user: {}, classes: [], editing, updateField() {}, toggleListField() {}, onFileChange() {}, onStartEdit() {},
      }));
      assert.match(html, /original-proof.pdf/);
      assert.doesNotMatch(html, /type="file"|Remove supporting document|>Change<|>Choose file</);
      // Editing other request fields remains available.
      if (editing) assert.match(html, /<input[^>]*name="guardianName"/);
    }
  }
});
