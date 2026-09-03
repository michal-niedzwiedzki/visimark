import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface InlayHint {
  position: { line: number; character: number };
  label: string;
  paddingLeft?: boolean;
}

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function hints(uri: string, text: string): Promise<InlayHint[]> {
  await h.open(uri, text);
  await h.nextDiagnostics(uri);
  return h.request<InlayHint[]>("textDocument/inlayHint", {
    textDocument: { uri },
    range: {
      start: { line: 0, character: 0 },
      end: { line: text.split("\n").length, character: 0 },
    },
  });
}

test("a stale cell gets a hint showing the computed value", async () => {
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  const hs = await hints("file:///ih-stale.md", doc);
  expect(hs.length).toBe(1);
  expect(hs[0]!.label).toBe("‹10.00›");
  expect(hs[0]!.position.line).toBe(2);
  expect(hs[0]!.paddingLeft).toBe(true);
});

test("a correct cell gets no hint", async () => {
  const doc = `| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  expect(await hints("file:///ih-ok.md", doc)).toEqual([]);
});

test("a stale anchor gets a hint too", async () => {
  const doc = `| Item | Price | Qty |   Net |
|------|------:|----:|------:|
| pen  |  5.00 |   2 | 10.00 |

\`\`\`vmark #s
Net = Price * Qty
total = SUM(Net)
\`\`\`

Total: **0.00**<!--vmark=s.total-->
`;
  const hs = await hints("file:///ih-anchor.md", doc);
  expect(hs.length).toBe(1);
  expect(hs[0]!.label).toBe("‹10.00›");
});

test("non-STALE findings get no hint", async () => {
  const doc = `\`\`\`vmark #s
x = 1
x = 2
\`\`\`
`;
  expect(await hints("file:///ih-dup.md", doc)).toEqual([]);
});

test("a hint respects the requested range", async () => {
  const doc = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |
| ink  |  3.00 |   2 | 8.88 |

\`\`\`vmark #s
Net = Price * Qty
\`\`\`
`;
  await h.open("file:///ih-range.md", doc);
  await h.nextDiagnostics("file:///ih-range.md");
  const hs = await h.request<InlayHint[]>("textDocument/inlayHint", {
    textDocument: { uri: "file:///ih-range.md" },
    range: {
      start: { line: 3, character: 0 },
      end: { line: 4, character: 0 },
    },
  });
  expect(hs.length).toBe(1);
  expect(hs[0]!.label).toBe("‹6.00›");
});
