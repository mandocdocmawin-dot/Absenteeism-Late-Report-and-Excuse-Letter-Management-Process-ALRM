import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";

test("page text, headings and numeric labels share locally loaded Inter", async () => {
  const css = postcss.parse(await readFile(new URL("../src/index.css", import.meta.url), "utf8"));
  const theme = css.nodes.find((node) => node.type === "atrule" && node.name === "theme");
  const fonts = new Map(theme.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value]));
  assert.equal(fonts.get("--font-sans"), "'Inter Variable', sans-serif");
  assert.equal(fonts.get("--font-heading"), "var(--font-sans)");
  assert.equal(fonts.get("--font-mono"), "var(--font-sans)");
  assert.ok(css.nodes.some((node) => node.type === "atrule" && node.name === "import" && node.params === '"@fontsource-variable/inter"'));
});
