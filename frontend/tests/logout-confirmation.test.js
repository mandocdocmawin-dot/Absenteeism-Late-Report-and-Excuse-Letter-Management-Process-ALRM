import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
before(async () => { server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" }); });
after(async () => { await server?.close(); });

test("logout confirmation presents the two actions without logging out on render", async () => {
  const { LogoutConfirmationBody } = await server.ssrLoadModule("/src/components/navigation/RoleSidebar/LogoutConfirmation.jsx");
  const { AlertDialog } = await server.ssrLoadModule("/src/components/ui/alert-dialog.jsx");
  let calls = 0;
  const html = renderToStaticMarkup(React.createElement(AlertDialog, null,
    React.createElement(LogoutConfirmationBody, { onLogout: () => { calls += 1; } })));
  assert.match(html, /Already leaving\?/);
  assert.match(html, /Yes, Log out/);
  assert.match(html, /No, I am staying/);
  assert.match(html, /LV email/);
  assert.equal(calls, 0);
});

test("only the logout confirmation action invokes the existing logout handler", async () => {
  const { LogoutConfirmationBody } = await server.ssrLoadModule("/src/components/navigation/RoleSidebar/LogoutConfirmation.jsx");
  let calls = 0;
  const nodes = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    nodes.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(LogoutConfirmationBody({ onLogout: () => { calls += 1; } }));
  const confirm = nodes.find((node) => node.props.children === "Yes, Log out");
  const cancel = nodes.find((node) => node.props.children === "No, I am staying");
  assert.equal(cancel.props.onClick, undefined);
  confirm.props.onClick();
  assert.equal(calls, 1);
});
