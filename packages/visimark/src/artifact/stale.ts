import { existsSync, readFileSync } from "node:fs";

/**
 * Staleness by **byte comparison**, not by checksum.
 *
 * `check` renders the artifact into memory and compares it to the file on
 * disk. That is exact: no hash coverage to define, no engine output-version to
 * maintain, no algorithm anything external could come to depend on, and a
 * renderer change restales correctly because its bytes differ. A hand-edited
 * artifact is stale too, which is right for a generated file.
 *
 * The consequence is that **nothing volatile may appear in the output** — no
 * version, no timestamp, no absolute path — or every artifact is permanently
 * stale. The marker below is deliberately just identity.
 */

export type ArtifactState =
  | { state: "current" }
  | { state: "stale" }
  | { state: "missing" }
  /** the file exists and carries no VisiMark marker — a human's file */
  | { state: "unowned" }
  /** the file exists and belongs to a different chart */
  | { state: "foreign"; sheet: string; chart: string };

const MARKER_RE = /<visimark\s+sheet="([^"]*)"\s+chart="([^"]*)"\s*\/>/;

export function marker(sheetId: string, chart: string): string {
  return `<metadata><visimark sheet="${sheetId}" chart="${chart}"/></metadata>`;
}

export function readMarker(svg: string): { sheet: string; chart: string } | null {
  const m = MARKER_RE.exec(svg);
  return m ? { sheet: m[1]!, chart: m[2]! } : null;
}

/** CRLF checkouts must not make every artifact look stale. */
export function normalise(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

export function classify(
  target: string,
  rendered: string,
  sheetId: string,
  chart: string,
): ArtifactState {
  if (!existsSync(target)) return { state: "missing" };
  let onDisk: string;
  try {
    onDisk = readFileSync(target, "utf8");
  } catch {
    return { state: "missing" };
  }
  const mark = readMarker(onDisk);
  if (!mark) return { state: "unowned" };
  if (mark.sheet !== sheetId || mark.chart !== chart) {
    return { state: "foreign", sheet: mark.sheet, chart: mark.chart };
  }
  return normalise(onDisk) === normalise(rendered) ? { state: "current" } : { state: "stale" };
}
