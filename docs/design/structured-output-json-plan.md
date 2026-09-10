# Structured CLI output (`--json`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every document-oriented command (`check`, `fmt`, `infer`, `eval`, `explain`) accepts `--json` and emits one deterministic JSON document of that command's result, per [`docs/design/structured-output-json-spec.md`](structured-output-json-spec.md), without changing evaluation, writes, or exit codes.

**Architecture:** Commands keep doing the work they do today, then a formatter renders the result. Text stays the default (`report/format.ts`, `report/infer.ts`, the current `eval`/`explain` printers). JSON lives in a new `report/json.ts` that builds a public envelope and calls `JSON.stringify(doc, null, 2)` once. `cli/commands.ts` branches on `flags.has("json")` at the end of each command (and on the usage/read-failure paths). No public `--format` flag. `eval --json`'s flat map is replaced, not wrapped.

**Tech Stack:** TypeScript, Bun test (`bun:test`), existing `runCli` + capture IO in CLI tests.

**Spec:** [`docs/design/structured-output-json-spec.md`](structured-output-json-spec.md)

## Global Constraints

- Work on `issue/60-structured-output-json-impl` (draft PR #62). Do not open a new PR.
- `--json` changes serialization only: evaluation, `fmt`/`infer --write`/artifact writes, and exit codes stay as they are. Default text transcripts stay byte-stable.
- Document quantities in JSON are **decimal strings**, never JSON numbers ([§7](../visimark-design.md#7-numeric-semantics)). Dates are ISO strings. `holds` may be `true` / `false` / `null`. Column vectors are arrays of strings or `null`.
- One JSON document on stdout, `JSON.stringify(value, null, 2)` plus the CLI `out()` trailing newline. No TTY detection. No JSONL. No non-JSON on stdout in `--json` mode.
- Public CLI is `--json` only. Do not add `--format`. Unknown flags stay ignored.
- Do not serialize internal `Finding` / `Proposal` / AST / edit objects, source spans, absolute artifact targets, or SVG bytes.
- Envelope field order: `command`, `visimark`, `status`, then `error` if present, then the command body. `visimark` is `packages/visimark/package.json` `"version"` (no `visimark ` prefix). `status` is `"ok"` / `"problems"` / `"error"` matching exit 0 / 1 / 2.
- Read the package version lazily via `createRequire` (same reason as `cli/main.ts` — do not `import … with { type: "json" }`).
- Never `bunx visimark` (published build). After each task, from the repo root: `bun test`, `bun run typecheck`, `bun run build`, and `bun run packages/visimark/src/cli/main.ts check` on `docs/example-invoice.md`, `docs/example-invoice-drift.md`, and `docs/example-charts.md`. Loop until green.
- Every commit includes exactly one `Co-Authored-By` trailer, taken from [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for this session. Do not copy a trailer out of this plan or an earlier commit.

---

### Task 1: Envelope, version, `check --json`

**Files:**
- Create: `packages/visimark/src/cli/version.ts`
- Create: `packages/visimark/src/report/json.ts`
- Modify: `packages/visimark/src/cli/main.ts` — `readVersion` becomes a re-export of `./version.js`
- Modify: `packages/visimark/src/cli/commands.ts` — `cmdCheck` collects per-file results and emits JSON when `--json`
- Test: `packages/visimark/test/cli/json.test.ts`

**Interfaces:**
- Consumes: `Finding`, `isProblem`, `ERROR_CODES` from `model/types.ts`; `check` / `formatCheck` as today.
- Produces:
  - `readVersion(): string`
  - `emitJson(out: Writer, doc: object): void` — `out(JSON.stringify(doc, null, 2))`
  - `statusFromExit(code: 0 | 1 | 2): "ok" | "problems" | "error"`
  - `publicFinding(file: string, f: Finding): object` (spec §3.1)
  - `findingSummary(findings: Finding[]): { problems: number; stale: number; errors: number }` — same counts as `formatCheck`'s footer
  - `errorEnvelope(command, code: "USAGE" | "READ", message: string): object`

- [ ] **Step 1: Write the failing tests**

Create `packages/visimark/test/cli/json.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanPath, driftPath } from "../examples.js";
import { runCli } from "../../src/cli/main.js";

const version = (createRequire(import.meta.url)("../../package.json") as { version: string })
  .version;

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
    out: () => out.join("\n"),
    err: () => err.join("\n"),
  };
}

function parseOut(c: ReturnType<typeof capture>): Record<string, unknown> {
  return JSON.parse(c.out()) as Record<string, unknown>;
}

test("check --json on the clean invoice: envelope, empty findings, exit 0", async () => {
  const c = capture();
  const code = await runCli(["check", cleanPath, "--json"], c.io);
  expect(code).toBe(0);
  expect(c.err()).toBe("");
  const j = parseOut(c);
  expect(j.command).toBe("check");
  expect(j.visimark).toBe(version);
  expect(j.status).toBe("ok");
  expect(j.error).toBeUndefined();
  const files = j.files as { path: string; findings: unknown[]; summary: { problems: number } }[];
  expect(files).toHaveLength(1);
  expect(files[0]!.path).toBe(cleanPath);
  expect(files[0]!.findings).toEqual([]);
  expect(files[0]!.summary.problems).toBe(0);
  expect(j.summary).toEqual({ files: 1, problems: 0, stale: 0, errors: 0 });
  expect(c.out().startsWith("{\n  ")).toBe(true);
});

test("check --json on the drift invoice: STALE is a problem with string details", async () => {
  const c = capture();
  const code = await runCli(["check", driftPath, "--json"], c.io);
  expect(code).toBe(1);
  const j = parseOut(c);
  expect(j.status).toBe("problems");
  const files = j.files as { findings: { code: string; class: string; details: Record<string, unknown> }[] }[];
  const stale = files[0]!.findings.find((f) => f.code === "STALE");
  expect(stale?.class).toBe("problem");
  expect(typeof stale?.details.stored).toBe("string");
  expect(typeof stale?.details.computed).toBe("string");
});

test("check --json with only WARN: status ok, class advice, exit 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "warn.md");
  writeFileSync(
    p,
    "| Item | Price | Qty |   Net |\n|------|------:|----:|------:|\n| pen  |  5.00 |  10 | 50.00 |\n\n```vmark #order\nNet    = Price * Qty\nunused = SUM(Net)\n```\n",
  );
  const c = capture();
  expect(await runCli(["check", p, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.status).toBe("ok");
  const files = j.files as { findings: { code: string; class: string }[] }[];
  expect(files[0]!.findings.some((f) => f.code === "WARN" && f.class === "advice")).toBe(true);
});

test("check --json with no files: USAGE on stdout, usage on stderr, exit 2", async () => {
  const c = capture();
  expect(await runCli(["check", "--json"], c.io)).toBe(2);
  expect(c.err()).toContain("usage: visimark check");
  const j = parseOut(c);
  expect(j).toMatchObject({
    command: "check",
    visimark: version,
    status: "error",
    error: { code: "USAGE" },
  });
  expect(String((j.error as { message: string }).message)).toContain("usage:");
});

test("check --json multi-file with one unreadable: READ, exit 2, other file listed", async () => {
  const missing = join(mkdtempSync(join(tmpdir(), "visimark-json-")), "nope.md");
  const c = capture();
  expect(await runCli(["check", cleanPath, missing, "--json"], c.io)).toBe(2);
  const j = parseOut(c);
  expect(j.status).toBe("error");
  const files = j.files as { path: string; error?: { code: string }; findings?: unknown[] }[];
  expect(files).toHaveLength(2);
  expect(files[0]).toMatchObject({ path: cleanPath });
  expect(files[0]!.findings).toEqual([]);
  expect(files[1]).toMatchObject({ path: missing, error: { code: "READ" } });
  expect(files[1]!.findings).toBeUndefined();
});

test("check FILE --jsonn is ignored: human text, not JSON", async () => {
  const c = capture();
  expect(await runCli(["check", cleanPath, "--jsonn"], c.io)).toBe(0);
  expect(c.out()).toContain("0 problems");
  expect(() => JSON.parse(c.out())).toThrow();
});
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `bun test packages/visimark/test/cli/json.test.ts`
Expected: FAIL — `check --json` still prints the human report (JSON.parse throws) or ignores the flag.

- [ ] **Step 3: `version.ts` and `json.ts`; wire `cmdCheck`**

Create `packages/visimark/src/cli/version.ts` by moving the `createRequire` reader out of `main.ts` unchanged (lazy, same `../../package.json` relative path from `src/cli/`). `main.ts` imports `readVersion` from `./version.js`.

Create `packages/visimark/src/report/json.ts`. Implement, in this field order, objects the tests need:

```ts
import { ERROR_CODES, isProblem, type Finding } from "../model/types.js";
import { readVersion } from "../cli/version.js";
import type { Writer } from "../cli/commands.js";

export function emitJson(out: Writer, doc: object): void {
  out(JSON.stringify(doc, null, 2));
}

export function statusFromExit(code: 0 | 1 | 2): "ok" | "problems" | "error" {
  return code === 0 ? "ok" : code === 1 ? "problems" : "error";
}

export function errorEnvelope(
  command: "check" | "fmt" | "infer" | "eval" | "explain",
  code: "USAGE" | "READ",
  message: string,
): object {
  return { command, visimark: readVersion(), status: "error", error: { code, message } };
}

export function findingSummary(findings: Finding[]): {
  problems: number;
  stale: number;
  errors: number;
} {
  let stale = 0;
  let errors = 0;
  for (const f of findings) {
    if (f.code === "STALE") stale += f.anchorGroup ? (f.suppressedCount ?? 0) : 1;
    else if (ERROR_CODES.has(f.code)) errors++;
  }
  return { problems: stale + errors, stale, errors };
}

export function publicFinding(file: string, f: Finding): object {
  const location: Record<string, string> = { file };
  if (f.sheetId) location.sheet = f.sheetId;
  if (f.name) location.name = f.name;
  if (f.rowLabel) location.row = f.rowLabel;
  const details: Record<string, unknown> = {};
  if (f.code === "STALE" && f.anchorGroup) {
    details.suppressedCount = f.suppressedCount ?? 0;
  } else if (f.code === "STALE" && f.artifact !== undefined) {
    details.artifact = f.artifact;
    if (f.message) details.message = f.message;
  } else if (f.code === "STALE") {
    if (f.stored !== undefined) details.stored = f.stored;
    if (f.computed !== undefined) details.computed = f.computed;
    if (f.formula !== undefined) details.formula = f.formula;
  } else if (f.code === "DATE") {
    if (f.raw !== undefined) details.raw = f.raw;
    if (f.isoFix !== undefined) details.isoFix = f.isoFix;
    if (f.altA !== undefined) details.altA = f.altA;
    if (f.altB !== undefined) details.altB = f.altB;
    if (f.daysApart !== undefined) details.daysApart = f.daysApart;
  } else if (f.code === "CYCLE") {
    details.cyclePath = f.cyclePath ?? [];
  } else if (f.code === "ASSERT") {
    // formatCheck uses f.source as the assert line and f.message as the
    // operand-substituted expression (`report/format.ts` ASSERT branch).
    if (f.source !== undefined) details.source = f.source;
    if (f.message !== undefined) details.substituted = f.message;
  } else if (f.code === "ARTIFACT") {
    if (f.artifact !== undefined) details.artifact = f.artifact;
    if (f.message) details.message = f.message;
  } else {
    if (f.message) details.message = f.message;
    if (f.suggestion) details.suggestion = f.suggestion;
    if (f.code === "NOTE" && f.suppressedCount !== undefined) {
      details.suppressedCount = f.suppressedCount;
    }
  }
  return {
    code: f.code,
    class: isProblem(f) ? "problem" : "advice",
    location,
    details,
  };
}
```

`cmdCheck` (sketch):

```ts
export function cmdCheck(args: string[], out: Writer, err: Writer): number {
  const { files, flags } = parseArgs(args);
  const json = flags.has("json");
  if (files.length === 0) {
    const msg = "usage: visimark check FILE...";
    err(msg);
    if (json) emitJson(out, errorEnvelope("check", "USAGE", msg));
    return 2;
  }
  const fileEntries: object[] = [];
  let exit: 0 | 1 | 2 = 0;
  let problems = 0, stale = 0, errors = 0;
  for (const path of files) {
    let source: string;
    try {
      source = read(path);
    } catch {
      const msg = `visimark: cannot read ${path}`;
      err(msg);
      if (json) fileEntries.push({ path, error: { code: "READ", message: msg } });
      else { /* today: only err, no formatCheck */ }
      exit = 2;
      continue;
    }
    const result = check(build(locate(source)), { docPath: path });
    if (!json) out(formatCheck(path, result.findings));
    else {
      const summary = findingSummary(result.findings);
      fileEntries.push({
        path,
        findings: result.findings.map((f) => publicFinding(path, f)),
        summary,
      });
      problems += summary.problems;
      stale += summary.stale;
      errors += summary.errors;
    }
    if (result.exitCode === 1 && exit === 0) exit = 1;
  }
  if (json) {
    const doc: Record<string, unknown> = {
      command: "check",
      visimark: readVersion(),
      status: statusFromExit(exit),
      files: fileEntries,
      summary: { files: files.length, problems, stale, errors },
    };
    emitJson(out, doc);
  }
  return exit;
}
```

Watch a circular import: `json.ts` importing `Writer` from `commands.ts` while `commands.ts` imports `json.ts`. Put `export type Writer = (line: string) => void` in `cli/version.ts` or a tiny `cli/io.ts`, or inline `out: (line: string) => void` on `emitJson` so `json.ts` does not import `commands.ts`.

Avoid importing `json.ts` from `model/` or `eval/`.

- [ ] **Step 4: Run the json tests and the existing CLI tests**

Run: `bun test packages/visimark/test/cli/json.test.ts packages/visimark/test/cli/cli.test.ts`
Expected: PASS. Existing `check` transcripts without `--json` still match.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/cli/version.ts packages/visimark/src/cli/main.ts \
  packages/visimark/src/cli/commands.ts packages/visimark/src/report/json.ts \
  packages/visimark/test/cli/json.test.ts
git commit -m "feat: check --json envelope"
```

Add the attribution trailer from the rule. Skip files you did not actually touch.

---

### Task 2: `eval --json` envelope (breaking)

**Files:**
- Modify: `packages/visimark/src/report/json.ts` — `evalEnvelope(...)`
- Modify: `packages/visimark/src/cli/commands.ts` — `cmdEval`
- Modify: `packages/visimark/test/cli/cli.test.ts` — the two existing `--json` tests
- Modify: `packages/visimark/test/cli/json.test.ts` — new eval cases
- Test: those two files

**Interfaces:**
- Consumes: `CheckResult.values`, `.cells`, `.assertions`, `.charts`; local `showValue` in `commands.ts` (natural precision, not binding precision).
- Produces: `evalEnvelope(opts)` returning `{ command, visimark, status, file, values, assertions, charts }`.
  - Scalars in `values`: `jsonShowValue(v)` → decimal/ISO/string/boolean-as-string.
  - Columns: `(Value | null)[]` → `(string | null)[]`. **Not** a comma-joined string.
  - Assertions: `{ sheet, source, holds, operands, substituted }` (`sheet` not `sheetId`).
  - Charts: `{ sheet, name, engine, series, labels, path, state }` — drop `svg` and `target`.
  - `--get NAME`: `values` has **one** key, the name as typed.
  - `--json` + false assertion: **do not** call `reportFailures()` (no ASSERT on stderr). Text mode still does.

- [ ] **Step 1: Write the failing tests**

Append to `json.test.ts`:

```ts
import { assertFailPath } from "../examples.js";

test("eval --json uses the envelope, not a flat map", async () => {
  const c = capture();
  expect(await runCli(["eval", cleanPath, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.command).toBe("eval");
  expect(j.visimark).toBe(version);
  expect(j.status).toBe("ok");
  expect(j.file).toBe(cleanPath);
  expect(j.vat).toBeUndefined();
  const values = j.values as Record<string, unknown>;
  expect(values.vat).toBe("0.23");
  expect(values["lines.gross_total"]).toBe("28659");
  expect(values["lines.Net"]).toEqual(["3600", "14080", "2500", "3120"]);
  const assertions = j.assertions as { sheet: string; holds: boolean }[];
  expect(assertions[0]).toMatchObject({ sheet: "recon", holds: true });
  expect(Array.isArray(j.charts)).toBe(true);
  const raw = JSON.stringify(values);
  expect(raw).not.toMatch(/[^"]0\.23[^"]/); // vat is quoted
});

test("eval --get --json is the same envelope with one values key", async () => {
  const c = capture();
  expect(await runCli(["eval", cleanPath, "--get", "gross_total", "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(Object.keys(j.values as object)).toEqual(["gross_total"]);
  expect((j.values as { gross_total: string }).gross_total).toBe("28659");
  expect(Array.isArray(j.assertions)).toBe(true);
});

test("eval --json on a false assertion: problems, quiet stderr", async () => {
  const c = capture();
  expect(await runCli(["eval", assertFailPath, "--json"], c.io)).toBe(1);
  expect(c.err()).not.toContain("ASSERT");
  const j = parseOut(c);
  expect(j.status).toBe("problems");
  const assertions = j.assertions as { holds: boolean }[];
  expect(assertions.some((a) => a.holds === false)).toBe(true);
});

test("eval --get nope --json: USAGE envelope, message on stderr", async () => {
  const c = capture();
  expect(await runCli(["eval", cleanPath, "--get", "nope", "--json"], c.io)).toBe(2);
  expect(c.err()).toContain("no value named nope");
  const j = parseOut(c);
  expect(j).toMatchObject({
    command: "eval",
    status: "error",
    error: { code: "USAGE" },
  });
});

test("eval --json column with a null cell", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "hole.md");
  writeFileSync(
    p,
    "| Item | Price | Qty | Net |\n|------|------:|----:|----:|\n| a    |  1.00 |   2 | 2.00 |\n| b    |       |   2 |      |\n\n```vmark #t\nNet = Price * Qty\n```\n",
  );
  const c = capture();
  await runCli(["eval", p, "--json"], c.io);
  const values = parseOut(c).values as { "t.Net": (string | null)[] };
  expect(values["t.Net"][0]).toBe("2");
  expect(values["t.Net"][1]).toBeNull();
});
```

Rewrite the two tests in `cli.test.ts`:

```ts
test("eval --get accepts a bare name and --json", async () => {
  const c = capture();
  await runCli(["eval", cleanPath, "--get", "gross_total", "--json"], c.io);
  const j = JSON.parse(c.out()) as { values: { gross_total: string } };
  expect(j.values).toEqual({ gross_total: "28659" });
});

test("eval --json carries an assertions array", async () => {
  const c = capture();
  await runCli(["eval", assertFailPath, "--json"], c.io);
  const j = JSON.parse(c.out()) as { assertions: unknown };
  expect(j.assertions).toEqual([
    {
      sheet: "plan",
      source: "assert total == 1",
      holds: false,
      operands: { total: "0.90" },
      substituted: "0.90 == 1",
    },
  ]);
});
```

Keep `eval --get` **text** tests and the ASSERT-on-stderr **text** test unchanged.

- [ ] **Step 2: Run them, confirm they fail**

Run: `bun test packages/visimark/test/cli/json.test.ts packages/visimark/test/cli/cli.test.ts`
Expected: FAIL on the old flat-map shape (`j.vat` still present / `j.values` missing).

- [ ] **Step 3: Implement `evalEnvelope` and switch `cmdEval`**

Build `values` as a `Record<string, string | (string | null)[]>`: scalars first from `result.values`, then columns from `result.cells` (array, `null` for missing). For `--get`, resolve as today (`all.get(get) ?? all.get(bareToQualified(...))`) but look up in that record (a column `--get` returns the array). If missing: `err(...)`; if json, `emitJson(out, errorEnvelope("eval", "USAGE", "visimark: no value named ${get}"))`; return 2. Do **not** include `values` on that error envelope (spec: command body on error only for multi-file partial results).

On success:

```ts
const failed = result.assertions.filter((a) => a.holds === false);
const exit: 0 | 1 = failed.length > 0 ? 1 : 0;
if (json) {
  emitJson(out, {
    command: "eval",
    visimark: readVersion(),
    status: statusFromExit(exit),
    file: path,
    values,
    assertions: result.assertions.map((a) => ({
      sheet: a.sheetId,
      source: a.source,
      holds: a.holds,
      operands: a.operands,
      substituted: a.substituted,
    })),
    charts: result.charts.map((c) => ({
      sheet: c.sheetId,
      name: c.name,
      engine: c.engine,
      series: c.series,
      labels: c.labels,
      path: c.path,
      state: c.state,
    })),
  });
} else {
  // existing text printer + reportFailures()
}
if (!json) reportFailures();
return exit;
```

Also handle missing file / no file with `--json` (`READ` / `USAGE`) the same way as `check`.

- [ ] **Step 4: Run tests**

Run: `bun test packages/visimark/test/cli/`
Expected: PASS. If the hole.md fixture does not yield a `null` cell (engine treats blank as zero or `UNIT`), adjust the fixture until `result.cells` actually contains `null` — do not fake it in the serializer. A `TYPE`/`UNDEF` on one row that leaves that cell unevaluable is acceptable.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/report/json.ts packages/visimark/src/cli/commands.ts \
  packages/visimark/test/cli/json.test.ts packages/visimark/test/cli/cli.test.ts
git commit -m "feat: eval --json namespaced envelope"
```

---

### Task 3: `fmt --json`

**Files:**
- Modify: `packages/visimark/src/write/fmt.ts` — `ArtifactWrite` gains `path: string | null` (the path the document named, from `ChartResult.path`)
- Modify: `packages/visimark/src/cli/commands.ts` — `cmdFmt`
- Modify: `packages/visimark/src/report/json.ts`
- Test: `packages/visimark/test/cli/json.test.ts`

**Interfaces:**
- Consumes: `FmtResult` (`changed`, `cellsUpdated`, `anchorsUpdated`, `datesFixed`, `unfixable`, `artifacts`).
- Produces: per-file `{ path, changed, cellsUpdated, anchorsUpdated, datesFixed, artifacts: [{ path }], findings }` plus aggregate `summary` (`files`, `filesChanged`, `cellsUpdated`, `anchorsUpdated`, `datesFixed`, `artifacts`, `problems`, `stale`, `errors`).
- Still writes the Markdown and artifact files **before** emitting JSON. Not a dry-run.

- [ ] **Step 1: Write the failing tests**

```ts
import { drift } from "../examples.js";

test("fmt --json reports post-write facts and still rewrites the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "drift.md");
  writeFileSync(p, drift);
  const c1 = capture();
  const code1 = await runCli(["fmt", p, "--json"], c1.io);
  expect(code1).toBe(1);
  const j1 = parseOut(c1);
  expect(j1.command).toBe("fmt");
  expect(j1.status).toBe("problems");
  const f1 = (j1.files as { changed: boolean; cellsUpdated: number; path: string }[])[0]!;
  expect(f1.path).toBe(p);
  expect(f1.changed).toBe(true);
  expect(f1.cellsUpdated).toBeGreaterThan(0);
  expect(readFileSync(p, "utf8")).not.toBe(drift);

  const c2 = capture();
  await runCli(["fmt", p, "--json"], c2.io);
  const f2 = (parseOut(c2).files as { changed: boolean }[])[0]!;
  expect(f2.changed).toBe(false);
});

test("fmt --json with no files: USAGE, exit 2", async () => {
  const c = capture();
  expect(await runCli(["fmt", "--json"], c.io)).toBe(2);
  expect(parseOut(c)).toMatchObject({ command: "fmt", status: "error", error: { code: "USAGE" } });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `bun test packages/visimark/test/cli/json.test.ts`
Expected: FAIL — `fmt --json` still prints `updated` / `unchanged` prose.

- [ ] **Step 3: Implement**

When mapping `result.charts` to `ArtifactWrite`, set `path: c.path`. `cmdFmt` keeps the `mkdirSync` / `writeFileSync` loop. If `json`, push a file entry instead of the `updated`/`unchanged` lines; still `formatCheck` only in text mode for unfixable findings. After the file loop, if `json`, `emitJson` once.

`artifacts[].path` in JSON is `a.path` (document path), never `a.target`.

Unfixable findings go through `publicFinding`. Exit code is unchanged (1 if unfixable remain).

- [ ] **Step 4: Run tests including existing fmt stability test**

Run: `bun test packages/visimark/test/cli/`
Expected: PASS. The existing `fmt rewrites the file…` text test still looks for `updated` / `unchanged` **without** `--json`.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/write/fmt.ts packages/visimark/src/cli/commands.ts \
  packages/visimark/src/report/json.ts packages/visimark/test/cli/json.test.ts
git commit -m "feat: fmt --json post-write report"
```

---

### Task 4: `infer --json`

**Files:**
- Modify: `packages/visimark/src/report/json.ts` — `publicProposal(p: Proposal)`
- Modify: `packages/visimark/src/cli/commands.ts` — `cmdInfer`
- Test: `packages/visimark/test/cli/json.test.ts`

**Interfaces:**
- Consumes: `Proposal` from `infer/propose.ts`; `planInfer` edits (`kind: "block" | "anchor" | "marker"`).
- Produces: per-file `{ path, proposals: PublicProposal[] }` and optional `written: { blocks, anchors, marker }`.
  - Public proposal: `kind`, `sheet` (`sheetId`), `name`, `rule`, `fits`, `rows`, `weak`. Optional: `reason`, `alternatives`, `disagreement: { rowLabel, stored, computed }`.
  - No spans, no `stage`, no `tableSpan`, no `anchorSite`.
  - Without `--write`, omit `written`.
  - `infer` never exits 1; `status` is `"ok"` unless USAGE/READ.

- [ ] **Step 1: Write the failing tests**

```ts
test("infer --json lists proposals and has no written key", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "plain.md");
  writeFileSync(p, "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
  const c = capture();
  expect(await runCli(["infer", p, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.command).toBe("infer");
  expect(j.status).toBe("ok");
  const file = (j.files as { proposals: unknown[]; written?: unknown }[])[0]!;
  expect(file.written).toBeUndefined();
  expect(Array.isArray(file.proposals)).toBe(true);
});

test("infer --write --json reports written.marker and still writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "plain.md");
  writeFileSync(p, "| Item | Price |\n|------|------:|\n| pen  |  5.00 |\n");
  const c = capture();
  expect(await runCli(["infer", p, "--write", "--json"], c.io)).toBe(0);
  const file = (parseOut(c).files as { written: { marker: boolean; blocks: number; anchors: number } }[])[0]!;
  expect(file.written.marker).toBe(true);
  expect(readFileSync(p, "utf8")).toContain("<!--vmark:no-formulas-->");
});
```

- [ ] **Step 2: Run, confirm fail**

Expected: FAIL — human infer report, not JSON.

- [ ] **Step 3: Implement**

In `cmdInfer`, keep `infer` + optional `planInfer`/`writeFileSync`. Replace `out(formatInfer(...))` and the `nothing to write` / `wrote` lines when `json`. `summary.rules` / `scalars` / `anchors` match `formatInfer`'s footer counts (`column` and not `weak`; `kind === "scalar"`; scalar with `anchorSite`).

- [ ] **Step 4: Run tests**

Run: `bun test packages/visimark/test/cli/`
Expected: PASS. Existing `infer --write` text test still green.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/report/json.ts packages/visimark/src/cli/commands.ts \
  packages/visimark/test/cli/json.test.ts
git commit -m "feat: infer --json proposals and written"
```

---

### Task 5: `explain --json`

**Files:**
- Modify: `packages/visimark/src/cli/commands.ts` — `cmdExplain`
- Modify: `packages/visimark/src/report/json.ts`
- Test: `packages/visimark/test/cli/json.test.ts`

**Interfaces:**
- Consumes: `DocModel`, `topoOrder`, `slice`, `check(…).charts` as today.
- Produces: `{ command, visimark, status, file, documentScope, sheets }`.
  - `documentScope`: `[{ name, rule }]` (expression source via `slice`), `[]` if none.
  - Sheet: `{ id, hasTable, inputs, rules, scalars, order, assertions, charts }` with empty arrays present.
  - `rule` / assertion text / `Σ` echoing: same source-slice behaviour as the text printer.
  - `#sheet` still filters; unknown sheet is `USAGE` + JSON error envelope.

- [ ] **Step 1: Write the failing tests**

```ts
test("explain --json lists schedule.Amount rule from source text", async () => {
  const c = capture();
  expect(await runCli(["explain", cleanPath, "--json"], c.io)).toBe(0);
  const j = parseOut(c);
  expect(j.command).toBe("explain");
  expect(j.file).toBe(cleanPath);
  const sheets = j.sheets as { id: string; rules: { name: string; rule: string }[] }[];
  const schedule = sheets.find((s) => s.id === "schedule");
  expect(schedule?.rules.some((r) => r.rule.includes("Share * lines.gross_total"))).toBe(true);
});

test("explain --json echoes Σ as written, not SUM", async () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-json-"));
  const p = join(dir, "sigma.md");
  writeFileSync(
    p,
    `| Item | Price | Qty |  Net |\n|------|------:|----:|-----:|\n| pen  |  5.00 |   2 | 10.00 |\n\n\`\`\`vmark #order\nNet = Price * Qty\ntotal = Σ(Net)\n\`\`\`\n`,
  );
  const c = capture();
  expect(await runCli(["explain", p, "--json"], c.io)).toBe(0);
  const sheets = parseOut(c).sheets as { scalars: { rule: string }[] }[];
  const rules = sheets.flatMap((s) => s.scalars.map((x) => x.rule)).join("\n");
  expect(rules).toContain("Σ(Net)");
  expect(rules).not.toContain("SUM(Net)");
});

test("explain --json unknown sheet: USAGE, exit 2", async () => {
  const c = capture();
  expect(await runCli(["explain", cleanPath, "#nope", "--json"], c.io)).toBe(2);
  expect(c.err()).toContain("no sheet #nope");
  expect(parseOut(c)).toMatchObject({
    command: "explain",
    status: "error",
    error: { code: "USAGE" },
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Expected: FAIL — text explain output.

- [ ] **Step 3: Implement**

Build the object from the same loops as the text printer (do not parse the text). `#sheet` unknown: `err`; if json, `emitJson(errorEnvelope("explain", "USAGE", "visimark: no sheet #…"))`; return 2. Charts: public chart object as in Task 2, including `state` from `chartState`.

- [ ] **Step 4: Run tests**

Run: `bun test packages/visimark/test/cli/`
Expected: PASS. Existing `explain prints a sheet's rules…` and `explain echoes Σ` text tests still green.

- [ ] **Step 5: Commit**

```bash
git add packages/visimark/src/cli/commands.ts packages/visimark/src/report/json.ts \
  packages/visimark/test/cli/json.test.ts
git commit -m "feat: explain --json"
```

---

### Task 6: Documentation

**Files:**
- Modify: `docs/visimark-design.md` §11
- Modify: `docs/cli-reference.md` — Commands table (eval already mentions JSON; Options `--json` row applies to all five); usage bits
- Modify: `packages/visimark/src/cli/main.ts` — `USAGE` string lists `[--json]` on each document command
- Modify: `docs/example-executable-documentation.md` — replace the nested/number example with the real envelope (`values` keyed `sheet.name`, decimal strings)
- Modify: `CHANGELOG.md` — `## Unreleased` → `### Added`
- Modify: `docs/vocabulary-catalogue.md` — **move** the section F `--json` row into the Shipped register as `UNRELEASED`

**Do not modify:** `editors/vscode/CHANGELOG.md` (LSP unchanged); `docs/issue-review.md` / the issue-review commands (workflow unchanged).

- [ ] **Step 1: Design doc §11**

Replace the command box with:

```
visimark check FILE... [--json]     read-only; exit 1 if any finding
visimark fmt   FILE... [--fix-dates] [--json]
visimark infer FILE... [--write] [--json]
visimark eval  FILE [--get NAME] [--json]
visimark explain FILE [#sheet] [--json]
```

Add one short paragraph: `--json` emits a deterministic envelope of that command's result (command, engine version, `status` matching the exit code). It does not change evaluation, writes, or exit codes. Shape: [`structured-output-json-spec.md`](design/structured-output-json-spec.md). `eval --json` is no longer a flat map of binding names.

- [ ] **Step 2: `cli-reference.md` and `USAGE`**

Options table: `--json` | `check`, `fmt`, `infer`, `eval`, `explain` | Prints one JSON document on stdout instead of the human report. Default text is unchanged. Document quantities are decimal strings. See the spec for the envelope.

Note that unrecognised options stay ignored, so `--jsonn` is not `--json`.

- [ ] **Step 3: Worked example**

In `docs/example-executable-documentation.md`, the sample JSON must match `visimark eval <that-file> --json` on `values` (keys, string decimals). Do not show nested `{ "budget": { "WorkerBudget": 12000 } }` or unquoted numbers.

- [ ] **Step 4: Changelog and catalogue**

`CHANGELOG.md` under `## Unreleased` → `### Added`:

- **`--json` on all document CLI commands** (issue #60) — `check`, `fmt`, `infer`, `eval`, and `explain` accept `--json` and print a deterministic envelope of the command result. Default text output and exit codes are unchanged. `eval --json` is now that envelope (`values`, `assertions`, `charts`), not a flat map of binding names.

Catalogue: delete the section F `--json` row. Append to Shipped:

| Name | Kind | Request | Landed | Released | Decision |
| `--json` on all document CLI commands | tooling | [#60](https://github.com/michal-niedzwiedzki/visimark/issues/60) | [#62](https://github.com/michal-niedzwiedzki/visimark/pull/62) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/60#issuecomment-5609768148) |

`Landed` is this PR (#62). `Released` is `—`.

- [ ] **Step 5: Verify docs and full suite**

Run: `bun test && bun run typecheck && bun run build`
Run: `bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md docs/example-invoice-drift.md docs/example-charts.md`
Run: `bun run packages/visimark/src/cli/main.ts eval docs/example-executable-documentation.md --json` (or whichever path that example actually uses) and confirm the README sample still matches.

- [ ] **Step 6: Commit**

```bash
git add docs/visimark-design.md docs/cli-reference.md docs/example-executable-documentation.md \
  docs/vocabulary-catalogue.md CHANGELOG.md packages/visimark/src/cli/main.ts
git commit -m "docs: --json on every document command"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| Shared envelope, version, status, indent 2 | 1 |
| Findings `code` / `class` / `location` / `details` | 1 |
| `check` success / problems / WARN / USAGE / multi-file READ / `--jsonn` | 1 |
| `eval` envelope, `--get`, false assertion quiet stderr, USAGE, null cell, decimal strings | 2 |
| `fmt` post-write, still writes | 3 |
| `infer` proposals; `--write` / `written` | 4 |
| `explain` sheets, `Σ`, unknown sheet | 5 |
| §11, cli-reference, example, changelog, shipped row | 6 |
| No `--format`, no LSP changelog, no issue-review change | 6 (explicit non-touch) |
