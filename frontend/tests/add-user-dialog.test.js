import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server, AddUserDialog;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom" });
  AddUserDialog = (await server.ssrLoadModule("/src/pages/auth/admin/AddUserDialog.jsx")).default;
});

after(async () => { await server?.close(); });

test("Strict Mode ref cleanup does not dismiss the reopened Add User dialog", () => {
  let dismissed = 0;
  const element = AddUserDialog({ onClose: () => dismissed++, onCreated() {} });
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() {
      this.open = false;
      element.props.onClose({ currentTarget: this });
    },
  };

  const cleanup = element.props.ref(dialog);
  cleanup?.();
  element.props.ref(dialog);

  assert.equal(dismissed, 0);
});
