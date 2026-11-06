import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server, Home, Preview, AuthContext, setPendingLogin, setPendingOtpSession, clearPendingOtp;
before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false }, appType: "custom",
    plugins: [{ name: "landing-auth-context", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/context/AuthContext.jsx")) return `${code}\nexport { AuthContext as TestAuthContext };`;
    } }],
  });
  ({ TestAuthContext: AuthContext } = await server.ssrLoadModule("/src/context/AuthContext.jsx"));
  ({ default: Home } = await server.ssrLoadModule("/src/pages/Home.jsx"));
  ({ default: Preview } = await server.ssrLoadModule("/src/pages/landing/StudentDashboardPreview.jsx"));
  ({ setPendingLogin, setPendingOtpSession, clearPendingOtp } = await server.ssrLoadModule("/src/api/otp.js"));
});
after(async () => { await server?.close(); });

function render(Component, session = {}) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(AuthContext.Provider, { value: { user: null, loading: false, sessionError: "", ...session } }, React.createElement(Component))));
}

test("anonymous home exposes reference sections and sign-in without requiring a session", () => {
  const html = render(Home);
  assert.match(html, /Absence and late reports,/);
  assert.match(html, /handled online\./);
  for (const id of ["features", "roles", "how-it-works", "departments"]) {
    assert.ok(html.includes(`href="#${id}"`), id);
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /href="\/login"/);
  assert.match(html, /Sign in with Google/);
  assert.match(html, /La Verdad Christian College/);
  assert.match(html, /BSSW/);
  assert.doesNotMatch(html, /DSSW/);
  assert.match(html, /Privacy Policy/);
  assert.match(html, /Data Privacy Notice/);
});

test("public preview renders actual student dashboard empty states without account identity", () => {
  const html = render(Preview);
  for (const text of ["Absences Recorded", "Lates Recorded", "Overall Attendance", "Unavailable", "Recent Notifications", "No recent request updates."]) assert.ok(html.includes(text), text);
  assert.match(html, /Student dashboard preview with anonymous empty data/);
  assert.doesNotMatch(html, /<figcaption/);
  assert.match(html, /inert=""/);
  assert.doesNotMatch(html, /MAC ROBERT|MARWIN|ANGELENE|@student\.|dashboard-skeleton|Loading student dashboard/);
});

test("anonymous home stays visible while session restoration is pending", () => {
  const html = render(Home, { loading: true });
  assert.match(html, /handled online/);
  assert.match(html, /href="\/login"/);
  assert.doesNotMatch(html, /Loading ALRM System|dashboard-skeleton/);
});

test("a session-check outage does not block the anonymous home", () => {
  const html = render(Home, { sessionError: "We could not reach your account. Please try again." });
  assert.match(html, /handled online/);
  assert.doesNotMatch(html, /Service Unavailable|dashboard-skeleton/);
});

test("a confirmed account keeps the protected root redirect", () => {
  const html = render(Home, { user: { id: "student-one", role: "student" } });
  assert.doesNotMatch(html, /handled online|landing-page/);
});

test("an unexpired pending OTP keeps the existing verification flow at the root", () => {
    const originalStorage = globalThis.sessionStorage;
    const items = new Map();
    globalThis.sessionStorage = {
      getItem: key => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, String(value)),
      removeItem: key => items.delete(key),
    };
    setPendingLogin("pending-test-otp");
    setPendingOtpSession({ userId: "student-one", email: "student@example.test" });
    try {
      const html = render(Home);
      assert.doesNotMatch(html, /handled online|Key features|Anonymous preview/);
    } finally {
      clearPendingOtp();
      if (originalStorage === undefined) delete globalThis.sessionStorage;
      else globalThis.sessionStorage = originalStorage;
    }
  });
