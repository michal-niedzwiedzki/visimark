/**
 * The acceptance transcript from
 * `docs/design/declared-local-data-imports-spec.md` §6, item by item.
 *
 * Only the clean pair (`fixtures/import/benchmark.{md,csv}`) is committed;
 * every negative variant is generated in memory from it (per the plan's Task
 * 8 note) except item 8, which needs a real, disposable directory to prove
 * `fmt` never touches the CSV and is idempotent.
 */
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { locate } from "../src/parse/document.js";
import { build } from "../src/model/build.js";
import { check } from "../src/eval/check.js";
import { fmt } from "../src/write/fmt.js";

const FIXTURE_DIR = join(import.meta.dir, "fixtures", "import");
const MD_PATH = join(FIXTURE_DIR, "benchmark.md");
const DIGEST = "c4e418b2a0f4bdc584b99007dcfd39e200b51ff3555e66ae5d42694e0bbd19ee";

function checkSource(md: string, docPath: string = MD_PATH) {
  const model = build(locate(md));
  return check(model, { docPath });
}

test("1. clean: 0 problems", () => {
  const source = readFileSync(MD_PATH, "utf8");
  const result = checkSource(source);
  expect(result.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  expect(result.exitCode).toBe(0);
});

test("2. unstamped: one IMPORT finding, exit 1", () => {
  const source = readFileSync(MD_PATH, "utf8").replace(` at sha256:${DIGEST}`, "");
  const result = checkSource(source);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("unstamped");
  expect(result.exitCode).toBe(1);
});

test("3. stale: one STALE finding on the import; fmt corrects it and leaves the CSV untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "vmark-accept-"));
  try {
    cpSync(FIXTURE_DIR, dir, { recursive: true });
    const mdPath = join(dir, "benchmark.md");
    const csvPath = join(dir, "benchmark.csv");
    // change the last row, staling the recorded stamp
    writeFileSync(csvPath, "Id,Time\n1,12.3\n2,10.1\n3,99.9\n");
    const csvBefore = readFileSync(csvPath);

    const source = readFileSync(mdPath, "utf8");
    const model = build(locate(source));
    const result = check(model, { docPath: mdPath });
    const staleFindings = result.findings.filter((f) => f.code === "STALE");
    expect(staleFindings).toHaveLength(1);
    expect(result.exitCode).toBe(1);

    const fmtResult = fmt(source, { docPath: mdPath });
    expect(fmtResult.changed).toBe(true);
    expect(fmtResult.stampsUpdated).toBe(1);
    writeFileSync(mdPath, fmtResult.output);

    const csvAfter = readFileSync(csvPath);
    expect(csvAfter.equals(csvBefore)).toBe(true);

    const secondCheck = checkSource(readFileSync(mdPath, "utf8"), mdPath);
    expect(secondCheck.findings.filter((f) => f.code === "STALE")).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("4. missing file: one IMPORT finding, exit 1", () => {
  const source = readFileSync(MD_PATH, "utf8").replace("benchmark.csv", "nope.csv");
  const result = checkSource(source);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("not found");
  expect(result.exitCode).toBe(1);
});

test("5. labelled mismatch: one IMPORT finding naming both lists, exit 1", () => {
  const source = readFileSync(MD_PATH, "utf8").replace(
    "labelled Id, Time",
    "labelled Id, Time, Extra",
  );
  const result = checkSource(source);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("Id, Time, Extra");
  expect(result.exitCode).toBe(1);
});

test("6. column rule attempted: one IMPORT finding, exit 1", () => {
  const source = readFileSync(MD_PATH, "utf8").replace("Mean = AVG(benchmark.Time)", "Time = 0");
  const result = checkSource(source);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings.some((f) => f.message?.includes("column rule on an imported sheet"))).toBe(
    true,
  );
  expect(result.exitCode).toBe(1);
});

test("7. path-gate violation: one IMPORT finding, exit 1", () => {
  const source = readFileSync(MD_PATH, "utf8").replace("benchmark.csv", "../../../etc/passwd.csv");
  const result = checkSource(source);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("escapes");
  expect(result.exitCode).toBe(1);
});

test("8. fmt idempotence: a second fmt on an already-correct import is a no-op", () => {
  const dir = mkdtempSync(join(tmpdir(), "vmark-accept-"));
  try {
    cpSync(FIXTURE_DIR, dir, { recursive: true });
    const mdPath = join(dir, "benchmark.md");
    const csvPath = join(dir, "benchmark.csv");
    const source = readFileSync(mdPath, "utf8");

    const first = fmt(source, { docPath: mdPath });
    expect(first.changed).toBe(false);

    const second = fmt(first.output, { docPath: mdPath });
    expect(second.output).toBe(first.output);
    expect(second.changed).toBe(false);

    // the CSV itself was never opened for writing
    const csvBytes = readFileSync(csvPath, "utf8");
    expect(csvBytes).toBe("Id,Time\n1,12.3\n2,10.1\n3,15.0\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// `unlabelled` clause for headerless CSV imports — spec §6, the same
// clean-committed / negative-in-memory pattern as the `labelled` transcript
// above. See docs/design/explicit-schema-for-headerless-csv-imports-spec.md.

const HEADERLESS_MD_PATH = join(FIXTURE_DIR, "benchmark-headerless.md");
const HEADERLESS_DIGEST = "b492bea9f8ec9dd0af99331e30c96692dcfec70ad402023d4638d5ada7c20290";

test("unlabelled 1. clean: 0 problems", () => {
  const source = readFileSync(HEADERLESS_MD_PATH, "utf8");
  const result = checkSource(source, HEADERLESS_MD_PATH);
  expect(result.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  expect(result.exitCode).toBe(0);
});

test("unlabelled 2. too few names: one IMPORT finding naming row 1, exit 1", () => {
  const source = readFileSync(HEADERLESS_MD_PATH, "utf8").replace(
    "unlabelled Id, Time",
    "unlabelled Id",
  );
  const result = checkSource(source, HEADERLESS_MD_PATH);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("too few names");
  expect(importFindings[0]!.message).toContain("row 1");
  expect(result.exitCode).toBe(1);
});

test("unlabelled 3. too many names: one IMPORT finding naming row 1, exit 1", () => {
  const source = readFileSync(HEADERLESS_MD_PATH, "utf8").replace(
    "unlabelled Id, Time",
    "unlabelled Id, Time, Extra",
  );
  const result = checkSource(source, HEADERLESS_MD_PATH);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("too many names");
  expect(importFindings[0]!.message).toContain("row 1");
  expect(result.exitCode).toBe(1);
});

test("unlabelled 4. ragged data (row 3, not row 1): one IMPORT finding naming that row, exit 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "vmark-accept-"));
  try {
    cpSync(FIXTURE_DIR, dir, { recursive: true });
    const mdPath = join(dir, "benchmark-headerless.md");
    const csvPath = join(dir, "benchmark-headerless.csv");
    writeFileSync(csvPath, "1,12.3\n2,10.1\n3,15.0,extra\n");
    const digest = createHash("sha256").update(readFileSync(csvPath)).digest("hex");
    const source = readFileSync(mdPath, "utf8").replace(HEADERLESS_DIGEST, digest);
    const result = checkSource(source, mdPath);
    const importFindings = result.findings.filter((f) => f.code === "IMPORT");
    expect(importFindings).toHaveLength(1);
    expect(importFindings[0]!.message).toContain("row 3");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unlabelled 5. duplicate declared name: one IMPORT finding, exit 1", () => {
  const source = readFileSync(HEADERLESS_MD_PATH, "utf8").replace(
    "unlabelled Id, Time",
    "unlabelled Id, Id",
  );
  const result = checkSource(source, HEADERLESS_MD_PATH);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("duplicate column");
  expect(result.exitCode).toBe(1);
});

test("unlabelled 6. invalid declared identifier: one IMPORT finding, exit 1", () => {
  const source = readFileSync(HEADERLESS_MD_PATH, "utf8").replace(
    "unlabelled Id, Time",
    "unlabelled Id, 9bad",
  );
  const result = checkSource(source, HEADERLESS_MD_PATH);
  const importFindings = result.findings.filter((f) => f.code === "IMPORT");
  expect(importFindings).toHaveLength(1);
  expect(importFindings[0]!.message).toContain("9bad");
  expect(result.exitCode).toBe(1);
});

test("unlabelled 7. both clauses present: one TYPE finding, exit 1", () => {
  const source = readFileSync(HEADERLESS_MD_PATH, "utf8").replace(
    "unlabelled Id, Time",
    "labelled Id, Time unlabelled Id, Time",
  );
  const result = checkSource(source, HEADERLESS_MD_PATH);
  const typeFindings = result.findings.filter((f) => f.code === "TYPE");
  expect(typeFindings).toHaveLength(1);
  expect(typeFindings[0]!.message).toContain("out of order or repeated");
  expect(result.exitCode).toBe(1);
});

test("unlabelled 8. labelled fixture's full transcript is unaffected", () => {
  const source = readFileSync(MD_PATH, "utf8");
  const result = checkSource(source);
  expect(result.findings.filter((f) => f.code !== "WARN")).toEqual([]);
  expect(result.exitCode).toBe(0);
});
