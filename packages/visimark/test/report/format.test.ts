import { expect, test } from "bun:test";
import { drift } from "../examples.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { formatCheck } from "../../src/report/format.js";
import { levenshtein } from "../../src/report/levenshtein.js";


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

test("a row label at or past the value column keeps a space before the value", () => {
  // `padEnd` never truncates, so a label filling the whole field used to leave
  // the quoted value abutting the last letter. Both codes share the field.
  const long = "Backend implementation"; // exactly the field width, 22
  for (const code of ["DATE", "UNIT"] as const) {
    const out = formatCheck("f.md", [
      { code, sheetId: "s", name: "Col", rowLabel: long, raw: "1.00", message: "m" },
    ]);
    expect(out).toContain(`${long} "1.00"`);
    expect(out).not.toContain(`${long}"1.00"`);
  }
});

test("padding for labels shorter than the field is untouched", () => {
  const out = formatCheck("f.md", [
    { code: "DATE", sheetId: "schedule", name: "Due", rowLabel: "Delivery of backend", raw: "15.10.2026" },
  ]);
  expect(out).toContain(`Delivery of backend   "15.10.2026"`);
});
