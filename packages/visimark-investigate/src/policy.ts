import { isDotPath } from "./repo.js";

/**
 * Which Markdown files an investigation reads (spec §3.4). The shells call
 * `selectFiles` before reading or fetching anything — the widget must not
 * spend requests on a file it will skip — and `looksGenerated` once a file's
 * text is in hand.
 */

export type SkipReason =
  | "dot-path"
  | "excluded-directory"
  | "size"
  | "generated"
  | "file-cap"
  | "fetch-failed";

export interface Skipped {
  path: string;
  reason: SkipReason;
}

const MARKDOWN = /\.(md|markdown)$/i;
const EXCLUDED = new Set([
  "test",
  "tests",
  "__tests__",
  "fixtures",
  "vendor",
  "third_party",
  "node_modules",
]);
const MAX_BYTES = 500_000;

export function selectFiles(
  paths: { path: string; size: number }[],
  fileCap?: number,
): { markdown: string[]; skipped: Skipped[] } {
  const kept: string[] = [];
  const skipped: Skipped[] = [];
  for (const { path, size } of paths) {
    if (!MARKDOWN.test(path)) continue;
    if (isDotPath(path)) skipped.push({ path, reason: "dot-path" });
    else if (path.split("/").some((s) => EXCLUDED.has(s.toLowerCase()))) {
      skipped.push({ path, reason: "excluded-directory" });
    } else if (size > MAX_BYTES) skipped.push({ path, reason: "size" });
    else kept.push(path);
  }
  if (fileCap === undefined) return { markdown: kept, skipped };
  const sorted = [...kept].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const path of sorted.slice(fileCap)) skipped.push({ path, reason: "file-cap" });
  return { markdown: sorted.slice(0, fileCap), skipped };
}

/** True for a file a tool wrote, which a pull request should not hand-edit. */
export function looksGenerated(text: string): boolean {
  const head = text.split("\n").slice(0, 15).join("\n");
  return /do not edit|auto-?generated|generated (by|with|from)|@generated/i.test(head);
}
