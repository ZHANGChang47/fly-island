//! Pure helpers for the search UI: formatting and query parsing. No React/DOM.

import type { SearchEntry } from "./api.ts";

/** Splits a query into the plain (non-prefixed) words used for highlighting. */
export function highlightWords(query: string): string[] {
  return query
    .split(/\s+/)
    .map((token) => token.replace(/^(ext|path):/i, "").replace(/,/g, " ").trim().toLowerCase())
    .filter((word) => word.length > 0)
    .flatMap((word) => word.split(/\s+/))
    .filter((word) => word.length > 0);
}

/** Human-readable file size, using binary units like Explorer. */
export function formatSize(bytes: number, isDir: boolean): string {
  if (isDir) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

/** Short date for the result list; `localeTag` comes from the i18n context. */
export function formatDate(millis: number, localeTag: string): string {
  if (!millis) return "—";
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Splits `text` into highlighted and plain segments for the given words.
 * Matching is case-insensitive and non-overlapping, earliest word first.
 */
export function highlightSegments(
  text: string,
  words: readonly string[],
): Array<{ text: string; hit: boolean }> {
  if (words.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const word of words) {
    let from = 0;
    while (from <= lower.length - word.length) {
      const at = lower.indexOf(word, from);
      if (at < 0) break;
      ranges.push([at, at + word.length]);
      from = at + word.length;
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  const segments: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

/** The parent directory shown beneath each result, without a trailing slash. */
export function parentOf(entry: SearchEntry): string {
  return entry.path.slice(0, Math.max(0, entry.path.length - entry.name.length)).replace(/[\\/]+$/, "");
}
