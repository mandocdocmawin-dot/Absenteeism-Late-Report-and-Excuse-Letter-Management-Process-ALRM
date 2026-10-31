import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import { createServer } from "vite";

let server;
let ChartStyle;
let ChartContainer;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  ({ ChartStyle, ChartContainer } = await server.ssrLoadModule("/src/components/ui/chart.jsx"));
});
after(async () => { await server?.close(); });

function renderStyle(config, id = "chart-reports_1") {
  return renderToStaticMarkup(React.createElement(ChartStyle, { id, config }));
}

function rulesFrom(html) {
  assert.match(html, /^<style>[\s\S]*<\/style>$/);
  assert.equal((html.match(/<\/style>/gi) || []).length, 1);
  const css = html.slice("<style>".length, -"</style>".length);
  assert.doesNotMatch(css, /[<>]/);
  return postcss.parse(css).nodes.map(rule => ({
    selector: rule.selector,
    declarations: rule.nodes.map(node => [node.prop, node.value]),
  }));
}

test("chart colors preserve light/dark overrides, fallback colors, and CSS variables", () => {
  const rules = rulesFrom(renderStyle({
    absences: { label: "Absences", color: "#ED2532" },
    "late-reports_2": { theme: { light: "var(--chart-1)", dark: "hsl(var(--chart-2))" } },
    fallback: { color: "rgb(255 120 20 / 80%)", theme: { dark: "oklch(0.6 0.2 25)" } },
    named: { color: "rebeccapurple" },
    variableFallback: { color: "var(--chart-3, #abc)" },
    labelOnly: { label: "No color" },
  }));
  assert.deepEqual(rules, [
    { selector: "[data-chart=chart-reports_1]", declarations: [
      ["--color-absences", "#ED2532"], ["--color-late-reports_2", "var(--chart-1)"],
      ["--color-fallback", "rgb(255 120 20 / 80%)"], ["--color-named", "rebeccapurple"],
      ["--color-variableFallback", "var(--chart-3, #abc)"],
    ] },
    { selector: ".dark [data-chart=chart-reports_1]", declarations: [
      ["--color-absences", "#ED2532"], ["--color-late-reports_2", "hsl(var(--chart-2))"],
      ["--color-fallback", "oklch(0.6 0.2 25)"], ["--color-named", "rebeccapurple"],
      ["--color-variableFallback", "var(--chart-3, #abc)"],
    ] },
  ]);
});

test("invalid chart identifiers emit no stylesheet", () => {
  for (const id of [
    'chart-x] { color: red } body, [data-chart=x',
    'chart-x"], body, [data-chart="x',
    "chart-x</style><script>alert(1)</script>",
    "chart-x\\5d", "chart-x chart-y", "", null, 123,
  ]) {
    assert.equal(renderStyle({ reports: { color: "red" } }, id), "", String(id));
  }
});

test("malicious series keys cannot add HTML, selectors, or declarations", () => {
  for (const key of [
    "x</style><img src=x onerror=alert(1)>",
    "x: red; } body { background", "x; --injected", "x/*", "x\\3b", "x y", "",
  ]) {
    const rules = rulesFrom(renderStyle({ [key]: { color: "red" }, safe: { color: "#123456" } }));
    assert.deepEqual(rules.map(rule => rule.declarations), [
      [["--color-safe", "#123456"]], [["--color-safe", "#123456"]],
    ], key);
  }
});

for (const color of [
  "red;</style><script>alert(1)</script>",
  "red; background: url(//attacker.invalid/x)",
  "red} body { color: red", "red !important", "red/*comment*/", "red\\3b color:red",
  "url(//attacker.invalid/x)", "var(--safe, url(//attacker.invalid/x))", "expression(alert(1))",
  123, { toString: () => "red; color: blue" },
]) {
  test(`unsafe color is omitted from base and theme declarations: ${String(color)}`, () => {
    const rules = rulesFrom(renderStyle({
      unsafe: { color },
      themed: { theme: { light: color, dark: "var(--chart-2)" } },
      safe: { color: "#abc" },
    }));
    assert.deepEqual(rules.map(rule => rule.declarations), [
      [["--color-safe", "#abc"]],
      [["--color-themed", "var(--chart-2)"], ["--color-safe", "#abc"]],
    ]);
  });
}

test("empty and label-only configs emit no stylesheet", () => {
  assert.equal(renderStyle({}), "");
  assert.equal(renderStyle({ reports: { label: "Reports" } }), "");
});

test("generated chart identifiers match the scoped stylesheet selector", () => {
  const html = renderToStaticMarkup(React.createElement(ChartContainer, {
    config: { reports: { color: "var(--chart-1)" } },
    children: React.createElement("div"),
  }));
  const id = html.match(/data-chart="([^"]+)"/)?.[1];
  assert.ok(id);
  const style = html.match(/<style>[\s\S]*?<\/style>/)?.[0];
  assert.ok(style);
  assert.equal(rulesFrom(style)[0].selector, `[data-chart=${id}]`);
});
