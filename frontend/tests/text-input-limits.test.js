import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { initialForm, LIMITS } from "../src/pages/auth/student/request-form/constants.js";
import { validateStep } from "../src/pages/auth/student/request-form/validation.js";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("shared editable text inputs default to fifty characters while specialized inputs retain their limits", async () => {
  const { Input } = await server.ssrLoadModule("/src/components/ui/input.jsx");
  const render = (props) => renderToStaticMarkup(React.createElement(Input, props));
  for (const type of [undefined, "text", "search", "email", "url", "password"]) {
    assert.match(render({ type }), /maxLength="50"/);
  }
  assert.match(render({ maxLength: 6 }), /maxLength="6"/);
  assert.match(render({ type: "tel", maxLength: 9 }), /maxLength="9"/);
  for (const type of ["number", "date", "file"]) assert.doesNotMatch(render({ type }), /maxLength/);
  const name = "A".repeat(80);
  const locked = render({ value: name, readOnly: true });
  assert.match(locked, new RegExp(`value="${name}"`));
  assert.doesNotMatch(locked, /maxLength="50"/);
});

test("shared textareas default to fifty characters but permit the explicit hundred-character reason limit", async () => {
  const { Textarea } = await server.ssrLoadModule("/src/components/ui/textarea.jsx");
  assert.match(renderToStaticMarkup(React.createElement(Textarea)), /maxLength="50"/);
  assert.equal(LIMITS.reason, 100);
  assert.match(renderToStaticMarkup(React.createElement(Textarea, { maxLength: LIMITS.reason })), /maxLength="100"/);
});

test("the request form validates fifty-character guardian names and hundred-character reasons", () => {
  assert.equal(LIMITS.guardianName, 50);
  const form = { ...initialForm, requestType: "late", guardianName: "A".repeat(50), reason: "A".repeat(100) };
  assert.equal(validateStep({ step: 3, form }).guardianName, undefined);
  assert.equal(validateStep({ step: 4, form, classes: [] }).reason, undefined);
  assert.match(validateStep({ step: 3, form: { ...form, guardianName: "A".repeat(51) } }).guardianName, /50 characters/);
  assert.match(validateStep({ step: 4, form: { ...form, reason: "A".repeat(101) }, classes: [] }).reason, /100 characters/);
});

test("the shared request updater preserves the last valid text when a value exceeds its field limit", async () => {
  const { default: useRequestForm } = await server.ssrLoadModule("/src/pages/auth/student/request-form/useRequestForm.js");
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  for (const [field, limit] of [["guardianName", 50], ["reason", 100]]) {
    let stage = 0;
    function FormProbe() {
      const request = useRequestForm();
      if (stage === 0) { stage++; request.updateField(field, "A".repeat(limit)); }
      else if (stage === 1) { stage++; request.updateField(field, "A".repeat(limit + 1)); }
      return React.createElement("span", null, request.form[field]);
    }
    assert.equal(renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(FormProbe))), `<span>${"A".repeat(limit)}</span>`);
  }
});
