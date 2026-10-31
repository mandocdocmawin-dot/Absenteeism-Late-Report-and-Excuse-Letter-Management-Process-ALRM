import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server, Sidebar, SidebarProvider, useSidebar, Context, Brand;
const originalWindow = globalThis.window;
before(async () => {
  globalThis.window = { innerWidth: 1280, matchMedia: () => ({ matches: true }) };
  server = await createServer({
    server: { middlewareMode: true, ws: false }, appType: "custom",
    plugins: [{ name: "sidebar-test-context", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/components/ui/sidebar.jsx")) return `${code}\nexport { SidebarContext as TestSidebarContext };`;
    } }],
  });
  ({ Sidebar, SidebarProvider, useSidebar, TestSidebarContext: Context } = await server.ssrLoadModule("/src/components/ui/sidebar.jsx"));
  ({ default: Brand } = await server.ssrLoadModule("/src/components/navigation/RoleSidebar/SidebarBrand.jsx"));
});
after(async () => {
  await server?.close();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

function capture(Component, state = {}) {
  const changes = [];
  let element;
  function Capture() { element = Component({ collapsible: "icon" }); return element; }
  renderToStaticMarkup(React.createElement(Context.Provider, { value: {
    isMobile: false, hoverEnabled: true, state: "collapsed", openMobile: false,
    setOpen: value => changes.push(value), setOpenMobile() {}, ...state,
  } }, React.createElement(Capture)));
  return { element, changes };
}

function mountDesktop(element, hovered) {
  element.props.ref({
    querySelector() { throw new Error("Mounting must not resize the sidebar to detect hover"); },
    matches: selector => hovered && selector === ":hover",
  });
}

test("a replacement provider is expanded on its first render when the outgoing sidebar is hovered", () => {
  const previousDocument = globalThis.document;
  let current;
  globalThis.document = { querySelector: selector => selector === '[data-slot="sidebar"]:hover' ? {} : null };
  function Inspect() { current = useSidebar(); return null; }
  try {
    renderToStaticMarkup(React.createElement(SidebarProvider, null, React.createElement(Inspect)));
    assert.equal(current.open, true);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("desktop sidebars start collapsed and enable hover for mouse devices", () => {
  let current;
  function Inspect() { current = useSidebar(); return null; }
  renderToStaticMarkup(React.createElement(SidebarProvider, null, React.createElement(Inspect)));
  assert.equal(current.open, false);
  assert.equal(current.hoverEnabled, true);
});

test("pointer entry expands and exit collapses even after pointer-focused navigation", () => {
  const { element, changes } = capture(Sidebar);
  assert.equal(typeof element.props.onPointerEnter, "function");
  element.props.onPointerEnter({ pointerType: "mouse" });
  element.props.onPointerLeave({ currentTarget: { querySelector: () => null } });
  assert.deepEqual(changes, [true, false]);
});

test("a remounted sidebar restores stationary hover and stays open through navigation blur", () => {
  const previous = capture(Sidebar);
  previous.element.props.onPointerEnter({ pointerType: "mouse" });
  assert.deepEqual(previous.changes, [true]);

  const { element, changes } = capture(Sidebar, { state: "expanded" });
  assert.equal(typeof element.props.ref, "function");
  mountDesktop(element, true);
  assert.deepEqual(changes, []);
  element.props.onBlurCapture({ relatedTarget: null, currentTarget: { contains: () => false } });
  assert.deepEqual(changes, []);
  element.props.onPointerLeave({ pointerType: "mouse", currentTarget: { querySelector: () => null } });
  assert.deepEqual(changes, [false]);
});

test("mounting outside hover does not open the sidebar or restore an old hover", () => {
  const { element, changes } = capture(Sidebar);
  assert.equal(typeof element.props.ref, "function");
  mountDesktop(element, false);
  element.props.ref(null);
  assert.deepEqual(changes, []);
});

test("devices without desktop hover do not probe or expand the sidebar on mount", () => {
  const { element, changes } = capture(Sidebar, { hoverEnabled: false });
  element.props.ref({ matches() { throw new Error("Hover must not be probed"); } });
  assert.deepEqual(changes, []);
});

test("keyboard focus still protects a restored hover until both pointer and focus leave", () => {
  const { element, changes } = capture(Sidebar, { state: "expanded" });
  mountDesktop(element, true);
  element.props.onPointerLeave({ pointerType: "mouse", currentTarget: { querySelector: () => ({}) } });
  assert.deepEqual(changes, []);
  element.props.onBlurCapture({ relatedTarget: {}, currentTarget: { contains: () => true } });
  assert.deepEqual(changes, []);
  element.props.onBlurCapture({ relatedTarget: null, currentTarget: { contains: () => false } });
  assert.deepEqual(changes, [false]);
});

test("touch pointer entry does not activate desktop hover expansion", () => {
  const { element, changes } = capture(Sidebar);
  assert.equal(typeof element.props.onPointerEnter, "function");
  element.props.onPointerEnter({ pointerType: "touch" });
  assert.deepEqual(changes, []);
});

test("a hybrid-device touch tap stays expanded after its pointer leaves", () => {
  const { element, changes } = capture(Sidebar);
  const brand = capture(Brand, { toggleSidebar: () => changes.push(true) }).element;
  element.props.onPointerEnter({ pointerType: "touch" });
  brand.props.onPointerUp({ pointerType: "touch" });
  element.props.onPointerLeave({ pointerType: "touch", currentTarget: { querySelector: () => null } });
  assert.deepEqual(changes, [true]);
});

test("keyboard focus keeps the sidebar open until focus leaves it", () => {
  const { element, changes } = capture(Sidebar);
  assert.equal(typeof element.props.onFocusCapture, "function");
  element.props.onFocusCapture({ target: { matches: () => true } });
  element.props.onPointerLeave({ currentTarget: { querySelector: () => ({}) } });
  assert.deepEqual(changes, [true]);
  element.props.onBlurCapture({ relatedTarget: null, currentTarget: { contains: () => false } });
  assert.deepEqual(changes, [true, false]);
});

test("branding ignores mouse clicks but supports keyboard activation and hybrid-device touch", () => {
  let toggles = 0;
  const desktop = capture(Brand, { toggleSidebar: () => { toggles++; } }).element;
  assert.equal(typeof desktop.props.onClick, "function");
  desktop.props.onClick({ detail: 1 });
  assert.equal(toggles, 0);
  desktop.props.onClick({ detail: 0 });
  assert.equal(toggles, 1);
  assert.equal(typeof desktop.props.onPointerUp, "function");
  desktop.props.onPointerUp({ pointerType: "touch" });
  desktop.props.onClick({ detail: 1 });
  assert.equal(toggles, 2);
  desktop.props.onPointerUp({ pointerType: "mouse" });
  assert.equal(toggles, 2);
});

test("mobile branding retains a single tap control", () => {
  let taps = 0;
  const mobile = capture(Brand, { isMobile: true, hoverEnabled: false, toggleSidebar: () => { taps++; } }).element;
  assert.equal(mobile.type, "button");
  mobile.props.onClick({ detail: 1 });
  assert.equal(taps, 1);
});
