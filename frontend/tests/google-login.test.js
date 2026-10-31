import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";

const backend = "https://absenteeism-late-report-and-excuse.onrender.com";
const source = await readFile(new URL("../src/api/client.js", import.meta.url), "utf8");
const configuredSource = source.replaceAll("import.meta.env", JSON.stringify({ VITE_API_URL: backend }));
const { API_URL, googleLoginUrl } = await import(`data:text/javascript;base64,${Buffer.from(configuredSource).toString("base64")}`);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete globalThis.window;
});

for (const origin of ["http://localhost:5173", "https://absenteeism-late-report-and-excuse.vercel.app"]) {
  test(`Google sign-in keeps the OAuth cookie on ${origin}`, () => {
    globalThis.window = { location: { origin } };
    const url = new URL(googleLoginUrl());

    assert.equal(url.origin, origin);
    assert.equal(url.pathname, "/api/auth/google/redirect");
    assert.equal(url.searchParams.get("origin"), origin);
    assert.equal(API_URL, "", "API calls always use the same-origin gateway");
  });
}

test("same-origin sign-in preserves the account-selection prompt", () => {
  globalThis.window = { location: { origin: "http://localhost:5173" } };
  const url = new URL(googleLoginUrl({ prompt: "select_account" }));

  assert.equal(url.origin, window.location.origin);
  assert.equal(url.searchParams.get("prompt"), "select_account");
});
