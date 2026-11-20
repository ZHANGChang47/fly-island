import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatSize,
  highlightSegments,
  highlightWords,
  parentOf,
} from "../../src/features/file-search/search.ts";

test("highlight words drop ext/path prefixes and split comma lists", () => {
  assert.deepEqual(highlightWords("report 2026"), ["report", "2026"]);
  assert.deepEqual(highlightWords("ext:rs,toml path:work note"), ["rs", "toml", "work", "note"]);
  assert.deepEqual(highlightWords("   "), []);
});

test("format size uses binary units and marks folders", () => {
  assert.equal(formatSize(0, false), "0 B");
  assert.equal(formatSize(512, false), "512 B");
  assert.equal(formatSize(2048, false), "2.0 KB");
  assert.equal(formatSize(5 * 1024 * 1024, false), "5.0 MB");
  assert.equal(formatSize(999, true), "—");
});

test("format date is stable and handles invalid input", () => {
  assert.equal(formatDate(0, "en"), "—");
  assert.equal(formatDate(Number.NaN, "en"), "—");
  const text = formatDate(new Date(2026, 0, 15).getTime(), "en");
  assert.match(text, /2026/);
});

test("highlight segments find all case-insensitive hits and merge overlaps", () => {
  const segments = highlightSegments("Report REPORT.txt", ["report"]);
  assert.equal(segments.filter((part) => part.hit).length, 2);
  assert.equal(segments.map((part) => part.text).join(""), "Report REPORT.txt");
  assert.deepEqual(highlightSegments("abc", []), [{ text: "abc", hit: false }]);
  assert.deepEqual(highlightSegments("abc", ["zzz"]), [{ text: "abc", hit: false }]);
});

test("parentOf strips the file name and trailing separators", () => {
  const entry = { path: "C:\\Work\\notes\\a.txt", name: "a.txt" };
  assert.equal(parentOf(entry), "C:\\Work\\notes");
  assert.equal(parentOf({ path: "C:\\a.txt", name: "a.txt" }), "C:");
});
