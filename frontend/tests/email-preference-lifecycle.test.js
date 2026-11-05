import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { createServer } from "vite";

let server, Preferences;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", plugins: [{
    name: "email-preference-lifecycle", enforce: "pre", transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/hooks/useNotificationPreferences.js")) return "export default function usePreferences() { return { preferences: {}, updatePreference() {}, error: '' }; }";
      if (id.replaceAll("\\", "/").endsWith("/src/api/notifications.js")) return "export const saveEmailNotificationPreference = value => globalThis.__saveEmail(value);";
    },
  }] });
  Preferences = (await server.ssrLoadModule("/src/components/notifications/NotificationPreferences.jsx")).default;
});
after(async () => { await server?.close(); delete globalThis.__saveEmail; });

function mount(initial) {
  const slots = [];
  let cursor = 0, dirty = false, value, props = initial;
  const dispatcher = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === "function" ? next(slots[index].value) : next; dirty = true; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
  };
  function render(next = props) {
    props = next;
    const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const previous = internals.H;
    internals.H = dispatcher;
    try { do { dirty = false; cursor = 0; value = Preferences(props); } while (dirty); }
    finally { internals.H = previous; }
    return value;
  }
  function nodes(element) { return React.isValidElement(element) ? [element, ...React.Children.toArray(element.props.children).flatMap(nodes)] : []; }
  render();
  return { render, email: () => nodes(value).find(node => node.props["aria-label"] === "Email notifications") };
}

test("email switch accepts refreshed server state and rolls failures back to that state", async () => {
  const props = { user: { id: "one", email_notifications_enabled: false } };
  const page = mount(props);
  assert.equal(page.email().props.checked, false);
  page.render({ user: { ...props.user, email_notifications_enabled: true } });
  assert.equal(page.email().props.checked, true);
  globalThis.__saveEmail = async () => { throw new DOMException("Timeout", "TimeoutError"); };
  await page.email().props.onCheckedChange(false);
  page.render();
  assert.equal(page.email().props.checked, true);
});

test("server refresh during an email save preserves the latest queued choice", async () => {
  const calls = [];
  globalThis.__saveEmail = value => new Promise(resolve => calls.push({ value, resolve }));
  const page = mount({ user: { id: "one", email_notifications_enabled: false } });
  const saving = page.email().props.onCheckedChange(true);
  page.render();
  await page.email().props.onCheckedChange(false);
  page.render({ user: { id: "one", email_notifications_enabled: true } });
  assert.equal(page.email().props.checked, false);
  calls[0].resolve(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls.map(call => call.value), [true, false]);
  calls[1].resolve(false);
  await saving;
  page.render();
  assert.equal(page.email().props.checked, false);
  assert.equal(page.email().props["aria-busy"], false);
});
