import { expect, test } from "bun:test";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { READ_TOOLS } from "../src/tools/read.js";
import { WRITE_TOOL_NAMES, writeTools } from "../src/tools/write.js";
import { WRITES_DISABLED, closedGate, type Gate } from "../src/gate.js";
import type { Outcome, ToolDef } from "../src/tools/types.js";

const repo = join(import.meta.dir, "../../..");

function tool(gate: Gate, name: string): ToolDef {
  const t = writeTools(gate).find((x) => x.name === name);
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

function readTool(name: string): ToolDef {
  const t = READ_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
}

/** A scratch copy of a doc, plus a gate that has its directory as a root. */
function scratch(src: string, name = "doc.md"): { dir: string; path: string; gate: Gate } {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-write-"));
  const path = join(dir, name);
  copyFileSync(src, path);
  return { dir, path, gate: { allowWrite: true, roots: [dir] } };
}

function planFor(path: string): Record<string, unknown> {
  return ok(readTool("visimark_fmt").run({ path }));
}

// --- the surface -------------------------------------------------------------

test("the apply tools are destructive in both gate states", () => {
  // The annotation describes the tool, not the session. Hosts gate on these,
  // and a server that lies about them is untrustworthy in precisely the
  // community this is meant to reach.
  for (const gate of [closedGate(), { allowWrite: true, roots: ["/tmp"] }]) {
    for (const t of writeTools(gate)) {
      expect({ name: t.name, ...t.annotations }).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
      });
    }
  }
});

test("the apply tools are listed even when writes are disabled", () => {
  // Listed-and-erroring rather than hidden, so the error text tells the human
  // operator exactly what to do.
  expect(writeTools(closedGate()).map((t) => t.name)).toEqual([...WRITE_TOOL_NAMES]);
});

// --- the gate ----------------------------------------------------------------

test("with the gate shut, an apply is a tool error naming the flag", () => {
  const { path } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  expect(faultOf(tool(closedGate(), "visimark_fmt_apply").run({ path, plan }))).toEqual({
    code: "WRITE",
    message: WRITES_DISABLED,
  });
});

test("the flag alone is not enough — no roots means no writes", () => {
  const { path } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  const gate = { allowWrite: true, roots: [] };
  expect(faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan })).message).toBe(
    WRITES_DISABLED,
  );
});

test("a path outside every declared root is refused", () => {
  const { path } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  const elsewhere = mkdtempSync(join(tmpdir(), "visimark-mcp-root-"));
  const f = faultOf(
    tool({ allowWrite: true, roots: [elsewhere] }, "visimark_fmt_apply").run({
      path,
      plan,
    }),
  );
  expect(f.code).toBe("WRITE");
});

test("the gate is checked before the file is read", () => {
  // A request that was never allowed is refused before the filesystem is
  // touched, so a closed gate says nothing about what is or is not on disk.
  const missing = join(tmpdir(), "visimark-mcp-nothing-here.md");
  expect(
    faultOf(tool(closedGate(), "visimark_fmt_apply").run({ path: missing, plan: {} })).message,
  ).toBe(WRITES_DISABLED);
});

// --- the staleness guard -----------------------------------------------------

test("a plan computed against different bytes is refused", () => {
  const { path, gate } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nand one more line\n`);

  const f = faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan }));
  expect(f).toEqual({
    code: "WRITE",
    message: "the document changed since this plan was computed — re-run visimark_fmt",
  });
});

test("a plan with no sha256 is a usage error, not a silent re-plan", () => {
  // The agent's reviewed plan is what lands, or nothing does.
  const { path, gate } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  delete plan["sha256"];
  expect(faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan })).code).toBe("USAGE");
});

// --- fmt_apply ---------------------------------------------------------------

test("gate open and the hash matching, the plan lands", () => {
  const { path, gate } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  const before = readFileSync(path, "utf8");

  const body = ok(tool(gate, "visimark_fmt_apply").run({ path, plan }));
  expect(body).toMatchObject({ command: "fmt", applied: true, changed: true });
  expect(body["cellsUpdated"]).toBe(plan["cellsUpdated"]);
  expect(body["anchorsUpdated"]).toBe(plan["anchorsUpdated"]);
  expect(readFileSync(path, "utf8")).not.toBe(before);

  // and every stale number it was asked to repair is repaired. The drifted
  // example also carries errors `fmt` does not touch — a cycle, an unknown
  // name, two unparseable dates — so the document is not clean afterwards and
  // is not supposed to be.
  const after = ok(readTool("visimark_check").run({ path }));
  expect(after["summary"]).toMatchObject({ stale: 0 });
});

test("applying the same plan twice is refused, because the bytes moved", () => {
  const { path, gate } = scratch(join(repo, "docs/example-invoice-drift.md"));
  const plan = planFor(path);
  ok(tool(gate, "visimark_fmt_apply").run({ path, plan }));
  expect(faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan })).message).toContain(
    "changed since this plan was computed",
  );
});

test("an artifact the plan did not name is refused before anything is written", () => {
  const { path, gate } = scratch(join(repo, "docs/example-charts.md"), "charts-doc.md");
  const plan = planFor(path);
  const before = readFileSync(path, "utf8");
  plan["artifactsWouldWrite"] = [];

  const f = faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan }));
  expect(f.code).toBe("WRITE");
  expect(f.message).toContain("was not in the plan");
  expect(readFileSync(path, "utf8")).toBe(before);
});

test("an artifact the plan named that can no longer be written is refused", () => {
  // Without this the target is dropped in silence and the call reports
  // success, leaving a document whose numbers moved and whose chart did not.
  const { dir, path, gate } = scratch(join(repo, "docs/example-charts.md"), "charts-doc.md");
  const plan = planFor(path);
  const before = readFileSync(path, "utf8");

  const named = plan["artifactsWouldWrite"] as string[];
  expect(named.length).toBeGreaterThan(0);
  const target = join(dir, named[0]!);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "<svg>hand drawn, and not visimark's</svg>\n");

  const f = faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan }));
  expect(f.code).toBe("WRITE");
  expect(f.message).toContain("can no longer be written");
  expect(readFileSync(path, "utf8")).toBe(before);
  expect(readFileSync(target, "utf8")).toContain("hand drawn");
});

test("one refused target means no artifact is written at all", () => {
  // Every refusal that can be decided before a byte moves is decided first, so
  // a rejected target does not leave half the charts written and the document
  // describing charts that are not there.
  const { dir, path, gate } = scratch(join(repo, "docs/example-charts.md"), "charts-doc.md");
  const plan = planFor(path);
  const before = readFileSync(path, "utf8");
  const named = plan["artifactsWouldWrite"] as string[];

  // refuse the LAST one, and assert the first was not written either
  const last = join(dir, named[named.length - 1]!);
  mkdirSync(dirname(last), { recursive: true });
  writeFileSync(last, "<svg>hand drawn</svg>\n");

  expect(faultOf(tool(gate, "visimark_fmt_apply").run({ path, plan })).code).toBe("WRITE");
  expect(existsSync(join(dir, named[0]!))).toBe(false);
  expect(readFileSync(path, "utf8")).toBe(before);
});

// --- infer_apply -------------------------------------------------------------

const PLAIN_TABLE =
  "# t\n\n| Item | Qty | Rate | Net |\n|---|---:|---:|---:|\n" +
  "| a | 2 | 3.00 | 6.00 |\n| b | 4 | 5.00 | 20.00 |\n| c | 3 | 2.00 | 6.00 |\n";

test("infer_apply inserts the vmark block the plan carried", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-infer-"));
  const path = join(dir, "plain.md");
  writeFileSync(path, PLAIN_TABLE);
  const gate = { allowWrite: true, roots: [dir] };

  const plan = ok(readTool("visimark_infer").run({ path }));
  const body = ok(tool(gate, "visimark_infer_apply").run({ path, plan }));
  expect(body).toMatchObject({ command: "infer", applied: true, changed: true });
  expect(readFileSync(path, "utf8")).toContain("```vmark");
  expect(readFileSync(path, "utf8")).toContain("Net");
});

test("infer_apply lands only the proposals the plan still carried", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-infer2-"));
  const path = join(dir, "plain.md");
  writeFileSync(path, PLAIN_TABLE);
  const gate = { allowWrite: true, roots: [dir] };

  const plan = ok(readTool("visimark_infer").run({ path }));
  plan["proposals"] = [];
  const body = ok(tool(gate, "visimark_infer_apply").run({ path, plan }));
  expect(body).toMatchObject({ applied: true, changed: false });
  expect(readFileSync(path, "utf8")).toBe(PLAIN_TABLE);
});

test("infer_apply is behind the same gate", () => {
  const dir = mkdtempSync(join(tmpdir(), "visimark-mcp-infer3-"));
  const path = join(dir, "plain.md");
  writeFileSync(path, PLAIN_TABLE);
  const plan = ok(readTool("visimark_infer").run({ path }));
  expect(faultOf(tool(closedGate(), "visimark_infer_apply").run({ path, plan })).message).toBe(
    WRITES_DISABLED,
  );
});
