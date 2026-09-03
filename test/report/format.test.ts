import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { formatCheck } from "../../src/report/format.js";
import { levenshtein } from "../../src/report/levenshtein.js";

const drift = readFileSync("doc/example-invoice-drift.md", "utf8");

/** the normative transcript, read straight out of the example doc */
function expectedTranscript(): string {
  const all = drift.split("\n");
  const start = all.findIndex((l) => l.trim() === "```console");
  const end = all.findIndex((l, i) => i > start && l.trim() === "```");
  const body = all.slice(start + 1, end);
  const cmdIdx = body.findIndex((l) => l.startsWith("$ visimark"));
  return body.slice(cmdIdx + 1).join("\n");
}

test("levenshtein basics", () => {
  expect(levenshtein("fx_rate", "fx_eur")).toBeGreaterThan(0);
  expect(levenshtein("abc", "abc")).toBe(0);
});

test("formatCheck reproduces the drift transcript byte-for-byte", () => {
  const r = check(build(locate(drift)));
  const out = formatCheck("doc/example-invoice-drift.md", r.findings);
  expect(out).toBe(expectedTranscript());
});
