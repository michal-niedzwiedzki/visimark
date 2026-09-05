import { expect, test } from "bun:test";
import { locate } from "../../src/parse/document.js";
import { build } from "../../src/model/build.js";
import { check } from "../../src/eval/check.js";
import { lex } from "../../src/lang/lexer.js";
import { LangError } from "../../src/lang/token.js";
import type { Finding } from "../../src/model/types.js";

const run = (src: string) => check(build(locate(src)));
const typeFindings = (fs: Finding[]) => fs.filter((f) => f.code === "TYPE");

// `Out` is seeded with a value wrong for every row, so each row reports.
const sheet = (rule: string, raw = "10") => `
| Item | Qty | Out |
|------|----:|----:|
| a    |  ${raw} |   9 |
| b    |   2 |   9 |

\`\`\`vmark #s
Out = ${rule}
\`\`\`
`;

// ---- the literals are gone from the surface syntax ---------------------

test("`true` and `false` do not lex", () => {
  for (const word of ["true", "false"]) {
    expect(() => lex(word)).toThrow(LangError);
    try {
      lex(word);
    } catch (e) {
      expect((e as LangError).message).toBe(
        "VisiMark has no boolean literals; use `IF()` to produce a number or a string",
      );
      expect((e as LangError).start).toBe(0);
      expect((e as LangError).end).toBe(word.length);
    }
  }
});

test("a boolean literal in a formula is a TYPE finding", () => {
  const ts = typeFindings(run(sheet("IF(true, 1, 0)")).findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe(
    "VisiMark has no boolean literals; use `IF()` to produce a number or a string",
  );
});

test("`true` cannot be bound as a name either", () => {
  const src = `
\`\`\`vmark
true = 1
\`\`\`
`;
  expect(typeFindings(run(src).findings)).toHaveLength(1);
});

test("identifiers that merely start with the words are unaffected", () => {
  const kinds = lex("truthy + falsehood").map((t) => t.kind);
  expect(kinds).toEqual(["ident", "op", "ident", "eof"]);
});

// ---- a boolean can never be stored -------------------------------------

const STORE_MSG = "a boolean cannot be stored; wrap it in `IF()` to produce a number or a string";

test("a column rule yielding a boolean is one TYPE finding, not one per row", () => {
  const r = run(sheet("Qty > 5"));
  const ts = typeFindings(r.findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe(STORE_MSG);
  expect(ts[0]!.rowLabel).toBeUndefined();
});

test("a boolean column emits no misleading NOTE about upstream dates", () => {
  const r = run(sheet("Qty > 5"));
  expect(r.findings.filter((f) => f.code === "NOTE")).toEqual([]);
  expect(r.findings.filter((f) => f.code === "STALE")).toEqual([]);
});

test("a scalar yielding a boolean is a TYPE finding", () => {
  const src = `
| Item | Qty |
|------|----:|
| a    |  10 |

\`\`\`vmark #s
big = SUM(Qty) > 5
\`\`\`
`;
  const ts = typeFindings(run(src).findings);
  expect(ts).toHaveLength(1);
  expect(ts[0]!.message).toBe(STORE_MSG);
});

// ---- the type still exists in flight -----------------------------------

test("comparisons still drive IF(), including `and`, `or` and `not`", () => {
  const r = run(sheet(`IF(Qty > 5 and not (Qty > 100), 1, 0)`));
  expect(typeFindings(r.findings)).toEqual([]);
  const stale = r.findings.filter((f) => f.code === "STALE");
  expect(stale.map((f) => f.computed)).toEqual(["1", "0"]);
});

// ---- an input cell reading "true" stays a string ------------------------

test("a cell reading `true` is the string it looks like", () => {
  const src = `
| Item | Flag  | Out |
|------|-------|----:|
| a    | true  |   9 |
| b    | other |   9 |

\`\`\`vmark #s
Out = IF(Flag == "true", 1, 0)
\`\`\`
`;
  const r = run(src);
  expect(typeFindings(r.findings)).toEqual([]);
  const stale = r.findings.filter((f) => f.code === "STALE");
  expect(stale.map((f) => f.computed)).toEqual(["1", "0"]);
});

test("a parse error still names the binding it came from", () => {
  const src = `
| Item | Qty |
|------|----:|
| a    |  10 |

\`\`\`vmark #s
good = 1
flag = true
\`\`\`
`;
  const t = typeFindings(run(src).findings)[0]!;
  expect(t.name).toBe("flag");
  expect(t.sheetId).toBe("s");
});
