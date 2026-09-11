import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { resolveImports } from "../../src/import/resolve.js";

let dir: string;
let docPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "vmark-import-"));
  docPath = join(dir, "report.md");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function csv(name: string, content: string): void {
  writeFileSync(join(dir, name), content);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function modelFor(src: string) {
  return build(locate(src));
}

test("missing file is an IMPORT finding", () => {
  const m = modelFor("```vmark #benchmark from benchmark.csv\n```\n");
  const { findings, statuses } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.code).toBe("IMPORT");
  expect(findings[0]!.message).toContain("not found");
  expect(statuses.get("benchmark")!.state).toBe("error");
});

test("unstamped import: valid CSV, one IMPORT finding, table populated", () => {
  csv("benchmark.csv", "Id,Time\n1,12.3\n2,10.1\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv\nMean = AVG(benchmark.Time)\n```\n");
  const { findings, statuses } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.code).toBe("IMPORT");
  expect(findings[0]!.message).toContain("unstamped");
  expect(statuses.get("benchmark")!.state).toBe("unstamped");
  const sheet = m.sheets.get("benchmark")!;
  expect(sheet.table?.rows.length).toBe(2);
  expect(sheet.columnIndex.get("Time")).toBe(1);
});

test("matching stamp: no findings", () => {
  const content = "Id,Time\n1,12.3\n2,10.1\n";
  csv("benchmark.csv", content);
  const digest = sha256(content);
  const m = modelFor(`\`\`\`vmark #benchmark from benchmark.csv at sha256:${digest}\n\`\`\`\n`);
  const { findings, statuses } = resolveImports(m, docPath);
  expect(findings).toHaveLength(0);
  expect(statuses.get("benchmark")!.state).toBe("ok");
});

test("mismatching stamp: STALE finding, table still populated", () => {
  csv("benchmark.csv", "Id,Time\n1,12.3\n2,10.1\n3,15.0\n");
  const wrongDigest = "0".repeat(64);
  const m = modelFor(
    `\`\`\`vmark #benchmark from benchmark.csv at sha256:${wrongDigest}\n\`\`\`\n`,
  );
  const { findings, statuses } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.code).toBe("STALE");
  expect(findings[0]!.message).toContain("recorded stamp");
  expect(statuses.get("benchmark")!.state).toBe("stale");
  expect(m.sheets.get("benchmark")!.table?.rows.length).toBe(3);
});

test("malformed digest (wrong length) is an IMPORT finding, no STALE", () => {
  csv("benchmark.csv", "Id,Time\n1,12.3\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv at sha256:abc\n```\n");
  const { findings } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.code).toBe("IMPORT");
  expect(findings[0]!.message).toContain("malformed digest");
});

test("unrecognised stamp prefix is an IMPORT finding", () => {
  csv("benchmark.csv", "Id,Time\n1,12.3\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv at md5:" + "a".repeat(32) + "\n```\n");
  const { findings } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.message).toContain("unrecognised stamp prefix");
});

test("labelled mismatch is an IMPORT finding naming both lists", () => {
  csv("benchmark.csv", "Id,Time\n1,12.3\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv labelled Id, Time, Extra\n```\n");
  const { findings } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.message).toContain("Id, Time, Extra");
  expect(findings[0]!.message).toContain("Id, Time");
});

test("path-gate violation (traversal) is an IMPORT finding", () => {
  const m = modelFor("```vmark #benchmark from ../../../etc/passwd.csv\n```\n");
  const { findings } = resolveImports(m, docPath);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.message).toContain("escapes");
});

test("a binding shadowing an imported column is an IMPORT finding, removed from scalars", () => {
  csv("benchmark.csv", "Id,Time\n1,12.3\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv\nTime = 0\n```\n");
  const { findings } = resolveImports(m, docPath);
  const shadow = findings.find((f) => f.message?.includes("column rule on an imported sheet"));
  expect(shadow).toBeDefined();
  expect(m.sheets.get("benchmark")!.scalars.has("Time")).toBe(false);
});

test("duplicate header names are an IMPORT finding", () => {
  csv("benchmark.csv", "Id,Id\n1,2\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv\n```\n");
  const { findings } = resolveImports(m, docPath);
  expect(findings[0]!.message).toContain("duplicate column");
});

test("mixed line endings surface as an IMPORT finding via the CSV parser", () => {
  csv("benchmark.csv", "Id,Time\r\n1,12.3\n");
  const m = modelFor("```vmark #benchmark from benchmark.csv\n```\n");
  const { findings } = resolveImports(m, docPath);
  expect(findings[0]!.message).toContain("mixed line endings");
});
