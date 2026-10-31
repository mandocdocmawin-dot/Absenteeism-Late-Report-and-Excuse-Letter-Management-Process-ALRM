import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("admin navigation matches the reference menu without separate directory shortcuts", async () => {
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const Sidebar = (await server.ssrLoadModule("/src/pages/auth/admin/Sidebar.jsx")).default;
  const previousWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, localStorage: { getItem: () => null } };
  try {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/user-management"] }, React.createElement(AuthProvider, null, React.createElement(Sidebar))));
    const links = [...html.matchAll(/<a\b[^>]*aria-label="([^"]+)"[^>]*>/g)];
    assert.deepEqual(links.map(([, label]) => label), ["Dashboard", "User Management", "Program Overview", "Activity Log", "Manage", "Report", "Settings"]);
    for (const path of ["/dashboard", "/user-management", "/program-overview", "/activity-log", "/manage", "/reports", "/settings"]) assert.ok(links.some(([link]) => link.includes(`href="${path}"`)), path);
    assert.match(html, /aria-current="page"[^>]*href="\/user-management"/);
    const userManagement = html.match(/<a\b[^>]*href="\/user-management"[^>]*>[\s\S]*?<\/a>/)[0];
    assert.match(userManagement, /lucide-users-round/);
    assert.match(html, /aria-label="Logout"/);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("all role headers center the brand with a consistent logo gap and fitting sizes", async () => {
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const originalWindow = globalThis.window;
  globalThis.window = { innerWidth: 1280, localStorage: { getItem: () => null } };
  try {
    for (const [role, path] of [
      ["admin", "admin/AdminPageLayout.jsx"], ["student", "student/StudentPageLayout.jsx"],
      ["instructor", "instructor/InstructorPageLayout.jsx"], ["program", "programHead/ProgramHeadPageLayout.jsx"],
    ]) {
      const Layout = (await server.ssrLoadModule(`/src/pages/auth/${path}`)).default;
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AuthProvider, null, React.createElement(Layout))));
      const brand = html.match(/<(?:button|div)\b[^>]*data-slot="sidebar-brand"[^>]*>[\s\S]*?<\/(?:button|div)>/)?.[0];
      assert.ok(brand, `${role} brand header must exist`);
      const classes = brand.match(/class="([^"]+)"/)[1].split(/\s+/);
      assert.ok(classes.includes("justify-center"), `${role} brand should have balanced side spacing`);
      assert.ok(classes.includes("gap-3"), `${role} logo and name need a 12px gap`);
      assert.match(brand, /size-12/);
      assert.match(brand, /text-\[20px\]/);
      assert.match(brand, /font-semibold/);
      const links = [...html.matchAll(/<a\b[^>]*aria-label="[^"]+"[^>]*>[\s\S]*?<\/a>/g)];
      assert.ok(links.length, `${role} must retain labeled navigation links`);
      for (const [link] of links) assert.doesNotMatch(link, /<button\b|role="button"/, `${role} navigation must not have nested buttons`);
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
