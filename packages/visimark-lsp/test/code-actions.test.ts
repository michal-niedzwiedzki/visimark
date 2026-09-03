import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface CodeAction {
  title: string;
  kind?: string;
  isPreferred?: boolean;
  edit?: { changes?: Record<string, { newText: string }[]> };
}

const stale = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |
| ink  |  3.00 |   2 | 8.88 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function actions(
  uri: string,
  text: string,
  line: number,
  only?: string[],
): Promise<CodeAction[]> {
  await h.open(uri, text);
  await h.nextDiagnostics(uri);
  return h.request<CodeAction[]>("textDocument/codeAction", {
    textDocument: { uri },
    range: {
      start: { line, character: 0 },
      end: { line, character: 40 },
    },
    context: { diagnostics: [], ...(only ? { only } : {}) },
  });
}

test("a stale cell offers a preferred update fix", async () => {
  const a = await actions("file:///ca-stale.md", stale, 2);
  const fix = a.find((x) => x.kind === "quickfix")!;
  expect(fix.title).toBe("VisiMark: update to 10.00");
  expect(fix.isPreferred).toBe(true);
  const edits = Object.values(fix.edit!.changes!)[0]!;
  expect(edits[0]!.newText).toBe("10.00");
});

test("the quick fix at one cell does not repair the other", async () => {
  const a = await actions("file:///ca-one.md", stale, 2);
  const fix = a.find((x) => x.kind === "quickfix")!;
  expect(Object.values(fix.edit!.changes!)[0]!.length).toBe(1);
});

test("source.fixAll repairs every stale value at once", async () => {
  const a = await actions("file:///ca-all.md", stale, 2, [
    "source.fixAll.visimark",
  ]);
  const all = a.find((x) => x.kind === "source.fixAll.visimark")!;
  expect(all.title).toBe("VisiMark: fix all stale values");
  expect(Object.values(all.edit!.changes!)[0]!.length).toBe(2);
});

test("a decidable date offers an ISO rewrite", async () => {
  const doc = `| Item |        Due |
|------|------------|
| pen  | 15.10.2026 |

\`\`\`vmark #s
last = MAX(Due)
\`\`\`
`;
  const a = await actions("file:///ca-date.md", doc, 2);
  const fix = a.find((x) => x.title.includes("2026-10-15"));
  expect(fix).toBeDefined();
});

test("an ambiguous date offers no fix", async () => {
  const doc = `| Item |        Due |
|------|------------|
| pen  | 11/12/2026 |

\`\`\`vmark #s
last = MAX(Due)
\`\`\`
`;
  const a = await actions("file:///ca-amb.md", doc, 2);
  expect(a.filter((x) => x.kind === "quickfix")).toEqual([]);
});

test("an unknown name offers its did-you-mean as a fix", async () => {
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #s
Net = Pric * Qty
\`\`\`
`;
  const a = await actions("file:///ca-undef.md", doc, 5);
  const fix = a.find((x) => x.title.includes("Price"));
  expect(fix).toBeDefined();
});
