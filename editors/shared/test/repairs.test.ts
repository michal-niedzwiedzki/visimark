import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyEdits, build, check, locate, planFmt } from "visimark";
import { planRepairs } from "../src/repairs.js";

/**
 * The repair plan both plugins apply (#384 spec §2.1). Obsidian's
 * `report.test.ts` pins the per-row property against `fmt`; this pins the
 * plan itself, with no reader-facing wording in the way.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");
const model = build(locate(drift));
const result = check(model);

test("all is fmt's plan, artifacts declined", () => {
  const direct = planFmt(model, result, { noArtifacts: true, fixDates: false });
  expect(applyEdits(drift, planRepairs(model, result).all)).toBe(applyEdits(drift, direct));
});

test("fixDates reaches the plan", () => {
  const direct = planFmt(model, result, { noArtifacts: true, fixDates: true });
  expect(applyEdits(drift, planRepairs(model, result, { fixDates: true }).all)).toBe(
    applyEdits(drift, direct),
  );
});

test("every owner is a finding the result reports", () => {
  const known = new Set(result.findings);
  for (const owner of planRepairs(model, result).byFinding.keys()) {
    expect(known.has(owner)).toBe(true);
  }
});

test("the spanless anchor-group STALE owns the anchor edits", () => {
  const group = result.findings.filter((f) => f.code === "STALE" && f.span === undefined);
  expect(group).toHaveLength(1);
  const edits = planRepairs(model, result).byFinding.get(group[0]!);
  expect(edits?.length ?? 0).toBeGreaterThan(0);
});

test("edits are bare: start, end and text only", () => {
  for (const e of planRepairs(model, result).all) {
    expect(Object.keys(e).sort()).toEqual(["end", "start", "text"]);
  }
});
