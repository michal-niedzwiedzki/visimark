import { expect, test, describe } from "bun:test";
import { onDisk } from "../src/fs/node-reader.js";
import { bandwidth, charts, chartsPath, chartFailPath, clean, drift } from "./examples.js";
import { locate } from "../src/parse/document.js";
import { build } from "../src/model/build.js";
import { check } from "../src/eval/check.js";
import { fmt } from "../src/write/fmt.js";
import { formatCheck } from "../src/report/format.js";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const run = (s: string) => check(build(locate(s)));

describe("the two worked examples are the acceptance suite", () => {
  test("example-invoice.md: zero findings", () => {
    const r = run(clean);
    expect(r.findings).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  test("example-invoice.md: fmt is byte-for-byte identical", () => {
    expect(fmt(clean, {}).output).toBe(clean);
  });

  test("example-invoice-drift.md: check output equals the doc's own transcript", () => {
    const all = drift.split("\n");
    const start = all.findIndex((l) => l.trim() === "```console");
    const end = all.findIndex((l, i) => i > start && l.trim() === "```");
    const expected = all.slice(start + 2, end).join("\n");
    expect(formatCheck("docs/example-invoice-drift.md", run(drift).findings)).toBe(expected);
  });

  test("example-invoice-drift.md: 26 problems (21 stale, 5 errors) plus one NOTE", () => {
    const f = run(drift).findings;
    const stale = f
      .filter((x) => x.code === "STALE")
      .reduce((n, x) => n + (x.anchorGroup ? x.suppressedCount! : 1), 0);
    const errorCodes = new Set(["DATE", "UNDEF", "VECTOR", "CYCLE", "TYPE", "SHEET", "ANCHOR"]);
    expect(stale).toBe(21);
    expect(f.filter((x) => errorCodes.has(x.code)).length).toBe(5);
    expect(f.filter((x) => x.code === "NOTE").length).toBe(1);
  });

  test("fmt is idempotent on both examples", () => {
    for (const src of [clean, drift]) {
      const once = fmt(src, {}).output;
      expect(fmt(once, {}).output).toBe(once);
    }
  });

  test("fmt clears every STALE finding in the drift invoice", () => {
    const fixed = fmt(drift, {}).output;
    expect(run(fixed).findings.filter((x) => x.code === "STALE")).toEqual([]);
  });
});

describe("example-charts.md is the generated-artifact acceptance", () => {
  const run = (s: string, docPath: string) => check(build(locate(s)), { doc: onDisk(docPath) });

  test("zero findings, with all artifacts committed and current", () => {
    const r = run(charts, chartsPath);
    expect(r.findings).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  test("every chart reports itself current", () => {
    const r = run(charts, chartsPath);
    expect(r.charts.map((c) => c.state)).toEqual(Array(5).fill("current"));
    expect(r.charts.map((c) => c.engine)).toEqual(["bar", "line", "stacked-bar", "pie", "area"]);
  });

  test("fmt leaves the document and all artifacts untouched", () => {
    const r = fmt(charts, { doc: onDisk(chartsPath) });
    expect(r.output).toBe(charts);
    expect(r.artifacts).toEqual([]);
  });

  test("a deleted artifact is STALE and fmt restores it byte-identically", () => {
    const target = join(dirname(chartsPath), "charts", "example-charts-audience.svg");
    const original = readFileSync(target, "utf8");
    rmSync(target);
    try {
      const stale = run(charts, chartsPath).findings.filter((f) => f.code === "STALE");
      expect(stale).toHaveLength(1);
      expect(stale[0]!.message).toContain("artifact missing");

      const r = fmt(charts, { doc: onDisk(chartsPath) });
      expect(r.artifacts).toHaveLength(1);
      expect(r.artifacts[0]!.svg).toBe(original);
    } finally {
      writeFileSync(target, original);
    }
  });

  test("chart-fail.md: a pie of negative values is a single ARTIFACT error", () => {
    const src = readFileSync(chartFailPath, "utf8");
    const r = run(src, chartFailPath);
    expect(formatCheck("chart-fail.md", r.findings)).toBe(
      [
        "chart-fail.md",
        "",
        "  ARTIFACT ledger.balances   pie of `Balance` contains a negative value (-450.00, row 3)",
        "",
        "  1 problem (0 stale, 1 error)",
      ].join("\n"),
    );
    expect(r.exitCode).toBe(1);
    expect(fmt(src, { doc: onDisk(chartFailPath) }).artifacts).toEqual([]);
  });
});

describe("example-bandwidth.md is the column-aliases acceptance", () => {
  test("zero findings", () => {
    const r = run(bandwidth);
    expect(r.findings).toEqual([]);
    expect(r.exitCode).toBe(0);
  });

  test("fmt is byte-for-byte identical", () => {
    expect(fmt(bandwidth, {}).output).toBe(bandwidth);
  });

  test("the sheet's aliases name both the aliased input column and the aliased output column", () => {
    const model = build(locate(bandwidth));
    const sheet = model.sheets.get("network")!;
    expect(sheet.aliases.get("bpu")).toMatchObject({
      header: "Bandwidth per Unit (TB/s, full-duplex)",
    });
    expect(sheet.aliases.get("gpu_bw")).toMatchObject({
      header: "GPU-to-GPU Bandwidth (GB/s, full-duplex)",
    });
    // gpu_bw is written through its alias, so the rule is keyed by the header,
    // not the alias symbol (see test/model/aliases.test.ts for why).
    expect(sheet.columns.has("GPU-to-GPU Bandwidth (GB/s, full-duplex)")).toBe(true);
  });

  test("peak is the larger of the two rows' GPU-to-GPU bandwidth", () => {
    const r = run(bandwidth);
    const peak = r.values.get("network.peak")!;
    expect(peak.t).toBe("num");
    expect(peak.t === "num" ? peak.d.toString() : undefined).toBe("400");
  });
});
