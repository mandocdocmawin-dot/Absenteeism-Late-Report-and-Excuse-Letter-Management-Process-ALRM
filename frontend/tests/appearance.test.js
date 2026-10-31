import assert from "node:assert/strict";
import test from "node:test";

test("light-only startup clears a previous dark theme without deleting authentication or preferences", async () => {
  const { applyLightAppearance } = await import("../src/lib/appearance.js");
  const classes = new Set(["dark", "app-ready"]);
  const root = { classList: { remove: (value) => classes.delete(value) }, style: {} };
  const values = new Map([["alrm-theme", "dark"], ["auth_token", "saved-session"], ["alrm:student-preferences:1", "saved-preferences"]]);
  const browser = {
    localStorage: { removeItem: (key) => values.delete(key) },
    matchMedia() { throw new Error("System theme must not be consulted"); },
  };
  applyLightAppearance(root, browser);
  assert.equal(classes.has("dark"), false);
  assert.equal(classes.has("app-ready"), true);
  assert.equal(root.style.colorScheme, "light");
  assert.equal(values.has("alrm-theme"), false);
  assert.equal(values.get("auth_token"), "saved-session");
  assert.equal(values.get("alrm:student-preferences:1"), "saved-preferences");
});

test("blocked browser storage cannot prevent light-only startup", async () => {
  const { applyLightAppearance } = await import("../src/lib/appearance.js");
  const root = { classList: { remove() {} }, style: {} };
  const browser = { get localStorage() { throw new Error("Storage unavailable"); } };
  assert.doesNotThrow(() => applyLightAppearance(root, browser));
  assert.equal(root.style.colorScheme, "light");
});
