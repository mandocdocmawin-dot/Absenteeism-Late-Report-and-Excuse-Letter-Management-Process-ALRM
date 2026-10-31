import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

async function renderSidebar(path = "/instructor/class-requests") {
  const Sidebar = (await server.ssrLoadModule("/src/pages/auth/instructor/InstructorSidebar.jsx")).default;
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const previous = globalThis.window;
  globalThis.window = { innerWidth: 1280, localStorage: { getItem: () => null } };
  try {
    return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AuthProvider, null, React.createElement(Sidebar))));
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

function menuLink(html, path) {
  const match = html.match(new RegExp(`<a\\b[^>]*href="${path}"[^>]*>([\\s\\S]*?)</a>`));
  assert.ok(match, `${path} must remain a navigation link`);
  return match[0];
}

test("instructor navigation uses the wireframe's dashboard, file-pencil and file-arrow icons", async () => {
  const html = await renderSidebar();
  for (const [path, icon] of [["/dashboard", "layout-dashboard"], ["/instructor/class-records", "file-pen"], ["/instructor/class-requests", "file-input"], ["/settings", "settings"]]) {
    const link = menuLink(html, path);
    assert.match(link, new RegExp(`lucide-${icon}`));
    assert.match(link, /aria-hidden="true"/);
    assert.match(link, /\[&amp;_svg\]:size-5/);
  }
  assert.doesNotMatch(html, /lucide-clipboard-list|lucide-file-text/);
});

test("the settings gear is filled with a center matching normal and selected sidebar surfaces", async () => {
  for (const path of ["/instructor/class-requests", "/settings"]) {
    const gear = menuLink(await renderSidebar(path), "/settings");
    assert.match(gear, /fill="currentColor"/);
    assert.match(gear, /\[&amp;&gt;circle\]:fill-\[var\(--sidebar-icon-bg\)\]/);
    assert.match(gear, path === "/settings" ? /\[--sidebar-icon-bg:#203b82\]/ : /\[--sidebar-icon-bg:#0d1526\]/);
  }
});

test("icon updates preserve nested-route selection, collapse controls and the logout trigger", async () => {
  const html = await renderSidebar("/instructor/class-records/class-one");
  assert.match(html, /aria-current="page"[^>]*href="\/instructor\/class-records"/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /aria-label="Toggle sidebar"/);
  assert.match(html, /data-active:bg-\[#203b82\]/);
  assert.match(html, /lucide-log-out/);
  assert.match(html, /Logout/);
  for (const label of ["Dashboard", "Class Records", "Class Requests", "Settings", "Logout"]) assert.ok(html.includes(`aria-label="${label}"`));
});
