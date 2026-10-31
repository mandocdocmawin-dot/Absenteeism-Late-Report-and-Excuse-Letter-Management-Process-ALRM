import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { initialForm } from "../src/pages/auth/student/request-form/constants.js";
import { normalizePhoneInput, profileDefaults } from "../src/pages/auth/student/request-form/utils.js";
import { buildRequestPayload } from "../src/pages/auth/student/request-form/buildPayload.js";
import { validateStep } from "../src/pages/auth/student/request-form/validation.js";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("contact numbers normalize ten digits and saved local numbers to the fixed +63 prefix", () => {
  for (const value of ["9123456789", "09123456789", "+639123456789", "639123456789", "09 123 456 789", "+63-912-345-6789"]) {
    assert.equal(normalizePhoneInput(value), "+639123456789");
  }
  assert.equal(normalizePhoneInput(""), "");
  assert.equal(normalizePhoneInput("letters"), "");
  assert.equal(normalizePhoneInput("12a3-45"), "+6312345");
  assert.equal(normalizePhoneInput("912345678901"), "+639123456789");
  assert.equal(normalizePhoneInput("912345678"), "+63912345678");
  assert.equal(profileDefaults({ contact_number: "09123456789" }, null).contactNumber, "+639123456789");
});

test("both form entry and final review show +63 and a ten-digit mobile input", async () => {
  const Step = (await server.ssrLoadModule("/src/pages/auth/student/request-form/steps/StudentInfoStep.jsx")).default;
  const Editor = (await server.ssrLoadModule("/src/pages/auth/student/request-form/components/RequestReviewEditor.jsx")).default;
  const props = { step: 3, form: { ...initialForm, requestType: "late", contactNumber: "09123456789" },
    user: {}, fieldErrors: {}, classes: [], updateField() {}, toggleListField() {}, handleRadioClick() {} };
  for (const Component of [Step, Editor]) {
    const html = renderToStaticMarkup(React.createElement(Component, props));
    assert.match(html, />\+63</);
    const input = html.match(/<input[^>]*name="contactNumber"[^>]*>/)?.[0];
    assert.ok(input, "the phone input retains its field name");
    for (const attribute of ['type="tel"', 'inputMode="numeric"', 'maxLength="10"', 'minLength="10"', 'pattern="9[0-9]{9}"', 'placeholder="9XX-XXX-YYYY"', 'value="9123456789"']) {
      assert.ok(input.includes(attribute), `phone input requires ${attribute}`);
    }
  }
});

test("late and absence payloads keep the complete contact number, not just its editable suffix", () => {
  for (const requestType of ["late", "absence"]) {
    const payload = buildRequestPayload({ ...initialForm, requestType, guardianName: "Alex Parent",
      contactNumber: normalizePhoneInput("9123456789"), minutesLate: "10", absenceReasons: [] }, []);
    assert.equal(payload.contact_number, "+639123456789");
  }
});

test("an incomplete suffix explains the fixed-prefix input format", () => {
  const errors = validateStep({ step: 3, form: { ...initialForm, contactNumber: "+639123" } });
  assert.match(errors.contactNumber, /10 digits after \+63.*starting with 9/);
});

test("pasting a formatted mobile number preserves all ten national digits", async () => {
  const Component = (await server.ssrLoadModule("/src/pages/auth/student/request-form/components/ContactNumberInput.jsx")).default;
  let value;
  const element = Component({ value: "", onChange(next) { value = next; } });
  const input = React.Children.toArray(element.props.children).find(child => child.props.name === "contactNumber");
  for (const text of ["+63-912-345-6789", "912-345-6789", "09123456789"]) {
    let prevented = false;
    input.props.onPaste({ clipboardData: { getData: () => text }, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(value, "+639123456789");
  }
});

test("the request summary formats the mobile number without changing the API payload", async () => {
  const Summary = (await server.ssrLoadModule("/src/pages/auth/student/request-form/components/RequestSummary.jsx")).default;
  const form = { ...initialForm, contactNumber: "+639123456789" };
  assert.match(renderToStaticMarkup(React.createElement(Summary, { form, user: {} })), /\+63-912-345-6789/);
  assert.equal(buildRequestPayload(form, []).contact_number, "+639123456789");
});
