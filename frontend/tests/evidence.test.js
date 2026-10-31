import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { validateEvidenceFile } from "../src/pages/auth/student/request-form/evidenceValidation.js";
import { compressImage } from "../src/pages/auth/student/request-form/imageCompress.js";

beforeEach(() => { globalThis.createImageBitmap = async () => {}; });
afterEach(() => {
  delete globalThis.createImageBitmap;
  delete globalThis.document;
});

test("attachment validation rejects spoofed types, empty files, and oversized input", async () => {
  await assert.rejects(validateEvidenceFile(new File(["<script>alert(1)</script>"], "photo.png", { type: "image/png" })), /contents/);
  await assert.rejects(validateEvidenceFile(new File(["%PDF-1.7"], "photo.jpg", { type: "application/pdf" })), /matching/);
  await assert.rejects(validateEvidenceFile(new File([], "photo.png", { type: "image/png" })), /empty/);
  await assert.rejects(validateEvidenceFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "document.pdf", { type: "application/pdf" })), /2MB/);
  await assert.rejects(validateEvidenceFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" })), /10MB/);
});

test("allowed file signatures pass the preliminary validation", async () => {
  await validateEvidenceFile(new File(["%PDF-1.7"], "document.pdf", { type: "application/pdf" }));
  await validateEvidenceFile(new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpeg", { type: "image/jpeg" }));
  await validateEvidenceFile(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "photo.png", { type: "image/png" }));
});

test("JPEG contents in a PNG filename are normalized without trusting browser MIME", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  for (const type of ["image/png", "image/jpeg", "", "application/octet-stream"]) {
    const file = await validateEvidenceFile(new File([bytes], "8.png", { type, lastModified: 123 }));
    assert.equal(file.type, "image/jpeg");
    assert.equal(file.name, "8.jpg");
    assert.equal(file.lastModified, 123);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  }
});

test("PNG contents in a JPG filename are normalized", async () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const file = await validateEvidenceFile(new File([bytes], "photo.JPG", { type: "image/jpeg" }));
  assert.equal(file.type, "image/png");
  assert.equal(file.name, "photo.png");
});

test("PDF and image mismatches and unsupported extensions remain rejected", async () => {
  await assert.rejects(validateEvidenceFile(new File([new Uint8Array([0xff, 0xd8, 0xff])], "document.pdf", { type: "application/pdf" })), /matching/);
  await assert.rejects(validateEvidenceFile(new File([new Uint8Array([0xff, 0xd8, 0xff])], "file.exe", { type: "image/jpeg" })), /Only PDF/);
});

test("WebP and GIF files renamed as PNG remain rejected", async () => {
  await assert.rejects(
    validateEvidenceFile(new File(["RIFF0000WEBP"], "8.png", { type: "image/png" })),
    /WebP/,
  );
  await assert.rejects(
    validateEvidenceFile(new File(["GIF89a000000"], "8.png", { type: "image/png" })),
    /GIF/,
  );
});

test("images that cannot be decoded are rejected instead of passed through", async (t) => {
  t.mock.method(globalThis, "createImageBitmap", async () => { throw new Error("Invalid image"); });
  await assert.rejects(compressImage(new File(["bad image"], "photo.png", { type: "image/png" })), /Invalid image/);
});

test("a corrected JPEG filename does not bypass image decoding", async (t) => {
  t.mock.method(globalThis, "createImageBitmap", async (file) => {
    assert.equal(file.type, "image/jpeg");
    assert.equal(file.name, "8.jpg");
    throw new Error("Corrupt JPEG");
  });
  const validatedFile = await validateEvidenceFile(new File([new Uint8Array([0xff, 0xd8, 0xff])], "8.png", { type: "image/png" }));
  await assert.rejects(compressImage(validatedFile), /Corrupt JPEG/);
});

test("oversized image dimensions are rejected and the bitmap is closed", async (t) => {
  let closed = false;
  t.mock.method(globalThis, "createImageBitmap", async () => ({ width: 10000, height: 10000, close() { closed = true; } }));
  await assert.rejects(compressImage(new File(["image"], "photo.png", { type: "image/png" })), /20 million pixels/);
  assert.equal(closed, true);
});

test("images are re-encoded even when the new file is larger than the original", async (t) => {
  let closed = false;
  t.mock.method(globalThis, "createImageBitmap", async () => ({ width: 100, height: 100, close() { closed = true; } }));
  globalThis.document = {
    createElement() {
      return {
        getContext() { return { fillRect() {}, drawImage() {} }; },
        toBlob(callback) { callback(new Blob(["re-encoded-image"], { type: "image/jpeg" })); },
      };
    },
  };
  const original = new File(["small"], "photo.png", { type: "image/png" });
  const processed = await compressImage(original);
  assert.notEqual(processed, original);
  assert.equal(processed.type, "image/jpeg");
  assert.equal(processed.name, "photo.jpg");
  assert.equal(closed, true);
});
