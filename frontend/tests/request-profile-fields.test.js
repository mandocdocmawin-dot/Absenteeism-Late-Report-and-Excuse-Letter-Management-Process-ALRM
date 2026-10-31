import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { getStoredProfileSetup } from "../src/lib/profileSetup.js";
import { initialForm } from "../src/pages/auth/student/request-form/constants.js";
import { buildInitialForm } from "../src/pages/auth/student/request-form/utils.js";
import { validateStep } from "../src/pages/auth/student/request-form/validation.js";

const user = { name: "Alex Student", email: "alex@student.laverdad.edu.ph",
  school_id_number: "2026-001", year_level: "3rd",
  program: { program_name: "Bachelor of Science in Information System" } };
const form = { ...buildInitialForm(initialForm, user, getStoredProfileSetup(user)), requestType: "late" };
let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("the shared form updater rejects typed or pasted numbers without changing the guardian name", async () => {
  const { default: useRequestForm } = await server.ssrLoadModule("/src/pages/auth/student/request-form/useRequestForm.js");
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const name = "Maria O'Neill-Santos Jr.";
  for (const invalid of ["Maria1", "Parent 123", "Maria\u0661", "Maria\uff11"]) {
    let stage = 0;
    function FormProbe() {
      const request = useRequestForm();
      if (stage === 0) {
        stage++;
        request.updateField("guardianName", name);
      } else if (stage === 1) {
        stage++;
        request.updateField("guardianName", invalid);
      }
      return React.createElement("span", null, request.form.guardianName);
    }
    const html = renderToStaticMarkup(React.createElement(AuthProvider, null, React.createElement(FormProbe)));
    assert.equal(html, "<span>Maria O&#x27;Neill-Santos Jr.</span>");
  }
});

test("submission validation also rejects non-ASCII numbers in guardian names", () => {
  const errors = validateStep({ step: 3, form: { ...initialForm, guardianName: "Parent\u0661" } });
  assert.match(errors.guardianName, /must not contain numbers/);
});

test("request initialization and reset retain the saved pre-dashboard identity", () => {
  for (const year of ["3rd", "3rd Year", "3rd year"]) {
    const account = { ...user, year_level: year };
    const fresh = buildInitialForm(initialForm, account, getStoredProfileSetup(account));
    assert.equal(fresh.studentName, "Alex Student");
    assert.equal(fresh.program, "BS in Information Systems");
    assert.equal(fresh.level, "3rd year");
  }
});

test("a saved backend program outside the fixed options is not silently erased", () => {
  const account = { ...user, program: { program_name: "Bachelor of Science in Computer Science" } };
  const fresh = buildInitialForm(initialForm, account, getStoredProfileSetup(account));
  assert.equal(fresh.program, account.program.program_name);
  assert.equal(fresh.level, "3rd year");
});

test("Step 4 shows the saved identity but prevents changing name, program or level", async () => {
  const Step = (await server.ssrLoadModule("/src/pages/auth/student/request-form/steps/StudentInfoStep.jsx")).default;
  const render = (data) => renderToStaticMarkup(React.createElement(Step, {
    step: 3, form: data, user, fieldErrors: {}, updateField() {}, handleRadioClick() {},
  }));
  const html = render(form);
  assert.match(html, /<input[^>]*readOnly=""[^>]*value="Alex Student"/);
  assert.match(html, /<fieldset[^>]*disabled=""[^>]*aria-label="Program"/);
  assert.match(html, /<fieldset[^>]*disabled=""[^>]*aria-label="Level"/);
  assert.match(html, /name="program"[^>]*checked=""[^>]*value="BS in Information Systems"/);
  assert.match(html, /name="level"[^>]*checked=""[^>]*value="3rd year"/);
  const custom = render({ ...form, program: "Bachelor of Science in Computer Science" });
  assert.match(custom, /name="program"[^>]*checked=""[^>]*value="Bachelor of Science in Computer Science"/);
});

test("the final review cannot unlock profile fields for either request type", async () => {
  const Editor = (await server.ssrLoadModule("/src/pages/auth/student/request-form/components/RequestReviewEditor.jsx")).default;
  for (const requestType of ["late", "absence"]) {
    const html = renderToStaticMarkup(React.createElement(Editor, {
      form: { ...form, requestType }, user, classes: [], updateField() {}, toggleListField() {},
    }));
    for (const name of ["studentName", "program", "level"]) {
      const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
      assert.ok(input, `${name} must be a populated input, not an editable selector`);
      assert.match(input, /readOnly=""/);
      assert.match(input, new RegExp(`value="${form[name]}"`));
    }
    const guardian = html.match(/<input[^>]*name="guardianName"[^>]*>/)?.[0];
    assert.ok(guardian);
    assert.doesNotMatch(guardian, /\s(?:readOnly|disabled)=""/);
  }
});
