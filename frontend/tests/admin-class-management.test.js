import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { filterAdminClasses } from "../src/pages/auth/admin/classes/classFilters.js";

const classes = [
  { id: "one", subject_name: "Programming", section: "1A", program_id: "p1", instructor: { name: "Ada", email: "ada@example.test" }, program: { program_name: "Information Systems" } },
  { id: "two", subject_name: "Mathematics", section: "1B", program_id: "p2" },
];

let server, ClassFormDialog;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  ClassFormDialog = (await server.ssrLoadModule("/src/pages/auth/admin/classes/ClassFormDialog.jsx")).default;
});
after(async () => { await server?.close(); });

test("class edit dialog retains actual form values and locks dismissal while saving", () => {
  let closed = 0;
  const props = { item: { ...classes[0], year_level: "1st", section: "1A" }, programs: [{ id: "p1", program_name: "Information Systems" }], onCancel() { closed++; }, onSave() {} };
  const html = renderToStaticMarkup(React.createElement(ClassFormDialog, props));
  assert.match(html, /<dialog[^>]*aria-modal="true"[^>]*aria-labelledby="class-form-title"/);
  assert.match(html, /id="class-form-title"[^>]*>Edit Class/);
  assert.match(html, /name="section"[^>]*value="1A"/);
  const event = { preventDefault() {} };
  ClassFormDialog({ ...props, saving: true }).props.onCancel(event);
  assert.equal(closed, 0);
  ClassFormDialog(props).props.onCancel(event);
  assert.equal(closed, 1);
  const dialog = { open: false, showModal() { this.open = true; } };
  ClassFormDialog(props).props.ref(dialog);
  assert.equal(dialog.open, true);
});

test("class search combines with program filters without mutating the collection", () => {
  for (const search of [" PROGRAMMING ", "1a", "ada", "ADA@EXAMPLE", "information systems"]) {
    assert.deepEqual(filterAdminClasses(classes, { search, programId: "p1" }).map(item => item.id), ["one"]);
  }
  assert.deepEqual(filterAdminClasses(classes, { search: "ada", programId: "p2" }), []);
  assert.deepEqual(filterAdminClasses(classes, {}), classes);
  assert.deepEqual(classes.map(item => item.id), ["one", "two"]);
});

test("catalog exposes editing without destructive program or class controls", async () => {
  const source = await readFile(new URL("../src/pages/auth/admin/AdminDashboard.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /deleteClass|deleteProgram|>Delete<\/Button>/);
  assert.match(source, /ClassFormDialog/);
  assert.match(source, /Search classes/);
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/classes"/);
});
