import { expect, test } from "bun:test";
import { analyze } from "../../src/index.js";
import { lex } from "../../src/lang/lexer.js";
import { parseStatement } from "../../src/lang/parser.js";
import { LangError } from "../../src/lang/token.js";

/**
 * SECURITY.md puts a document that "hang[s] the process on input of a
 * reasonable size" in scope, but every other test in this suite is an
 * example the author thought of. These are the ones an attacker thinks of.
 *
 * The contract each case asserts is the same: a **finding or a result, never
 * a throw**. Before docs/design/parser-depth-cap-plan.md landed, the first
 * five crashed the process with an uncaught RangeError; the annotation on
 * each says which recursion it pins, so the depth cap is not "simplified"
 * down to one guard later.
 */

const N = 30_000;

/** Wrap a formula in the smallest document `analyze` will look at. */
const doc = (formula: string) => `# t\n\n\`\`\`vmark #s\nx = ${formula}\n\`\`\`\n`;

function refusal(formula: string): LangError {
  try {
    parseStatement(`x = ${formula}`);
  } catch (e) {
    if (e instanceof LangError) return e;
    throw e;
  }
  throw new Error("expected a LangError, got a successful parse");
}

// ---- guard 1: inputs the parser cannot even return an AST for ----

test.each([
  // [name, formula, the recursion it overflowed]
  ["parenthesis nest", "(".repeat(N) + "1" + ")".repeat(N), "parseBp via nud's lparen arm"],
  ["call nest", "ABS(".repeat(N) + "1" + ")".repeat(N), "parseBp via identTail"],
  ["unary minus run", "-".repeat(N) + "1", "parseBp via nud's unary arm"],
  [
    "right-associative chain",
    Array.from({ length: N }, () => "2").join("^"),
    "parseBp's rbp recursion",
  ],
])("%s of %s levels is refused, not a stack overflow", (_name, formula) => {
  const e = refusal(formula);
  expect(e.message).toMatch(/nests more than \d+ levels deep/);
  expect(e.end).toBeGreaterThanOrEqual(e.start);
  expect(e.end).toBeLessThanOrEqual(`x = ${formula}`.length);
});

// ---- guard 2: the input guard 1 cannot see ----

test("a long left-associative chain is refused, though the parser never recurses on it", () => {
  // parseBp consumes `1+1+…+1` in its for(;;) loop, so a recursion counter
  // sees depth 1 — and the left-leaning spine it builds still overflows
  // evalExpr. This is the case a parseBp-only guard passes and then crashes on.
  const formula = Array.from({ length: N }, () => "1").join("+");
  expect(refusal(formula).message).toMatch(/nests more than \d+ levels deep/);
});

test("the depth walk itself does not recurse", () => {
  // If deepestNode() were recursive it would overflow on exactly the input it
  // exists to refuse. A LangError here and not a RangeError is the assertion.
  expect(() => parseStatement(`x = ${"(".repeat(200_000)}1${")".repeat(200_000)}`)).toThrow(
    LangError,
  );
});

// ---- the cap does not touch anything real ----

test("expressions at the cap are accepted and just past it are refused", () => {
  // The deepest formula in this repo's own documents is 5.
  const chain = (n: number) => Array.from({ length: n }, () => "1").join("+");
  expect(() => parseStatement(`x = ${chain(200)}`)).not.toThrow();
  expect(() => parseStatement(`x = ${chain(400)}`)).toThrow(LangError);
});

// ---- end to end: a finding with a usable span, and a normal exit ----

test("a pathological formula reports as an ordinary positioned finding", () => {
  const source = doc("(".repeat(N) + "1" + ")".repeat(N));
  const { result } = analyze(source);
  const depth = result.findings.filter((f) => /nests more than/.test(f.message ?? ""));
  expect(depth.length).toBe(1);
  const f = depth[0]!;
  expect(f.code).toBe("TYPE");
  expect(f.name).toBe("x");
  expect(f.span?.start).toBeGreaterThanOrEqual(0);
  expect(f.span?.end).toBeLessThanOrEqual(source.length);
});

test("one pathological binding does not stop the others being checked", () => {
  const source = [
    "# t",
    "",
    "```vmark #s",
    `bad = ${"(".repeat(N)}1${")".repeat(N)}`,
    "good = 2 + 2",
    "```",
    "",
  ].join("\n");
  const { model } = analyze(source);
  expect([...(model.sheets.get("s")?.scalars.keys() ?? [])]).toEqual(["good"]);
});

// ---- checked and already sound: pinned so a regression is visible ----

test("a 200,000-character identifier produces a finding, not a crash", () => {
  const { result } = analyze(doc("A".repeat(200_000)));
  expect(result.findings.length).toBeGreaterThan(0);
});

test("a 300-column table is read without incident", () => {
  const cols = Array.from({ length: 300 }, (_, i) => `C${i}`);
  const source = [
    "# t",
    "",
    `| ${cols.join(" | ")} |`,
    `|${cols.map(() => "---|").join("")}`,
    `| ${cols.map(() => "1").join(" | ")} |`,
    `| ${cols.map(() => "2").join(" | ")} |`,
    "",
    "```vmark #s",
    "Total = SUM(C0) + SUM(C1)",
    "```",
    "",
  ].join("\n");
  const { model } = analyze(source);
  expect(model.sheets.get("s")?.columnIndex.size).toBeGreaterThanOrEqual(300);
});

test("summing every column of a 300-column table is now refused", () => {
  // The one real input the cap makes stricter — see maintainer decision 1 in
  // docs/design/parser-depth-cap-plan.md. It is recorded as a deliberate
  // trade, not discovered later as a regression. A positioned finding beats
  // the RangeError this produced before.
  const chain = Array.from({ length: 300 }, (_, i) => `SUM(C${i})`).join(" + ");
  expect(refusal(chain).message).toMatch(/nests more than \d+ levels deep/);
});

test("the lexer is linear in input length", () => {
  // src.slice(i) in the date probe reads as quadratic; it is not, because the
  // engine returns a sliced-string view. Pinned because a well-meaning
  // "optimisation" here would be a change with no effect and some risk.
  const time = (n: number) => {
    const src = Array.from({ length: n }, () => "1").join("+");
    const t0 = Bun.nanoseconds();
    lex(src);
    return Bun.nanoseconds() - t0;
  };
  time(10_000); // warm
  const small = time(10_000);
  const large = time(100_000);
  // 10x the input for well under 10x the time squared; generous, since this
  // is a timing assertion on shared CI.
  expect(large).toBeLessThan(small * 40);
});
