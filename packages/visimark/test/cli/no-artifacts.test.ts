import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/cli/main.js";

// docs/design/a-no-artifacts-flag-for-fmt-spec.md §4 — the behaviour table.
//
// `--no-artifacts` declines the write of generated artifacts and nothing else.
// The two arrangements are the spec's: `A` is example-charts.md with its
// `charts/` directory absent (five artifacts missing, document otherwise
// clean); `B` is the same document with `charts/` present and Jan's Revenue
// bumped, which is the issue's motivating case — one stale cell, two stale
// anchors, three stale artifacts.

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "..", "..", "..", "docs");
const chartsDoc = join(docs, "example-charts.md");
const chartsDir = join(docs, "charts");
const invoice = join(docs, "example-invoice.md");

const tmp = mkdtempSync(join(tmpdir(), "vm-no-artifacts-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let n = 0;

/** `A`: the chart document alone, with no `charts/` directory beside it. */
function arrangeA(): string {
  const dir = join(tmp, `a${n++}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(dirname(chartsDoc), dir, {
    recursive: true,
    filter: (src) => src === dirname(chartsDoc) || src === chartsDoc,
  });
  return dir;
}

/** `B`: the chart document with its committed artifacts, and one input bumped
 *  so that a cell, two anchors and three of the five charts go stale. */
function arrangeB(): string {
  const dir = join(tmp, `b${n++}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(chartsDir, join(dir, "charts"), { recursive: true });
  const doc = join(dir, "example-charts.md");
  copyFileSync(chartsDoc, doc);
  const src = readFileSync(doc, "utf8");
  const bumped = src.replace("| Jan   | 48200.00 |", "| Jan   | 50000.00 |");
  expect(bumped).not.toBe(src); // the fixture must actually change
  writeFileSync(doc, bumped);
  return dir;
}

async function run(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(args, {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

function svgs(dir: string): Record<string, string> {
  const d = join(dir, "charts");
  if (!existsSync(d)) return {};
  const m: Record<string, string> = {};
  for (const f of readdirSync(d)) m[f] = readFileSync(join(d, f), "utf8");
  return m;
}

describe("fmt --no-artifacts", () => {
  test("row 1: artifacts only, declined — names the count and creates nothing", async () => {
    const dir = arrangeA();
    const doc = join(dir, "example-charts.md");
    const before = readFileSync(doc, "utf8");

    const r = await run(["fmt", "--no-artifacts", doc]);

    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    expect(r.out).toBe(`${doc}: unchanged, 5 artifacts skipped`);
    // nothing was created: the caller's tree holds only the file it named
    expect(readdirSync(dir)).toEqual(["example-charts.md"]);
    expect(readFileSync(doc, "utf8")).toBe(before);
  });

  test("row 2: value repair plus declined artifacts — the SVGs are untouched", async () => {
    const dir = arrangeB();
    const doc = join(dir, "example-charts.md");
    const before = svgs(dir);

    const r = await run(["fmt", "--no-artifacts", doc]);

    expect(r.code).toBe(0);
    expect(r.err).toBe("");
    expect(r.out).toBe(`${doc}: updated 1 cell, 2 anchors, 3 artifacts skipped`);
    // the document was repaired...
    expect(readFileSync(doc, "utf8")).toContain("18900.00");
    // ...and every artifact is byte-identical to what it was
    expect(svgs(dir)).toEqual(before);
  });

  test("row 4: without the flag, today's behaviour is byte-for-byte", async () => {
    const dir = arrangeB();
    const doc = join(dir, "example-charts.md");
    const before = svgs(dir);

    const r = await run(["fmt", doc]);

    expect(r.code).toBe(0);
    expect(r.out).toBe(`${doc}: updated 1 cell, 2 anchors, 3 artifacts`);
    const after = svgs(dir);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    // three of the five were rewritten
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
    expect(changed).toHaveLength(3);
  });

  test("row 5: a document that declares no chart gets no skipped clause", async () => {
    const doc = join(tmp, "invoice.md");
    copyFileSync(invoice, doc);

    const r = await run(["fmt", "--no-artifacts", doc]);

    expect(r.code).toBe(0);
    expect(r.out).toBe(`${doc}: unchanged`);
    expect(r.out).not.toContain("skipped");
  });

  test("row 6: composes with --fix-dates", async () => {
    const dir = arrangeB();
    const doc = join(dir, "example-charts.md");
    const before = svgs(dir);

    const r = await run(["fmt", "--fix-dates", "--no-artifacts", doc]);

    expect(r.code).toBe(0);
    expect(r.out).toBe(`${doc}: updated 1 cell, 2 anchors, 3 artifacts skipped`);
    expect(svgs(dir)).toEqual(before);
  });

  test("row 14: repeating the flag is the same as giving it once", async () => {
    const dir = arrangeA();
    const doc = join(dir, "example-charts.md");

    const r = await run(["fmt", "--no-artifacts", "--no-artifacts", doc]);

    expect(r.code).toBe(0);
    expect(r.out).toBe(`${doc}: unchanged, 5 artifacts skipped`);
    expect(readdirSync(dir)).toEqual(["example-charts.md"]);
  });

  test("row 3: check is unaffected — the charts are still missing, still exit 1", async () => {
    const dir = arrangeA();
    const doc = join(dir, "example-charts.md");

    await run(["fmt", "--no-artifacts", doc]);
    const r = await run(["check", doc]);

    expect(r.code).toBe(1);
    expect(r.out).toContain("5 problems (5 stale, 0 errors)");
    expect(r.out).toContain("artifact missing at");
  });

  test("row 9: an unfixable finding still exits 1, and the clause is still printed", async () => {
    const dir = arrangeA();
    const doc = join(dir, "example-charts.md");
    // a param whose width nobody declared is a PRECISION finding, which fmt
    // cannot repair — the flag must not lower the exit code it produces
    const src = readFileSync(doc, "utf8");
    const withPrecision = src.replace(
      "total_revenue = SUM(Revenue)",
      "param target = default 100000\ntotal_revenue = SUM(Revenue)",
    );
    expect(withPrecision).not.toBe(src);
    writeFileSync(doc, withPrecision);

    const r = await run(["fmt", "--no-artifacts", doc]);

    expect(r.code).toBe(1);
    expect(r.out).toContain("5 artifacts skipped");
    expect(r.out).toContain("PRECISION");
  });
});
