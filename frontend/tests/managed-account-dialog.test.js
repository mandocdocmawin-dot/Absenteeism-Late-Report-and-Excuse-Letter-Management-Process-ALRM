import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { MemoryRouter } from "react-router-dom";

let server, Dialog;
const account = { id: "staff1", name: "Ada Staff", email: "ada@laverdad.edu.ph", faculty_id: "FAC-100", role: "instructor", status: "approved", program_id: "p1" };
const props = {
  user: account, currentUserId: "admin", programs: [{ id: "p1", program_name: "BSIS" }],
  selectedRole: "instructor", working: false, actionError: "",
  onRoleChange() {}, onChange() {}, onClose() {},
};

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  Dialog = (await server.ssrLoadModule("/src/pages/auth/admin/ManagedAccountDialog.jsx")).default;
});
after(async () => { await server?.close(); });

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
const render = (overrides = {}) => renderToStaticMarkup(React.createElement(Dialog, { ...props, ...overrides }));
const tree = (overrides = {}) => Dialog({ ...props, ...overrides });
const action = (element, label) => nodes(element).find(node => node.props.children === label);

test("non-student details have a labeled native modal with actual account data", () => {
  const html = render();
  assert.match(html, /<dialog\b/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="managed-account-title"/);
  assert.match(html, /id="managed-account-title"/);
  for (const value of ["Ada Staff", "ada@laverdad.edu.ph", "FAC-100", "BSIS", "Instructor", "approved"]) assert.ok(html.includes(value), value);
  assert.ok(action(tree(), "Deactivate Account"));
  assert.equal(action(tree(), "Approve"), undefined);
});

test("status actions send the existing mutation field and value for each account state", () => {
  for (const [status, label, value] of [["approved", "Deactivate Account", "deactivated"], ["pending", "Approve Account", "approved"], ["deactivated", "Activate Account", "approved"], ["inactive", "Activate Account", "approved"]]) {
    const changes = [];
    const element = tree({ user: { ...account, status }, onChange: (...args) => changes.push(args) });
    action(element, label).props.onClick();
    assert.deepEqual(changes, [["status", value]]);
  }
  assert.match(render({ user: { ...account, status: "pending" } }), /first Google sign-in/);
});

test("pending accounts have a green approval action and a non-destructive decline action", () => {
  const changes = [];
  const element = tree({ user: { ...account, status: "pending" }, onChange: (...args) => changes.push(args) });
  const approve = action(element, "Approve Account");
  const decline = action(element, "Decline");
  assert.match(approve.props.className, /bg-green-600/);
  approve.props.onClick();
  decline.props.onClick();
  assert.deepEqual(changes, [["status", "approved"], ["status", "deactivated"]]);
  assert.equal(action(element, "Delete Account"), undefined);
});

test("account roles are read-only and the modal has no role assignment controls", () => {
  for (const role of ["student", "instructor", "program_head", "administrator"]) {
    const html = render({ user: { ...account, role } });
    assert.doesNotMatch(html, /Assign role|<select/);
    assert.match(html, /Role/);
    assert.match(html, /Deactivate Account/);
  }
});

test("self accounts and missing sessions expose details without mutation controls", () => {
  for (const currentUserId of ["staff1", null]) {
    const element = tree({ currentUserId });
    assert.equal(action(element, "Deactivate Account"), undefined);
    assert.equal(action(element, "Assign role"), undefined);
    assert.ok(render({ currentUserId }).includes("ada@laverdad.edu.ph"));
  }
  assert.match(render({ user: { ...account, id: 42 }, currentUserId: "42" }), /cannot change your own/);
});

test("students use the same modal with their academic details and status action", () => {
  const student = { ...account, role: "student", school_id_number: "2026-001", year_level: "3rd", section: "BSIS 3" };
  const html = render({ user: student });
  assert.match(html, /<dialog\b/);
  for (const value of ["2026-001", "BSIS", "Year/Section", "3rd / BSIS 3", "Deactivate Account"]) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Assign role|<select/);
  const changes = [];
  action(tree({ user: { ...student, status: "pending" }, onChange: (...args) => changes.push(args) }), "Approve Account").props.onClick();
  assert.deepEqual(changes, [["status", "approved"]]);
});

test("missing account fields use existing fallbacks", () => {
  const html = render({ user: { id: "staff2", role: "program_head", status: "approved" } });
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /undefined|null/);
});

test("save errors stay in the dialog and saving disables every control and dismissal", () => {
  assert.match(render({ actionError: "The server could not approve this account." }), /role="alert"/);
  assert.ok(render({ actionError: "The server could not approve this account." }).includes("The server could not approve this account."));
  let closed = 0, prevented = 0;
  const element = tree({ working: true, selectedRole: "program_head", onClose: () => closed++ });
  assert.equal(element.props["aria-busy"], true);
  for (const node of nodes(element).filter(node => node.type === "select" || node.props.onClick && node !== element)) assert.equal(node.props.disabled, true);
  element.props.onCancel({ preventDefault: () => prevented++ });
  element.props.onClose({ currentTarget: { open: false } });
  element.props.onClick({ target: "backdrop", currentTarget: "backdrop" });
  assert.equal(prevented, 1);
  assert.equal(closed, 0);
  assert.match(render({ working: true }), /Saving account change/);
});

test("native modal lifecycle stays stable across updates and dismisses only when allowed", () => {
  let opened = 0, closed = 0, dismissed = 0;
  const element = tree({ onClose: () => dismissed++ });
  const dialog = { open: false, showModal() { opened++; this.open = true; }, close() { closed++; this.open = false; } };
  const cleanup = element.props.ref(dialog);
  assert.equal(opened, 1);
  assert.equal(element.props.ref, tree({ working: true }).props.ref);
  element.props.onClick({ target: "content", currentTarget: "dialog" });
  element.props.onClose({ currentTarget: { open: true } });
  assert.equal(dismissed, 0);
  element.props.onCancel({ preventDefault() {} });
  assert.equal(dismissed, 1);
  cleanup();
  assert.equal(closed, 1);
  element.props.onClose({ currentTarget: dialog });
  assert.equal(dismissed, 2);
});

test("a waiting-account deep link keeps the loading state without exposing stale account actions", async () => {
  const Page = (await server.ssrLoadModule("/src/pages/auth/admin/AdminUserManagement.jsx")).default;
  const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
  const html = renderToStaticMarkup(React.createElement(AuthProvider, null,
    React.createElement(MemoryRouter, { initialEntries: ["/admin/user-management?tab=waiting&user=42"] }, React.createElement(Page))));
  assert.match(html, /aria-current="page"[^>]*>Waiting for Approval/);
  assert.match(html, /aria-label="Loading users"/);
  assert.doesNotMatch(html, /<dialog\b|Deactivate Account|Assign role/);
});
