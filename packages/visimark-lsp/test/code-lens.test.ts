import { afterAll, beforeAll, expect, test } from "bun:test";
import { startServer, type Harness } from "./harness.js";

interface CodeLens {
  range: { start: { line: number; character: number } };
  command?: { title: string; command: string; arguments?: unknown[] };
}

let h: Harness;
beforeAll(async () => {
  h = await startServer();
});
afterAll(async () => {
  await h.stop();
});

async function lenses(uri: string, text: string): Promise<CodeLens[]> {
  await h.open(uri, text);
  await h.nextDiagnostics(uri);
  return h.request<CodeLens[]>("textDocument/codeLens", {
    textDocument: { uri },
  });
}

const twoSheets = `| Item | Price | Qty |  Net |
|------|------:|----:|-----:|
| pen  |  5.00 |   2 | 9.99 |

\`\`\`vmark #order
Net = Price * Qty
total = SUM(Net)
\`\`\`

| Stage | Share |
|-------|------:|
| a     |   50% |

\`\`\`vmark #plan
covered = SUM(Share)
\`\`\`

Covered: **0.50**<!--vmark=plan.covered-->
`;

test("each vmark block gets a lens on its fence line", async () => {
  const ls = await lenses("file:///cl-two.md", twoSheets);
  const fixes = ls.filter((l) => l.command?.command === "visimark.fixSheet");
  expect(fixes.length).toBe(2);
});

test("the lens counts formulas and stale values", async () => {
  const ls = await lenses("file:///cl-count.md", twoSheets);
  const order = ls.find((l) => l.command?.title.includes("stale"))!;
  expect(order.command!.title).toBe("2 formulas · 1 stale");
});

test("a clean sheet's lens says ok", async () => {
  const ls = await lenses("file:///cl-ok.md", twoSheets);
  const ok = ls.find((l) => l.command?.title.includes("ok"));
  expect(ok!.command!.title).toBe("1 formula · ok");
});

test("the lens carries the uri and sheet id as arguments", async () => {
  const ls = await lenses("file:///cl-args.md", twoSheets);
  const fix = ls.find((l) => l.command?.command === "visimark.fixSheet")!;
  expect(fix.command!.arguments).toEqual(["file:///cl-args.md", "order"]);
});

test("every block also gets an explain lens", async () => {
  const ls = await lenses("file:///cl-explain.md", twoSheets);
  expect(ls.filter((l) => l.command?.command === "visimark.explainSheet").length).toBe(2);
});

test("a document with no vmark block has no lenses", async () => {
  expect(await lenses("file:///cl-none.md", "# prose only\n")).toEqual([]);
});
