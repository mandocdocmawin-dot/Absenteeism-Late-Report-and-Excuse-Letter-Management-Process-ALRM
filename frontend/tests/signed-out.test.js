import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { getPostLoginPath, rememberAuthenticatedPage } from "../src/api/authSecurity.js";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom",
  plugins: [{ name: "public-auth-test-context", enforce: "pre", transform(code, id) {
    if (id.replaceAll("\\", "/").endsWith("/src/context/AuthContext.jsx")) return `${code}\nexport { AuthContext as TestAuthContext };`;
  } }],
}); });
after(async () => { await server?.close(); });

test("the signed-out page shows the current school branding and a link back to the existing login", async () => {
  const Page = (await server.ssrLoadModule("/src/pages/auth/SignedOut/index.js")).default;
  const { TestAuthContext } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/signed-out"] },
    React.createElement(TestAuthContext.Provider, { value: { user: null, loading: false, sessionError: "" } }, React.createElement(Page))));
  assert.match(html, /You&#x27;ve been signed out/);
  assert.match(html, /Thanks for using the system/);
  assert.match(html, /LV_Logo\.png/);
  assert.match(html, /LV_Picture\.jpg/);
  assert.match(html, /alt="La Verdad Christian College logo"/);
  assert.match(html, /<a[^>]*href="\/login"[^>]*>/);
  assert.match(html, /Sign in again/);
});

test("confirmed logout starts the existing request and navigates without waiting on the network", async () => {
  const { logoutToSignedOut } = await import("../src/lib/logout.js");
  const actions = [];
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const result = logoutToSignedOut(() => { actions.push("logout"); return pending; },
    (path, options) => actions.push({ path, options }));
  assert.deepEqual(actions, ["logout", { path: "/signed-out", options: { replace: true } }]);
  let completed = false;
  result.then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  finish();
  await result;
  assert.equal(completed, true);
});

test("mobile signed-out Google sign-in starts the existing same-origin OAuth flow", async () => {
  const Message = (await server.ssrLoadModule("/src/pages/auth/SignedOut/SignedOutMessage.jsx")).default;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.window = { location: { origin: "http://localhost:5173", href: "http://localhost:5173/signed-out" } };
  function findButton(element) {
    if (!React.isValidElement(element)) return null;
    if (element.type === "button") return element;
    return React.Children.toArray(element.props.children).map(findButton).find(Boolean);
  }
  try {
    const button = findButton(Message());
    assert.ok(button, "the mobile signed-out page provides a sign-in action");
    button.props.onClick();
    const destination = new URL(window.location.href);
    assert.equal(destination.origin, "http://localhost:5173");
    assert.equal(destination.pathname, "/api/auth/google/redirect");
    assert.equal(destination.searchParams.get("origin"), "http://localhost:5173");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
});

test("the public login retains Google sign-in and the current school assets", async () => {
  const Login = (await server.ssrLoadModule("/src/pages/login.jsx")).default;
  const { TestAuthContext } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/login"] }, React.createElement(TestAuthContext.Provider, { value: { user: null, loading: false, sessionError: "" } }, React.createElement(Login))));
  assert.match(html, /Sign in with Google/);
  assert.match(html, /Welcome Back!/);
  assert.match(html, /data-slot="card-description"[^>]*class="[^"]*\btext-center\b[^"]*"[^>]*>Sign in with your La Verdad Christian College account\.<\/div>/);
  assert.match(html, /alt="La Verdad Christian College logo"/);
  assert.match(html, /LV_Picture\.jpg/);
  assert.doesNotMatch(html, /type="password"/);
});

test("confirmed logout explicitly identifies the destination before the route guard sees an empty session", async () => {
  const { logoutToSignedOut } = await import("../src/lib/logout.js");
  let options;
  await logoutToSignedOut((value) => { options = value; return Promise.resolve(); }, () => {});
  assert.deepEqual(options, { redirectToSignedOut: true });
});

test("signed-out URLs cannot replace the remembered dashboard destination", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } });
  const user = { id: "student-1", role: "student", program_id: "program-1", year_level: "3rd", school_id_number: "2026-001" };
  try {
    rememberAuthenticatedPage(user, "/student/records");
    rememberAuthenticatedPage(user, "/signed-out");
    assert.equal(getPostLoginPath(user), "/student/records");
    values.set("alrm_last_page:student-1", "/signed-out");
    assert.equal(getPostLoginPath(user), "/dashboard");
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", originalStorage);
  }
});

test("the public route and every active role sidebar use the signed-out destination", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /<Route path="\/signed-out" element=\{<SignedOut \/>\} \/>/);
  for (const path of ["pages/auth/student/StudentSidebar.jsx", "pages/auth/instructor/InstructorSidebar.jsx", "pages/auth/admin/Sidebar.jsx", "components/navigation/RoleSidebar/RoleSidebar.jsx"]) {
    const source = await readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
    assert.match(source, /return logoutToSignedOut\(logout, navigate\)/, path);
  }
});
