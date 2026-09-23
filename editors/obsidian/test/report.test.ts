import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyEdits, build, check, fmt, isProblem, locate } from "visimark";
import { isClean, reportFor } from "../src/report.js";

/**
 * The findings view's model, checked against the two things it must not be
 * allowed to disagree with: the engine's own `isProblem`, and `fmt`.
 *
 * The claim that needs the most proof is the per-row repair. A button that
 * says it fixes *this* finding and quietly rewrites something else is worse
 * than no button, and a person in a vault has no `git diff` open to notice.
 */

const docs = resolve(import.meta.dir, "../../../docs");
const read = (name: string): string => readFileSync(join(docs, name), "utf8");
const drift = read("example-invoice-drift.md");
const clean = read("example-invoice.md");

function analyse(source: string) {
  const model = build(locate(source));
  return { model, result: check(model) };
}

const report = (source: string) => {
  const { model, result } = analyse(source);
  return reportFor(model, result);
};

test("a clean note has nothing to show", () => {
  const r = report(clean);
  expect(r.problems).toEqual([]);
  expect(r.advice).toEqual([]);
  expect(isClean(r)).toBe(true);
});

test("a drifted note shows one row per finding, and NOTE is not one", () => {
  const { result } = analyse(drift);
  const r = report(drift);
  const rows = r.problems.length + r.advice.length;
  expect(rows).toBe(result.findings.filter((f) => f.code !== "NOTE").length);
  expect(rows).toBeGreaterThan(0);
  expect(isClean(r)).toBe(false);
});

test("the problem/advice split is the engine's, not a second list", () => {
  const { result } = analyse(drift);
  const r = report(drift);
  const expectedProblems = result.findings.filter((f) => f.code !== "NOTE" && isProblem(f)).length;
  expect(r.problems.length).toBe(expectedProblems);
  for (const row of r.problems) expect(row.reader.severity).toBe("problem");
  for (const row of r.advice) expect(row.reader.severity).toBe("advice");
});

test("rows are in document order, so the list reads like the note", () => {
  const r = report(drift);
  const starts = r.problems.filter((x) => x.span !== null).map((x) => x.span!.start);
  expect([...starts].sort((a, b) => a - b)).toEqual(starts);
});

test("only a row whose finding fmt repairs carries a repair", () => {
  const r = report(drift);
  for (const row of [...r.problems, ...r.advice]) {
    if (row.repair !== null) {
      expect(row.reader.action, `${row.reader.code} carries edits but offers no repair`).toEqual({
        kind: "repair",
      });
    }
  }
  expect(r.problems.some((x) => x.repair !== null)).toBe(true);
});

test("no repair ever makes the list longer", () => {
  // the weakest thing worth promising per press, and it is weaker than it
  // looks like it should be on purpose: a name anchored in two places keeps a
  // row when the first is repaired, because the engine promotes the second
  // out of the collapsed anchor finding. The list shrinking every time is not
  // true; growing would be a defect. Convergence is the test below.
  const before = report(drift);
  const repairable = before.problems.filter((x) => x.repair !== null);
  expect(repairable.length).toBeGreaterThan(1);

  for (const row of repairable) {
    const after = report(applyEdits(drift, row.repair!));
    expect(
      after.problems.length,
      `repairing "${row.reader.row}" (${row.finding.name ?? "?"}) grew the list`,
    ).toBeLessThanOrEqual(before.problems.length);
  }
});

test("clicking every row, one at a time, arrives exactly where fmt does", () => {
  // what a person actually does, and the property that matters more than any
  // single row: the list is finite, each press makes it shorter, and the note
  // it leaves behind is the note `fmt` would have written.
  let text = drift;
  let presses = 0;
  for (;;) {
    const r = report(text);
    const next = [...r.problems, ...r.advice].find((x) => x.repair !== null);
    if (next === undefined) break;
    expect(++presses, "repairing is not converging").toBeLessThan(100);
    text = applyEdits(text, next.repair!);
  }
  expect(presses).toBeGreaterThan(5);
  expect(text).toBe(fmt(drift, { noArtifacts: true }).output);
});

test("a name anchored in two places keeps a row after one of them is repaired", () => {
  // surfaced faithfully rather than smoothed over: the engine reports the
  // first drifted site of a name and collapses the rest into the anchor row,
  // so repairing that site promotes the next one. A reader sees the count go
  // down by one, which is what happened.
  const before = report(drift);
  const row = before.problems.find((x) => x.finding.name === "gross_total" && x.repair !== null)!;
  const after = report(applyEdits(drift, row.repair!));
  const same = after.problems.filter((x) => x.finding.name === "gross_total");
  expect(same.length).toBe(1);
  expect(same[0]!.span!.start).not.toBe(row.span!.start);
});

test("every edit fmt would make belongs to a row the reader can see", () => {
  // the gap this closes: `planFmt` looks its finding up by span, and the
  // collapsed anchor finding has none, so two of the drift document's fifteen
  // edits arrive carrying a synthetic finding that is in no result. Dropped,
  // they would leave a reader who pressed every button with a note the CLI
  // still calls stale.
  const r = report(drift);
  const perRow = [...r.problems, ...r.advice].flatMap((x) => x.repair ?? []);
  expect(perRow.length).toBe(r.allRepairs.length);
  expect(applyEdits(drift, r.allRepairs)).toBe(fmt(drift, { noArtifacts: true }).output);
});

test("the collapsed anchor row is the one that adopts them", () => {
  const r = report(drift);
  const group = r.problems.find((x) => x.finding.anchorGroup === true);
  expect(group, "the drift document should produce a collapsed anchor row").toBeDefined();
  expect(group!.span).toBeNull();
  expect(group!.reader.row).toMatch(/^\d+ values in the text/);
  expect(group!.repair!.length).toBeGreaterThan(1);
});

test("a repaired note is clean, and repairing it again is a no-op", () => {
  const repaired = fmt(drift, { noArtifacts: true }).output;
  const r = report(repaired);
  expect(r.problems.filter((x) => x.repair !== null)).toEqual([]);
  expect(r.allRepairs).toEqual([]);
});

test("a stale chart is a row with no repair — the --no-artifacts contract", () => {
  // declining the write never silences the finding (spec §2.5, §8). v1 has no
  // vault-backed write port, so the row has to stay and the button must not
  // appear on it.
  const charts = read("example-charts.md");
  const broken = charts.replace(/\| 4120 \|/, "| 9999 |");
  const r = report(broken !== charts ? broken : charts);
  const chartRows = [...r.problems].filter((x) => x.reader.code === "STALE" && x.repair === null);
  for (const row of chartRows) {
    expect(row.reader.action).toBeNull();
  }
});

test("every worked example agrees with the engine about whether it is clean", () => {
  const files = ["example-invoice.md", "example-charts.md", "example-quote-plain.md"];
  for (const file of files) {
    const source = read(file);
    const { result } = analyse(source);
    const engineClean = result.findings.length === 0;
    expect(isClean(report(source)), `${file}`).toBe(engineClean);
  }
});
