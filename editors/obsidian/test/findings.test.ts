import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ERROR_CODES,
  build,
  check,
  isProblem,
  locate,
  type Finding,
  type FindingCode,
} from "visimark";
import { forReader, forReaderAll } from "../src/findings.js";

/**
 * v1 constraint 6 — **no red, no `STALE`, no "1 problem", no exit code
 * anywhere in the UI** — is the kind of rule that is kept for a week and then
 * broken by one convenient interpolation. These tests are what keep it.
 *
 * Completeness is a compile error rather than a test (`TEXT` is typed
 * `Record<FindingCode, …>`), so what is left to check here is the part a type
 * cannot: that the words are audience-B words, that the actions are ones the
 * engine will actually honour, and that the advice/problem split agrees with
 * the engine's own `isProblem` rather than with a second list.
 */

const docs = resolve(import.meta.dir, "../../../docs");

/** every code the engine can emit — ERROR_CODES plus the three it excludes */
const ALL_CODES: FindingCode[] = [...ERROR_CODES, "STALE", "WARN", "NOTE"];

const finding = (code: FindingCode, extra: Partial<Finding> = {}): Finding => ({ code, ...extra });

test("the taxonomy this file covers is the taxonomy the engine has", () => {
  // the type makes a missing row a compile error; this makes a *stale* row —
  // one for a code the engine no longer emits — a visible one
  expect(ALL_CODES.length).toBe(17);
  for (const code of ALL_CODES) {
    expect(forReader(finding(code)), `${code} has no translation`).not.toBeUndefined();
  }
});

test("NOTE is not a row", () => {
  // it qualifies another finding and has no site of its own
  expect(forReader(finding("NOTE", { suppressedCount: 3 }))).toBeNull();
});

test("no row contains a finding code, an exit code or the report's vocabulary", () => {
  // Codes are matched as codes — the uppercase token, whole word. "date",
  // "unit" and "note" are ordinary English and three of the sentences need
  // them; `DATE` shouted at a reader is what constraint 6 forbids. The report
  // words are matched case-insensitively, because "1 problem" is as wrong
  // capitalised as it is not.
  const offenders: string[] = [];
  for (const code of ALL_CODES) {
    const r = forReader(finding(code, { name: "lines.net_total", raw: "net_totl" }));
    if (r === null) continue;
    for (const c of ALL_CODES) {
      if (new RegExp(`\\b${c}\\b`).test(r.row)) offenders.push(`${code}: "${r.row}" shouts ${c}`);
    }
    for (const word of ["exit code", "problem", "error", "stale", "diagnostic"]) {
      if (r.row.toLowerCase().includes(word)) {
        offenders.push(`${code}: "${r.row}" contains "${word}"`);
      }
    }
  }
  expect(offenders, offenders.join("; ")).toEqual([]);
});

test("every row is a sentence, not a log line", () => {
  for (const code of ALL_CODES) {
    const r = forReader(finding(code, { name: "total", raw: "totl" }));
    if (r === null) continue;
    expect(r.row.endsWith("."), `${code}: "${r.row}" does not end in a full stop`).toBe(true);
    // a row may open with the reader's own name for something — "net_total is
    // defined twice" — which is the spec's wording and is lowercase because
    // the document is. Anything else starts with a capital.
    const opensWithSubject = r.row.startsWith("totl") || r.row.startsWith("total");
    const opensWithCount = /^\d/.test(r.row);
    expect(
      opensWithSubject || opensWithCount || r.row[0] === r.row[0]!.toUpperCase(),
      `${code}: "${r.row}" starts with none of a capital, the name it is about, or a count`,
    ).toBe(true);
    expect(r.row.length, `${code}: "${r.row}" is too terse to be a sentence`).toBeGreaterThan(15);
  }
});

test("the code is available, but only off the row", () => {
  const r = forReader(finding("STALE"))!;
  expect(r.code).toBe("STALE");
  expect(r.row).not.toContain("STALE");
});

test("only a stale value offers a repair, because fmt repairs only that", () => {
  const repairable = ALL_CODES.filter((c) => forReader(finding(c))?.action?.kind === "repair");
  expect(repairable).toEqual(["STALE"]);
});

test('a collapsed group of drifted anchors says how many, not "this value"', () => {
  // the engine reports every drifted prose anchor as one finding with no site
  // of its own, because there is no single place to point at. "This value no
  // longer matches its formula" about eight of them sends the reader looking
  // for one that does not exist.
  const group = forReader(finding("STALE", { anchorGroup: true, suppressedCount: 8 }))!;
  expect(group.row).toBe("8 values in the text no longer match their formulas.");
  expect(group.action).toEqual({ kind: "repair" });
});

test("a stale chart is a row with no repair, and the finding is not silenced", () => {
  // the shipped --no-artifacts contract: declining the write never silences
  // the finding. v1 has no vault-backed write port, so the row stays and the
  // button does not appear
  const chart = forReader(finding("STALE", { artifact: "charts/sales.svg" }))!;
  expect(chart.action).toBeNull();
  expect(chart.row).toBe("This chart is older than the numbers it draws.");
  expect(chart.severity).toBe("problem");
});

test("COVERAGE offers Infer, which is the on-ramp", () => {
  expect(forReader(finding("COVERAGE"))!.action).toEqual({ kind: "infer" });
});

test("a did-you-mean is passed through, not recomputed", () => {
  // the engine already ran `closest` and put the answer on the finding; a
  // second implementation here could disagree with the CLI's suggestion
  const r = forReader(finding("UNDEF", { raw: "net_totl", suggestion: "net_total" }))!;
  expect(r.action).toEqual({ kind: "suggest", name: "net_total" });
  expect(r.row).toContain("net_totl");
});

test("a cycle offers the path", () => {
  const r = forReader(finding("CYCLE", { cyclePath: ["a", "b", "a"] }))!;
  expect(r.action).toEqual({ kind: "cycle", path: ["a", "b", "a"] });
});

test("an assertion's own line is quoted verbatim, and is not in the row", () => {
  const src = "assert lines.net_total > 0";
  const r = forReader(finding("ASSERT", { source: src }))!;
  expect(r.quote).toBe(src);
  expect(r.row).not.toContain("assert");
});

test("the advice/problem split agrees with the engine's own isProblem", () => {
  const disagreements: string[] = [];
  for (const code of ALL_CODES) {
    const f = finding(code);
    const r = forReader(f);
    if (r === null) continue;
    const engineSaysProblem = isProblem(f);
    if ((r.severity === "problem") !== engineSaysProblem) {
      disagreements.push(`${code}: plugin says ${r.severity}, engine says ${engineSaysProblem}`);
    }
  }
  expect(disagreements, disagreements.join("; ")).toEqual([]);
});

test("every finding the worked-example corpus produces gets words", () => {
  // the codes a synthetic Finding cannot tell you about: the ones the engine
  // actually emits, on documents that are in the repository
  const seen = new Set<FindingCode>();
  for (const file of readdirSync(docs).filter(
    (f) => f.startsWith("example-") && f.endsWith(".md"),
  )) {
    const model = build(locate(readFileSync(join(docs, file), "utf8")));
    const findings = check(model).findings;
    for (const f of findings) seen.add(f.code);
    // no throw, and a row for everything that is not a NOTE
    const rows = forReaderAll(findings);
    expect(rows.length).toBe(findings.filter((f) => f.code !== "NOTE").length);
  }
  expect(seen.size, "the corpus produced no findings at all — something is wrong").toBeGreaterThan(
    0,
  );
});
