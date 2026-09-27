import { expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { READ_TOOLS } from "../src/tools/read.js";
import type { Outcome, ToolDef } from "../src/tools/types.js";

const repo = join(import.meta.dir, "../../..");
const clean = join(repo, "docs/example-invoice.md");
const drift = join(repo, "docs/example-invoice-drift.md");
const budget = join(repo, "docs/example-agent-budget.md");

function tool(name: string): ToolDef {
  const t = READ_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
}

function ok(outcome: Outcome): Record<string, unknown> {
  if ("fault" in outcome) throw new Error(`expected success, got ${outcome.fault.message}`);
  return JSON.parse(JSON.stringify(outcome.ok)) as Record<string, unknown>;
}

function faultOf(outcome: Outcome): { code: string; message: string } {
  if (!("fault" in outcome)) throw new Error("expected a fault");
  return outcome.fault;
}

// --- the surface itself ------------------------------------------------------

test("the six read tools are all read-only and non-destructive", () => {
  // `fmt` and `infer` included, because planning is not writing.
  expect(READ_TOOLS.map((t) => t.name)).toEqual([
    "visimark_ref",
    "visimark_check",
    "visimark_explain",
    "visimark_eval",
    "visimark_infer",
    "visimark_fmt",
  ]);
  for (const t of READ_TOOLS) {
    expect({ name: t.name, ...t.annotations }).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  }
});

test("no tool description carries a count", () => {
  // "All fifteen builtins" was already wrong when #169 was filed — there are
  // sixteen. `docs/function-reference.md` is generated and CI-checked; a
  // hand-written description is not in that loop, so it must carry no number
  // that can drift.
  const counted =
    /\b(\d+|all|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\s+\w*\s?(builtin|function|rule|finding|command|tool|sheet|column)s?\b/i;
  for (const t of READ_TOOLS) {
    expect({ name: t.name, description: t.description }).toMatchObject({
      description: expect.not.stringMatching(counted),
    });
  }
});

test("fmt and check say what content mode cannot verify", () => {
  for (const name of ["visimark_check", "visimark_fmt"]) {
    expect(tool(name).description).toContain("imports and generated artifacts");
  }
  expect(tool("visimark_fmt").description).toContain("and nothing else");
});

// --- visimark_ref ------------------------------------------------------------

test("visimark_ref with no name answers about every builtin", () => {
  const body = ok(tool("visimark_ref").run({}));
  expect(body["status"]).toBe("ok");
  expect((body["functions"] as unknown[]).length).toBeGreaterThan(0);
});

test("visimark_ref names one builtin", () => {
  const body = ok(tool("visimark_ref").run({ name: "SUM" }));
  expect(body["function"]).toMatchObject({ name: "SUM", signature: expect.any(String) });
});

test("visimark_ref refuses an unknown name exactly as the CLI does", () => {
  // The spec's §4 row says AVERAGE comes back "with the did-you-mean
  // suggestion the CLI produces". The CLI produces none for it — AVERAGE is
  // four edits from AVG and `closest` stops at three, so it is a different
  // word, not a typo. What the surfaces must share is the wording and the same
  // `closest` call, so both arms are pinned here rather than a literal that
  // only one of them produces.
  expect(faultOf(tool("visimark_ref").run({ name: "AVERAGE" }))).toEqual({
    code: "USAGE",
    message: "visimark: unknown function `AVERAGE`",
  });
  expect(faultOf(tool("visimark_ref").run({ name: "SUMM" }))).toEqual({
    code: "USAGE",
    message: "visimark: unknown function `SUMM` — did you mean `SUM`?",
  });
});

// --- visimark_check ----------------------------------------------------------

test("a clean document is status ok with no findings", () => {
  const body = ok(tool("visimark_check").run({ path: clean }));
  expect(body).toMatchObject({ command: "check", status: "ok", findings: [], skipped: {} });
});

test("a drifted document is a SUCCESSFUL call reporting problems", () => {
  // Getting this backwards makes every failing document look like a broken
  // server, which is the opposite of what the tool is for (§3.1).
  const outcome = tool("visimark_check").run({ path: drift });
  expect("fault" in outcome).toBe(false);
  const body = ok(outcome);
  expect(body["status"]).toBe("problems");
  expect(body["summary"]).toEqual({ problems: 27, stale: 22, errors: 5 });
});

test("a table with no rules reports COVERAGE under content, and skips nothing", () => {
  const body = ok(
    tool("visimark_check").run({ content: "| Item | Qty |\n|---|---:|\n| a | 1 |\n" }),
  );
  expect(body["status"]).toBe("problems");
  expect((body["findings"] as { code: string }[]).map((f) => f.code)).toContain("COVERAGE");
  expect(body["skipped"]).toEqual({});
  expect(body["file"]).toBe("<content>");
});

test("both, neither, and an unreadable path are the 2 class", () => {
  expect(faultOf(tool("visimark_check").run({ path: clean, content: "x" })).code).toBe("USAGE");
  expect(faultOf(tool("visimark_check").run({})).code).toBe("USAGE");
  expect(faultOf(tool("visimark_check").run({ path: join(repo, "nope.md") })).code).toBe("READ");
});

// --- visimark_explain --------------------------------------------------------

test("visimark_explain describes the document's sheets", () => {
  const body = ok(tool("visimark_explain").run({ path: clean }));
  expect(body).toMatchObject({ command: "explain", status: "ok" });
  expect((body["sheets"] as unknown[]).length).toBeGreaterThan(0);
});

test("visimark_explain refuses an unknown sheet", () => {
  expect(faultOf(tool("visimark_explain").run({ path: clean, sheet: "nope" }))).toEqual({
    code: "USAGE",
    message: "visimark: no sheet #nope",
  });
});

// --- visimark_eval -----------------------------------------------------------

test("visimark_eval returns one value for get", () => {
  const body = ok(tool("visimark_eval").run({ path: clean, get: "lines.gross_total" }));
  expect(body["status"]).toBe("ok");
  expect(Object.keys(body["values"] as object)).toEqual(["lines.gross_total"]);
  // A decimal string, never a JSON number (§7).
  expect(typeof (body["values"] as Record<string, unknown>)["lines.gross_total"]).toBe("string");
});

test("visimark_eval refuses a name it does not have", () => {
  expect(faultOf(tool("visimark_eval").run({ path: clean, get: "nope" }))).toEqual({
    code: "USAGE",
    message: "visimark: no value named nope",
  });
});

test("visimark_eval takes a scenario as content, with no temp file", () => {
  const body = ok(
    tool("visimark_eval").run({
      path: budget,
      scenarioContent: JSON.stringify({ budget: "5.00" }),
    }),
  );
  // The same object `visimark eval --scenario … --json` emits for this
  // document, param id and all — the scenario simply did not come from a file.
  expect(body["scenario"]).toEqual({
    file: "<scenarioContent>",
    params: { "rates.budget": { value: "5", default: "2", source: "scenario" } },
  });
});

test("visimark_eval refuses both scenario arms", () => {
  expect(
    faultOf(
      tool("visimark_eval").run({ path: clean, scenarioPath: "s.json", scenarioContent: "{}" }),
    ),
  ).toEqual({
    code: "USAGE",
    message: "visimark: give scenarioPath or scenarioContent, not both",
  });
});

test("a faulty scenario is SCENARIO, not USAGE", () => {
  expect(
    faultOf(
      tool("visimark_eval").run({ path: budget, scenarioContent: JSON.stringify({ nope: "1" }) }),
    ).code,
  ).toBe("SCENARIO");
});

// --- visimark_infer ----------------------------------------------------------

test("visimark_infer proposes rules and never reports a write", () => {
  const body = ok(
    tool("visimark_infer").run({
      content:
        "| Item | Qty | Rate | Net |\n|---|---:|---:|---:|\n" +
        "| a | 2 | 3.00 | 6.00 |\n| b | 4 | 5.00 | 20.00 |\n| c | 3 | 2.00 | 6.00 |\n",
    }),
  );
  expect(body["status"]).toBe("ok");
  expect((body["proposals"] as unknown[]).length).toBeGreaterThan(0);
  // No `written` key in either state: it never writes, and a key that is
  // always false invites a reader to look for the case where it is not.
  expect("written" in body).toBe(false);
});

// --- visimark_fmt ------------------------------------------------------------

test("visimark_fmt plans edits and writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-fmt-"));
  const copy = join(dir, "drift.md");
  copyFileSync(drift, copy);
  const before = { bytes: readFileSync(copy), mtime: statSync(copy).mtimeMs };

  const body = ok(tool("visimark_fmt").run({ path: copy }));
  expect(body).toMatchObject({ command: "fmt", status: "problems", applied: false });
  expect((body["edits"] as unknown[]).length).toBeGreaterThan(0);
  expect(body["sha256"]).toMatch(/^[0-9a-f]{64}$/);
  expect(Array.isArray(body["artifactsWouldWrite"])).toBe(true);

  const after = { bytes: readFileSync(copy), mtime: statSync(copy).mtimeMs };
  expect(after.bytes.equals(before.bytes)).toBe(true);
  expect(after.mtime).toBe(before.mtime);
});

test("visimark_fmt under content names no artifact it could not look at", () => {
  const body = ok(tool("visimark_fmt").run({ content: readFileSync(drift, "utf8") }));
  expect(body["artifactsWouldWrite"]).toEqual([]);
  expect(body["applied"]).toBe(false);
});
