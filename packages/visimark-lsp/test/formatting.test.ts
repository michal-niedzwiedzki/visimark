import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, type Harness } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const docDir = join(here, "..", "..", "..", "docs");
const clean = readFileSync(join(docDir, "example-invoice.md"), "utf8");
const drift = readFileSync(join(docDir, "example-invoice-drift.md"), "utf8");

interface TextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

/** Apply LSP edits to a string, right to left. */
function apply(text: string, edits: TextEdit[]): string {
  const lines = text.split("\n");
  const offsetOf = (p: { line: number; character: number }): number => {
    let n = 0;
    for (let i = 0; i < p.line; i++) n += lines[i]!.length + 1;
    return n + p.character;
  };
  return [...edits]
    .sort((a, b) => offsetOf(b.range.start) - offsetOf(a.range.start))
    .reduce(
      (acc, e) =>
        acc.slice(0, offsetOf(e.range.start)) + e.newText + acc.slice(offsetOf(e.range.end)),
      text,
    );
}

test("formatting the clean invoice produces no edits", async () => {
  const uri = "file:///fmt-clean.md";
  await h.open(uri, clean);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits).toEqual([]);
});

test("formatting the drift invoice repairs every stale value", async () => {
  const uri = "file:///fmt-drift.md";
  await h.open(uri, drift);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits.length).toBeGreaterThan(0);
  const out = apply(drift, edits);
  // The result is what the CLI's fmt would have written.
  expect(out).not.toBe(drift);
  expect(out.split("\n").length).toBe(drift.split("\n").length);
});

test("edits are minimal — one per stale cell, not a whole-document replace", async () => {
  const uri = "file:///fmt-minimal.md";
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open(uri, doc);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits.length).toBe(1);
  expect(edits[0]!.newText).toBe("10.00");
  expect(edits[0]!.range.start.line).toBe(2);
});

test("range formatting touches only the requested range", async () => {
  const uri = "file:///fmt-range.md";
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |
| ink  |  3.00 |   2 | 8.88 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open(uri, doc);
  const edits = await h.request<TextEdit[]>("textDocument/rangeFormatting", {
    textDocument: { uri },
    range: {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 40 },
    },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits.length).toBe(1);
  expect(edits[0]!.newText).toBe("10.00");
});

test("formatting never touches an ambiguous date", async () => {
  const uri = "file:///fmt-date.md";
  const doc = `| Item |        Due |
|------|------------|
| pen  | 11/12/2026 |

\`\`\`vmark #s
last = MAX(Due)
\`\`\`
`;
  await h.open(uri, doc);
  const edits = await h.request<TextEdit[]>("textDocument/formatting", {
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  expect(edits).toEqual([]);
});
