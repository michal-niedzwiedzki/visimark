import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, URI, type Harness } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const drift = readFileSync(
  join(here, "..", "..", "..", "docs", "example-invoice-drift.md"),
  "utf8",
);
const clean = readFileSync(
  join(here, "..", "..", "..", "docs", "example-invoice.md"),
  "utf8",
);

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

test("the clean invoice produces no diagnostics", async () => {
  await h.open("file:///clean.md", clean);
  expect(await h.nextDiagnostics("file:///clean.md")).toEqual([]);
});

test("the drift invoice produces one diagnostic per located finding", async () => {
  await h.open(URI, drift);
  const diags = await h.nextDiagnostics(URI);
  // check() yields 20 finding objects for this document. Exactly two carry
  // no span and so cannot be placed: the collapsed anchor-group STALE, which
  // stands for 8 prose anchors, and the NOTE covering 2 unverified rows.
  // The transcript's "26 problems" counts that group as its 8 anchors.
  expect(diags.length).toBe(18);
  expect(diags.every((d) => d.source === "visimark")).toBe(true);
});

test("a STALE diagnostic covers exactly the stale cell", async () => {
  await h.open("file:///stale.md", drift);
  const diags = await h.nextDiagnostics("file:///stale.md");
  const stale = diags.find((d) => d.code === "STALE")!;
  expect(stale.severity).toBe(2); // Warning
  expect(stale.message).toMatch(/formula gives/);
});

test("a DATE problem is an error", async () => {
  await h.open("file:///dates.md", drift);
  const diags = await h.nextDiagnostics("file:///dates.md");
  const date = diags.find((d) => d.code === "DATE");
  if (date) expect(date.severity).toBe(1); // Error
});

test("a DUP diagnostic carries related information for the first binding", async () => {
  const doc = `\`\`\`vmark #s
x = 1
x = 2
\`\`\`
`;
  await h.open("file:///dup.md", doc);
  const diags = await h.nextDiagnostics("file:///dup.md");
  const dup = diags.find((d) => d.code === "DUP")!;
  expect(dup.severity).toBe(1);
  expect(dup.relatedInformation).toBeDefined();
  expect(dup.range.start.line).toBe(2); // the second binding
});

test("editing to a correct document clears the diagnostics", async () => {
  const bad = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open("file:///fix.md", bad);
  expect((await h.nextDiagnostics("file:///fix.md")).length).toBe(1);
  await h.change("file:///fix.md", bad.replace("9.99", "10.00"));
  expect(await h.nextDiagnostics("file:///fix.md")).toEqual([]);
});
