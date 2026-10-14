import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, check, describeFinding, isProblem, locate } from "visimark";
import { noteFindings } from "../src/note-findings.js";

const docs = resolve(import.meta.dir, "../../../docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");

test("one row per finding in document order, in the CLI's words, NOTE left out", () => {
  const got = noteFindings(drift);
  if (got.kind !== "findings") throw new Error(got.kind);
  const findings = check(build(locate(drift))).findings.filter((f) => f.code !== "NOTE");
  expect(got.rows).toHaveLength(findings.length);
  expect(got.rows.map((r) => r.text).sort()).toEqual(findings.map(describeFinding).sort());
  const starts = got.rows.flatMap((r) => (r.span ? [r.span.start] : []));
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
  expect(got.problems).toBe(findings.filter(isProblem).length);
  expect(got.importsDropped).toBe(false);
});

test("a row's label is the code, the qualified name and the row label", () => {
  const got = noteFindings(drift);
  if (got.kind !== "findings") throw new Error(got.kind);
  expect(got.rows.map((r) => r.label)).toContain("STALE lines.Net · On-call support");
});

test("no block, and a clean note", () => {
  expect(noteFindings("# Plain\n")).toEqual({ kind: "no-block" });
  const clean = noteFindings(readFileSync(join(docs, "example-invoice.md"), "utf8"));
  if (clean.kind !== "findings") throw new Error(clean.kind);
  expect(clean.problems).toBe(0);
});
