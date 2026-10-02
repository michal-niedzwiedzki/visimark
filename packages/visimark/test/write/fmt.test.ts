import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { charts, clean, drift } from "../examples.js";
import { onDisk } from "../../src/fs/node-reader.js";
import { artifactsFor, fmt } from "../../src/write/fmt.js";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";

test("fmt leaves the clean invoice byte-for-byte identical", () => {
  const r = fmt(clean, {});
  expect(r.changed).toBe(false);
  expect(r.output).toBe(clean);
});

test("fmt repairs every STALE finding in the drift invoice", () => {
  const r = fmt(drift, {});
  expect(r.changed).toBe(true);
  const after = check(build(locate(r.output)));
  expect(after.findings.filter((f) => f.code === "STALE")).toEqual([]);
  // the five errors survive
  const codes = after.findings.map((f) => String(f.code)).sort();
  expect(codes).toEqual(["CYCLE", "DATE", "DATE", "NOTE", "UNDEF", "VECTOR"].sort());
  expect(r.unfixable.map((f) => String(f.code)).sort()).toEqual(
    ["CYCLE", "DATE", "DATE", "NOTE", "UNDEF", "VECTOR"].sort(),
  );
});

test("fmt --fix-dates rewrites the decidable date only", () => {
  const r = fmt(drift, { fixDates: true });
  // the schedule table row is repaired
  expect(r.output).toContain("| 12486.96 | 2026-10-15 |");
  // the ambiguous date is untouched
  expect(r.output).toContain("| 11/12/2026 |");
  expect(r.datesFixed).toBe(1);
  // without the flag the decidable date stays put
  expect(fmt(drift, {}).output).toContain("| 15.10.2026 |");
});

test("fmt is idempotent", () => {
  for (const src of [clean, drift]) {
    const once = fmt(src, {}).output;
    const twice = fmt(once, {}).output;
    expect(twice).toBe(once);
  }
  const d1 = fmt(drift, { fixDates: true }).output;
  const d2 = fmt(d1, { fixDates: true }).output;
  expect(d2).toBe(d1);
});

test("a one-cell corruption produces a one-line diff", () => {
  const corrupted = clean.replace("| 50.00 |", "| 51.00 |");
  // fall back: the clean invoice has no `50.00`; corrupt the first Net cell
  const src = clean.includes("| 50.00 |") ? corrupted : clean.replace("3600.00", "3600.01");
  const out = fmt(src, {}).output;
  const changedLines = diffLines(src, out);
  expect(changedLines).toBe(1);
});

test("fmt rewrites a stale cell but never rewrites Σ/∑ to SUM, or back", () => {
  const table = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |
`;
  for (const glyph of ["Σ", "∑"]) {
    const src = `${table}
\`\`\`vmark #order
Net = Price * Qty
total = ${glyph}(Net)
\`\`\`

Total: **1.00**<!--vmark=order.total-->
`;
    const once = fmt(src, {});
    expect(once.changed).toBe(true);
    // the rule text keeps the author's own spelling, untouched
    expect(once.output).toContain(`total = ${glyph}(Net)`);
    expect(once.output).not.toContain("total = SUM(Net)");
    // the anchored value is rewritten to the current total
    expect(once.output).toContain("Total: **10.00**<!--vmark=order.total-->");
    const after = check(build(locate(once.output)));
    expect(after.findings.filter((f) => f.code === "STALE")).toEqual([]);
    // idempotent
    const twice = fmt(once.output, {});
    expect(twice.output).toBe(once.output);
  }
});

test("fmt rewrites a stale cell but never rewrites a prose spelling to its named form", () => {
  const table = `| Item | Price | Qty |   Gap |
|------|------:|----:|------:|
| pen  |  5.00 |   2 |  9.99 |
`;
  for (const [prose, named] of [
    ["|Price - Qty|", "ABS(Price - Qty)"],
    ["⌊Price⌋", "FLOOR(Price, 1)"],
    ["⌈Price⌉", "CEILING(Price, 1)"],
  ] as const) {
    const src = `${table}
\`\`\`vmark #order
Gap precision 2 = ${prose}
\`\`\`
`;
    const once = fmt(src, {});
    expect(once.changed).toBe(true);
    // the rule text keeps the author's own spelling, untouched
    expect(once.output).toContain(`Gap precision 2 = ${prose}`);
    expect(once.output).not.toContain(named);
    expect(check(build(locate(once.output))).findings.filter((f) => f.code === "STALE")).toEqual(
      [],
    );
    // idempotent
    expect(fmt(once.output, {}).output).toBe(once.output);
  }
});

test("fmt writes percent form on a |percent comment and is idempotent", () => {
  const src = `Margin **0.4155**<!--vmark=s.margin|percent-->.

\`\`\`vmark #s
margin precision 4 = 0.4026
\`\`\`
`;
  const once = fmt(src, {});
  expect(once.changed).toBe(true);
  expect(once.output).toContain("**40.26%**<!--vmark=s.margin|percent-->");
  expect(fmt(once.output, {}).output).toBe(once.output);
  expect(check(build(locate(once.output))).exitCode).toBe(0);
});

test("fmt without a display rule rewrites a percent-shaped span to toFixed", () => {
  const src = `Reserved **20.00%**<!--vmark=s.x-->.

\`\`\`vmark #s
x precision 2 = 20%
\`\`\`
`;
  const once = fmt(src, {});
  expect(once.output).toContain("**0.20**<!--vmark=s.x-->");
  expect(once.output).not.toContain("20.00%");
});

test("fmt does not rewrite a |percent span that is PRECISION", () => {
  const src = `X **1**<!--vmark=s.n|percent-->.

\`\`\`vmark #s
n precision 1 = 1
\`\`\`
`;
  const once = fmt(src, {});
  expect(once.output).toBe(src);
});

// ── |unit (#323) ────────────────────────────────────────────────────────────

const unitSrc = (seed: string, decl = "total [PLN] precision 2 = 3.5 [PLN]") => `X ${seed}.

\`\`\`vmark #s
${decl}
\`\`\`
`;

test("fmt writes a |unit span exactly and is idempotent", () => {
  for (const seed of ["_", "$3.50", "3.50 EUR", "3.50  PLN", "3.5", "24000.00 PLN"]) {
    const once = fmt(unitSrc(`**${seed}**<!--vmark=s.total|unit-->`), {});
    expect(once.output).toContain("X **3.50 PLN**<!--vmark=s.total|unit-->.");
    expect(fmt(once.output, {}).changed).toBe(false);
    expect(check(build(locate(once.output))).exitCode).toBe(0);
  }
});

test("fmt normalises a |unit spelling but keeps a plain anchor's", () => {
  const src = unitSrc(
    "**5 m^2**<!--vmark=s.area|unit--> and **5 m^2**<!--vmark=s.area-->",
    "area [m²] precision 0 = 6 [m²]",
  );
  const once = fmt(src, {});
  expect(once.output).toContain(
    "**6 m²**<!--vmark=s.area|unit--> and **6 m^2**<!--vmark=s.area-->",
  );
});

test("fmt leaves a |unit anchor on a dimensionless value untouched", () => {
  const src = unitSrc("**_**<!--vmark=s.n|unit-->", "n precision 2 = 3");
  expect(fmt(src, {}).output).toBe(src);
});

test("fmt keeps a digit-bearing unit on a plain anchor instead of stripping it", () => {
  const src = unitSrc("**50 1/s**<!--vmark=s.rate-->", "rate [1/s] precision 0 = 51 [1/s]");
  expect(fmt(src, {}).output).toContain("**51 1/s**<!--vmark=s.rate-->");
});

function diffLines(a: string, b: string): number {
  const la = a.split("\n");
  const lb = b.split("\n");
  let n = 0;
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) n++;
  }
  return n;
}

// docs/design/a-no-artifacts-flag-for-fmt-spec.md §3 — the engine gate.

test("noArtifacts withholds the artifacts and counts them, changing nothing else", () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-fmt-na-"));
  const p = join(dir, "example-charts.md");
  writeFileSync(p, charts);
  const doc = onDisk(p);

  const plain = fmt(charts, { doc });
  const declined = fmt(charts, { doc, noArtifacts: true });

  // the five missing artifacts are found either way — one is withheld
  expect(plain.artifacts).toHaveLength(5);
  expect(plain.artifactsSkipped).toBe(0);
  expect(declined.artifacts).toEqual([]);
  expect(declined.artifactsSkipped).toBe(5);

  // every other member of the result is untouched by the flag
  expect(declined.output).toBe(plain.output);
  expect(declined.changed).toBe(plain.changed);
  expect(declined.cellsUpdated).toBe(plain.cellsUpdated);
  expect(declined.anchorsUpdated).toBe(plain.anchorsUpdated);
  expect(declined.datesFixed).toBe(plain.datesFixed);
  expect(declined.stampsUpdated).toBe(plain.stampsUpdated);

  rmSync(dir, { recursive: true, force: true });
});

// v1.1 row 14 — a caller (the Obsidian plugin) that already has a
// `CheckResult` reads the same artifact set off it directly, with no second
// `fmt`/`check` run, and it agrees with what `fmt` itself would write.
test("artifactsFor reads the same artifact set fmt() computes from an already-run check()", () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-fmt-af-"));
  const p = join(dir, "example-charts.md");
  writeFileSync(p, charts);
  const doc = onDisk(p);

  const result = check(build(locate(charts)), { doc });
  const direct = artifactsFor(result);
  const viaFmt = fmt(charts, { doc }).artifacts;

  expect(direct).toHaveLength(5);
  expect(direct).toEqual(viaFmt);

  rmSync(dir, { recursive: true, force: true });
});

/**
 * The regression that keeps `fmt --no-artifacts` at exit `0`.
 *
 * `cmdFmt` raises the exit code to `1` when `unfixable` is non-empty, and a
 * chart's STALE finding is excluded from it by `FIXABLE_BY_FMT` — before the
 * write loop runs, and so regardless of whether the SVG was written. That is
 * load-bearing for the flag but holds only incidentally, which is why it is
 * pinned here: move STALE out of `FIXABLE_BY_FMT` and `fmt --no-artifacts`
 * silently starts failing the builds it exists to serve.
 */
test("a chart's STALE finding is never in the unfixable remainder", () => {
  const dir = mkdtempSync(join(tmpdir(), "vm-fmt-na2-"));
  const p = join(dir, "example-charts.md");
  writeFileSync(p, charts);
  const doc = onDisk(p);

  // the document really does have five stale charts to be tempted by
  const found = check(build(locate(charts)), { doc });
  expect(found.findings.filter((f) => f.code === "STALE")).toHaveLength(5);

  expect(fmt(charts, { doc }).unfixable).toEqual([]);
  expect(fmt(charts, { doc, noArtifacts: true }).unfixable).toEqual([]);

  rmSync(dir, { recursive: true, force: true });
});

// docs/design/a-param-declares-the-set-of-values-it-ac-spec.md — fmt never
// writes a domain clause, in any of its spellings.
test("fmt leaves a param's domain clause untouched, in every spelling", () => {
  const doc =
    "```vmark #levers\n" +
    "param extra_hours precision 0 integer in [0, 80] = default 40\n" +
    "param code precision 0 ℤ in [0, 5] = default 1\n" +
    "param prepay_share precision 2 in { 30%, 40%, 45%, 50% } = default 30%\n" +
    "param days precision 0 natural in [0, 8] = default 0\n" +
    "param z precision 0 ℕ in [0, 8] = default 0\n" +
    "param staff precision 0 positive integer = default 1\n" +
    "param s2 precision 0 ℤ⁺ = default 1\n" +
    "param share precision 2 ∈ [0%, 15%] = default 5%\n" +
    "```\n";
  const once = fmt(doc, {});
  expect(once.changed).toBe(false);
  expect(once.output).toBe(doc);
  const twice = fmt(once.output, {});
  expect(twice.changed).toBe(false);
  expect(twice.output).toBe(doc);
});

test("fmt never writes a span this feature's ANCHOR check refuses", () => {
  const doc =
    "```vmark #s\n" +
    "b precision 2 = 0.25\n" +
    "```\n" +
    "\n" +
    "It comes to <!--vmark=s.b--> PLN.\n";
  const r = fmt(doc, {});
  expect(r.changed).toBe(false);
  expect(r.output).toBe(doc);
  const after = check(build(locate(r.output)));
  expect(after.findings.map((f) => f.code)).toEqual(["ANCHOR"]);
});

// ---- |nbsp (#305) ----

const nbspDoc = (value: string, prose: string) =>
  `\`\`\`vmark #s\nstatus = ${JSON.stringify(value)}\n\`\`\`\n\n${prose}\n`;

test("fmt rewrites a drifted |nbsp span and is idempotent", () => {
  const src = nbspDoc("paid in full", "Status **past&nbsp;due**<!--vmark=s.status|nbsp-->.");
  const once = fmt(src, {});
  expect(once.changed).toBe(true);
  expect(once.output).toContain("**paid&nbsp;in&nbsp;full**<!--vmark=s.status|nbsp-->");
  const twice = fmt(once.output, {});
  expect(twice.changed).toBe(false);
  expect(twice.output).toBe(once.output);
});

test("fmt seeds a **_** placeholder under |nbsp", () => {
  const r = fmt(nbspDoc("past due", "Status **_**<!--vmark=s.status|nbsp-->."), {});
  expect(r.output).toContain("**past&nbsp;due**<!--vmark=s.status|nbsp-->");
});

test("fmt normalises a hand-typed &#160; to &nbsp;", () => {
  const r = fmt(nbspDoc("past due", "Status **past&#160;due**<!--vmark=s.status|nbsp-->."), {});
  expect(r.output).toContain("**past&nbsp;due**<!--vmark=s.status|nbsp-->");
});

test("fmt never writes a |nbsp anchor check refused", () => {
  for (const prose of [
    "Star **_**<!--vmark=s.status|nbsp-->.",
    "Code `past due`<!--vmark=s.status|nbsp-->.",
  ]) {
    const value = prose.startsWith("Star") ? "a *b* c" : "past due";
    const src = nbspDoc(value, prose);
    const r = fmt(src, {});
    expect(r.changed).toBe(false);
    expect(r.output).toBe(src);
  }
});

test("fmt never writes a plain string anchor", () => {
  const src = nbspDoc("paid in full", "Status **past due**<!--vmark=s.status-->.");
  expect(fmt(src, {}).output).toBe(src);
});

test("fmt writes every |nbsp anchor of a drifted scalar in one run", () => {
  const src = nbspDoc(
    "paid in full",
    "**Status:** **past&nbsp;due**<!--vmark=s.status|nbsp--> &nbsp;&nbsp; **Also:** *past&nbsp;due*<!--vmark=s.status|nbsp-->\n\nPlain **past due**<!--vmark=s.status-->.",
  );
  const r = fmt(src, {});
  expect(r.output).toContain(
    "**Status:** **paid&nbsp;in&nbsp;full**<!--vmark=s.status|nbsp--> &nbsp;&nbsp; **Also:** *paid&nbsp;in&nbsp;full*<!--vmark=s.status|nbsp-->",
  );
  // the separator and the plain anchor are prose fmt never reads
  expect(r.output).toContain("Plain **past due**<!--vmark=s.status-->.");
  expect(check(build(locate(r.output))).exitCode).toBe(0);
});
