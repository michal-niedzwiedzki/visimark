import { expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { VFile } from "vfile";
import remarkLintVisimark from "../src/index.js";

async function run(content: string | Buffer): Promise<VFile> {
  const file = new VFile({ value: content });
  return unified().use(remarkParse).use(remarkStringify).use(remarkLintVisimark).process(file);
}

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #s
Net = Qty * Rate
\`\`\`
`;

const stale = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 9.99 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const failingAssert = `\`\`\`vmark #calls
spent  = 5
budget = 1

assert spent <= budget
\`\`\`
`;

test("clean document produces no messages", async () => {
  const file = await run(clean);
  expect(file.messages).toHaveLength(0);
});

test("a plain STALE cell produces one fatal message with a line and no column", async () => {
  const file = await run(stale);
  expect(file.messages).toHaveLength(1);
  const m = file.messages[0]!;
  expect(m.fatal).toBe(true);
  expect(m.source).toBe("visimark");
  expect(m.ruleId).toBe("visimark-stale");
  expect(m.reason).toBe("lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)");
  expect(m.place).toMatchObject({ line: 3 });
  expect((m.place as { column?: number })?.column).toBeUndefined();
});

test("a failing assert produces one fatal message", async () => {
  const file = await run(failingAssert);
  expect(file.messages).toHaveLength(1);
  const m = file.messages[0]!;
  expect(m.fatal).toBe(true);
  expect(m.ruleId).toBe("visimark-assert");
  expect(m.reason).toBe("assert spent <= budget: 5 <= 1 is false");
});

test("file.value as a Buffer is handled the same as a string", async () => {
  const file = await run(Buffer.from(stale, "utf8"));
  expect(file.messages).toHaveLength(1);
  expect(file.messages[0]!.ruleId).toBe("visimark-stale");
});

test("registering the plugin twice reports every finding twice", async () => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkStringify)
    .use(remarkLintVisimark)
    .use(remarkLintVisimark)
    .process(new VFile({ value: stale }));
  expect(file.messages).toHaveLength(2);
});

test("the host's own parsed tree is ignored — no remark-gfm needed for a table to be seen", async () => {
  // unified().use(remarkParse) alone does not know about GFM tables; the
  // plugin must still find the STALE finding by re-parsing file.value with
  // its own locate(), which applies remark-gfm internally.
  const file = await run(stale);
  expect(file.messages).toHaveLength(1);
});

test("a WARN finding is a non-fatal message", async () => {
  const warn = `\`\`\`vmark #s
unused = 1
\`\`\`
`;
  const file = await run(warn);
  expect(file.messages).toHaveLength(1);
  expect(file.messages[0]!.fatal).toBeUndefined();
  expect(file.messages[0]!.ruleId).toBe("visimark-warn");
});

test("a stale prose anchor's collapsed group finding (no span) is not reported, only the cell it anchors", async () => {
  // A stale scalar bound to a prose anchor produces two findings: the cell's
  // own STALE (has a span) and a collapsed anchorGroup STALE with no span
  // (spec §3, §4) — only the first becomes a file.message().
  const anchored = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Net comes to **9.99**<!--vmark=lines.Net-->.
`;
  const file = await run(anchored);
  expect(file.messages).toHaveLength(1);
  expect(file.messages[0]!.ruleId).toBe("visimark-stale");
  expect(file.messages[0]!.reason).toBe("lines.Net: stored 9.99 ≠ computed 10.00");
});
