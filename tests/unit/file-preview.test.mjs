import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBase64,
  kindForExtension,
  mimeFor,
} from "../../src/features/file-preview/preview.ts";

test("kindForExtension maps supported formats and rejects legacy binaries", () => {
  assert.equal(kindForExtension("PDF"), "pdf");
  assert.equal(kindForExtension(".docx"), "word");
  assert.equal(kindForExtension("xlsx"), "excel");
  assert.equal(kindForExtension("pptx"), "slides");
  assert.equal(kindForExtension("markdown"), "markdown");
  assert.equal(kindForExtension("jpeg"), "image");
  assert.equal(kindForExtension("doc"), null);
  assert.equal(kindForExtension("xls"), null);
  assert.equal(kindForExtension("exe"), null);
});

test("decodeBase64 turns bytes back into a Uint8Array", () => {
  const encoded = globalThis.Buffer.from([0, 1, 255, 65]).toString("base64");
  assert.deepEqual(Array.from(decodeBase64(encoded)), [0, 1, 255, 65]);
});

test("mimeFor covers images and text formats", () => {
  assert.equal(mimeFor("C:/p/photo.JPG"), "image/jpeg");
  assert.equal(mimeFor("notes.md"), "text/markdown");
  assert.equal(mimeFor("unknown.bin"), "application/octet-stream");
});
