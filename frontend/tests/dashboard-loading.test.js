import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("student placeholders match the unequal attendance cards, gauge and three notification rows", async () => {
  const Skeleton = (await server.ssrLoadModule("/src/components/loading/DashboardSkeleton/index.js")).default;
  const html = renderToStaticMarkup(React.createElement(Skeleton, { variant: "student" }));
  assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, 3);
  assert.equal((html.match(/data-slot="notification-placeholder"/g) || []).length, 3);
  assert.match(html, /data-slot="threshold-placeholder"/);
  assert.ok(html.includes("minmax(0,2.19fr)"));
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.doesNotMatch(html, /<(button|input|a)\b/);
});

test("staff placeholders match the actual metric counts and program-head activity chart", async () => {
  const Skeleton = (await server.ssrLoadModule("/src/components/loading/DashboardSkeleton/index.js")).default;
  for (const [variant, count] of [["admin", 4], ["instructor", 4], ["program", 3]]) {
    const html = renderToStaticMarkup(React.createElement(Skeleton, { variant }));
    assert.equal((html.match(/data-slot="metric-placeholder"/g) || []).length, count);
    if (["admin", "program", "instructor"].includes(variant)) assert.match(html, /data-slot="activity-chart-placeholder"/);
    if (variant === "instructor") {
      assert.match(html, /data-slot="semester-summary-placeholder"/);
      assert.match(html, /data-slot="attendance-notice-placeholder"/);
      assert.doesNotMatch(html, /<(button|input|a)\b/);
    }
  }
});

test("authentication checks use one school-logo progress screen instead of an extra dashboard skeleton", async () => {
  const Loading = (await server.ssrLoadModule("/src/components/loading/AuthLoading.jsx")).default;
  const html = renderToStaticMarkup(React.createElement(Loading));
  assert.match(html, /La Verdad Christian College logo/);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.match(html, /data-slot="spinner"/);
  assert.match(html, /class="flex flex-col items-center gap-3"><svg/);
  const spinnerTag = html.match(/<svg\b[^>]*data-slot="spinner"[^>]*>/)?.[0];
  const spinnerClasses = spinnerTag?.match(/class="([^"]+)"/)?.[1].split(/\s+/) || [];
  assert.ok(spinnerClasses.includes("animate-spin"), "the startup spinner must rotate even when motion-safe animation is disabled");
  assert.doesNotMatch(html, /data-slot="skeleton"|data-slot="dashboard-skeleton"/);
});

test("OAuth callback and trusted-device checking show the same single authentication loader", async () => {
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  for (const [path, name, url] of [["/src/pages/AuthCallback.jsx", "AuthCallback", "/auth/callback"], ["/src/pages/OtpVerification.jsx", "default", "/verify-otp?exchange_code=isolated-check"]]) {
    const Page = (await server.ssrLoadModule(path))[name];
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(AuthProvider, null, React.createElement(Page))));
    assert.equal((html.match(/data-slot="auth-loading"/g) || []).length, 1, path);
    assert.doesNotMatch(html, /data-slot="skeleton"|data-slot="dashboard-skeleton"/, path);
  }
});

test("all live dashboard loading branches use their matching role layout", async () => {
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const originalWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, localStorage: { getItem: () => null } };
  try {
    for (const [path, name, role] of [
      ["student/StudentDashboard.jsx", "default", "student"],
      ["instructor/InstructorDashboard.jsx", "InstructorDashboard", "instructor"],
      ["admin/AdminDashboard.jsx", "AdminDashboard", "admin"],
      ["programHead/ProgramHeadDashboard.jsx", "ProgramHeadDashboard", "program"],
    ]) {
      const Page = (await server.ssrLoadModule(`/src/pages/auth/${path}`))[name];
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
        React.createElement(AuthProvider, null, React.createElement(Page))));
      assert.ok(html.includes(`data-variant="${role}"`), `${role} must render its matching placeholder`);
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
