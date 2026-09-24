/**
 * The acceptance transcript for declared param domains
 * (docs/design/a-param-declares-the-set-of-values-it-ac-spec.md §7).
 *
 * Only the clean fixture (`fixtures/domain/levers.md`) is committed; every
 * broken variant below is generated in memory from it, the same pattern
 * `import-acceptance.test.ts` uses.
 */
import { expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";
import { build } from "../src/model/build.js";
import { locate } from "../src/parse/document.js";
import { check } from "../src/eval/check.js";
import {
  applyScenario,
  parseScenarioJson,
  resolveScenario,
  ScenarioError,
} from "../src/eval/scenario.js";

const MD_PATH = join(import.meta.dir, "fixtures", "domain", "levers.md");
const CLEAN = readFileSync(MD_PATH, "utf8");

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

async function run(args: string[]) {
  const c = capture();
  const code = await runCli(args, c.io);
  return { code, out: c.out(), err: c.err() };
}

function checkVariant(source: string) {
  return check(build(locate(source)));
}

function scenarioFault(source: string, json: string): string {
  const model = build(locate(source));
  try {
    resolveScenario(model, parseScenarioJson(json, "s.json"));
  } catch (e) {
    if (e instanceof ScenarioError) return e.message;
    throw e;
  }
  throw new Error("scenario resolved; expected a fault");
}

test("1. clean: every notation variant parses, no error findings", async () => {
  const r = await run(["check", MD_PATH]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("0 problems");
  // every param is unread in this fixture — WARN only, never an error
  expect(r.out).not.toMatch(/\b(TYPE|DOMAIN|PRECISION|SHEET)\b/);
});

test("2. eval --json reports every domain, with an exact fold where one exists", async () => {
  const r = await run(["eval", "--json", MD_PATH]);
  const j = JSON.parse(r.out);
  expect(j.params["levers.extra_hours"].domain).toEqual({
    clauses: ["integer", "[0, 80]"],
    fold: Array.from({ length: 81 }, (_, i) => String(i)),
  });
  expect(j.params["levers.prepay_share"].domain).toEqual({
    clauses: ["{ 30%, 40%, 45%, 50% }"],
    fold: ["0.3", "0.4", "0.45", "0.5"],
  });
  expect(j.params["levers.crosssell_days"].domain).toEqual({
    clauses: ["natural", "[0, 8)"],
    fold: ["0", "1", "2", "3", "4", "5", "6", "7"],
  });
  // a preset with no range does not fold to a finite list
  expect(j.params["levers.staff_added"].domain).toEqual({ clauses: ["positive integer"] });
  expect(j.params["levers.code"].domain).toEqual({ clauses: ["positive integer"] });
});

test("3. a default outside its range domain: DOMAIN, exit 1", () => {
  const source = CLEAN.replace(
    "param extra_hours    precision 0 integer in [0, 80] = default 40",
    "param extra_hours    precision 0 integer in [0, 80] = default 100",
  );
  const result = checkVariant(source);
  const f = result.findings.find((x) => x.code === "DOMAIN")!;
  expect(f.message).toBe("default 100 is not in the domain of extra_hours: integer in [0, 80]");
  expect(result.exitCode).toBe(1);
});

test("3b. the DOMAIN message reaches plain-text `check` output, not just --json", async () => {
  const source = CLEAN.replace(
    "param extra_hours    precision 0 integer in [0, 80] = default 40",
    "param extra_hours    precision 0 integer in [0, 80] = default 100",
  );
  const path = join(import.meta.dir, "fixtures", "domain", "levers-bad-default.md");
  writeFileSync(path, source);
  try {
    const r = await run(["check", path]);
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      "DOMAIN  levers.extra_hours  default 100 is not in the domain of extra_hours: integer in [0, 80]",
    );
  } finally {
    rmSync(path);
  }
});

test("4. a default outside its finite-set domain: DOMAIN, exit 1", () => {
  const source = CLEAN.replace(
    "param prepay_share   precision 2 in { 30%, 40%, 45%, 50% } = default 30%",
    "param prepay_share   precision 2 in { 30%, 40%, 45%, 50% } = default 35%",
  );
  const result = checkVariant(source);
  const f = result.findings.find((x) => x.code === "DOMAIN")!;
  expect(f.message).toBe(
    "default 35% is not in the domain of prepay_share: { 30%, 40%, 45%, 50% }",
  );
  expect(result.exitCode).toBe(1);
});

test("5. SCENARIO refusal — every message shape from spec §4.2", () => {
  expect(scenarioFault(CLEAN, '{"levers.extra_hours": "100"}')).toBe(
    "visimark: scenario value for levers.extra_hours is not in [0, 80]: 100",
  );
  expect(scenarioFault(CLEAN, '{"levers.prepay_share": "35%"}')).toBe(
    "visimark: scenario value for levers.prepay_share is not in { 30%, 40%, 45%, 50% }: 35%",
  );
  expect(scenarioFault(CLEAN, '{"levers.staff_added": "0"}')).toBe(
    "visimark: scenario value for levers.staff_added is not a positive integer: 0",
  );
  expect(scenarioFault(CLEAN, '{"levers.crosssell_days": "-1"}')).toBe(
    "visimark: scenario value for levers.crosssell_days is not a non-negative integer: -1",
  );
});

test("6. an in-domain scenario value that still fails the assert: exit 1, values printed", () => {
  const model = build(locate(CLEAN));
  const resolved = resolveScenario(model, parseScenarioJson('{"levers.prepay_share": "50%"}', "s"));
  applyScenario(model, resolved);
  const result = check(model);
  expect(result.assertions[0]?.holds).toBe(false);
  expect(result.exitCode).toBe(1);
});
