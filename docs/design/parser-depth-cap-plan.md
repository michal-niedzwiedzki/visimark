# Cap expression depth and test the parser against pathological input — Implementation Plan

**Source:** `docs/reviews/2026-09-15.md` §2.4 (row 10, rated B−). Hardening plus tests —
no paired spec, per the repo convention that non-vocabulary work does not carry a design
doc. Independent of §2.1–§2.3, which have landed.

**Goal:** Make every document VisiMark can be handed produce a *finding* or a result,
never an uncaught `RangeError`. Close the gap between `SECURITY.md`'s promise — a
document that "hang[s] the process on input of a reasonable size" is in scope — and a
test suite that is entirely example-based.

**Architecture:** One depth budget, enforced in two places inside
`packages/visimark/src/lang/parser.ts`, because the parser is the only producer of
`Expr` and therefore the only place that can bound every consumer of one. No new
module, no change to the `Expr` type, no new public export.

**Tech Stack:** TypeScript (`strict` + `noUncheckedIndexedAccess`), Bun test. No new
dependency — see Global Constraints.

---

## Findings from validating the review's brief

**The request is well founded and understated.** The crash is real, reproducible, and
kills the language server outright. But the brief's prescription — "thread a depth
counter through `parseBp`" — **does not close the hole the brief itself names.** Four
findings, two of which change the plan.

### 1. Verified: the crash is real, at both ends of the pipeline

Measured on this branch under Bun 1.4.2 on Linux, by binary search for the largest `n`
that does not throw `RangeError`:

| Input | Parser survives to | Then what |
|---|---|---|
| `((((…1…))))` | n = 18,751 | `RangeError` in `parseBp` |
| `ABS(ABS(…1…))` | n = 12,501 | `RangeError` in `parseBp` |
| `-----…1` | n = 12,501 | `RangeError` in `parseBp` |
| `2^2^…^2` | n = 31,251 | parses, then `RangeError` in `evalExpr` at n ≥ 22,501 |

End to end, `visimark check` on a document containing a 30,000-deep parenthesis nest
prints a bare `RangeError: Maximum call stack size exceeded.` with a 10,000-frame stack
trace to stderr and exits `2`. There is no finding, no span, and no mention of which
file or binding caused it.

### 2. Verified: the language server does not survive it — it dies

The brief says "in the LSP it takes down the server process, not just one diagnostic."
That is correct, and worth being precise about, because it is the strongest reason to
do this work. `runCheck` is `async` and is invoked as `void runCheck(doc)`
([`server.ts:75`](../../packages/visimark-lsp/src/server.ts#L75),
[`:98`](../../packages/visimark-lsp/src/server.ts#L98)), so a throw inside `analyze()`
becomes an unhandled rejection with nobody to catch it.

Driven through the real `test/harness.ts`: opening a document with a 30,000-deep nest
produces **no diagnostics at all**, and the *next* document opened — a clean
`docs/example-invoice.md` — gets `Connection is closed.` The process is gone. Every
other VisiMark feature in the editor (hover, code lens, inlay hints, format-on-save)
goes with it, for every open file, until the client restarts the server. One
pathological formula pasted into one document is a full-editor outage.

### 3. **The correction: a depth counter in `parseBp` does not close the hole**

`parseBp` consumes a left-associative operator chain **iteratively**, in its `for(;;)`
loop. So `1+1+1+…+1`:

- recurses in `parseBp` to depth **1** — a recursion counter never fires;
- builds a left-leaning `binary` spine of AST depth **n**;
- overflows `evalExpr`, which walks that spine recursively, at n ≈ 30,000.

Measured: `1+1+…+1` at n = 30,000 (a 59,999-character line — a plausible size for a
generated document) parses cleanly, then dies in `evalExpr`. **With the brief's fix
applied exactly as written, this input still crashes the process.** The brief's own
test item 3 asks for "a very long chain of binary operators" as a case that must not
throw, so the brief contains both the requirement and a fix that fails it.

The quantity that has to be bounded is **AST depth**, not parser recursion depth. They
coincide for nesting and for right-associative `^`; they diverge exactly for
left-associative chains, which are the most natural way to write a long formula.

Hence two guards, sharing one constant:

- **`parseBp` recursion counter** — required, because the parser cannot *return* an AST
  for `((((…` at all; it overflows first. This is the brief's guard, and it is
  necessary.
- **A post-parse AST depth check in `parseTopLevel`**, walked **iteratively** with an
  explicit stack so the guard cannot itself overflow. This is what catches the
  left-associative spine, and it is the part the brief is missing.

Both throw the same `LangError`, so downstream sees one refusal, not two.

### 4. **The correction: the cap's ceiling is the shallowest consumer, not the parser**

The brief says to pick a limit "far below the stack limit", framing that as the
parser's. The binding constraint is the *shallowest* recursive walker over the
resulting AST, of which there are five —
[`evalExpr`](../../packages/visimark/src/eval/evaluate.ts#L13),
[`rebase`](../../packages/visimark/src/model/build.ts#L468),
[`visit`](../../packages/visimark/src/eval/check-report.ts#L151), and the walkers in
`eval/graph.ts` and `eval/check.ts` — each with a different frame size. The measured
parser limits above are therefore not the number to budget against.

Two further facts the measurement does not show and the comment must state:

- These numbers are **JavaScriptCore under Bun**. The CLI ships to Node
  ([`ci.yml`](../../.github/workflows/ci.yml) runs it there deliberately) and the LSP
  runs under the editor's Node. V8's default stack is materially smaller than JSC's.
  Node is not installed in the authoring environment, so the Node figure is **measured
  in Task 4, not assumed** — the cap is only defensible once it has been checked on the
  runtime with the smallest stack.
- A future walker added to the pipeline inherits the budget automatically, which is the
  argument for one named constant in the parser rather than a guard per walker.

### 5. Checked and clear — three things the brief implies are problems but are not

Worth recording so the tests are framed as regression pins rather than fixes:

- **The lexer is linear.** `src.slice(i)` in the date probe looked quadratic; it is not,
  because JS engines return a sliced-string view. Measured: 1.2 ms at 2 KB → 16.8 ms at
  200 KB, flat per byte. No fix needed.
- **A very long identifier is already handled.** A 200,000-character name produces a
  clean finding and exit `1`.
- **A wide table is already handled.** 300 columns with a 300-term `SUM()` chain checks
  cleanly and exits `0`. **But see the open question** — under a cap of 256 that same
  document would start being refused, and it is the only realistic input this change
  makes stricter.

### 6. No `--json` contract change, unlike §2.3

The refusal travels as an existing `LangError`, which
[`build.ts:452-464`](../../packages/visimark/src/model/build.ts#L452-L464) already
converts to a `code: "TYPE"` finding with a span. `error.code` in
[`structured-output-json-spec.md`](structured-output-json-spec.md) is untouched. This is
a new *message*, not a new kind of output.

### 7. The property test needs a printer, and the repo does not have one

The brief's step 2 says to "generate random well-formed expression ASTs, print them,
parse them back". **There is no `Expr` printer anywhere in the repo** — `fmt` rewrites
document tables and artifact anchors, never formula text, and nothing else renders an
`Expr`. So the brief's round trip is not available today.

Writing a production `printExpr` to enable a test would add public surface nothing ships
against, and a precedence-aware printer is itself the kind of code that needs testing —
the test would rest on an untested oracle, and a printer bug that inverts a parser bug
would pass.

**The design that avoids both problems:** keep the printers test-local, and write
*two* of them.

- `printFull` wraps **every** node in parentheses. It has no precedence logic at all, so
  it is correct by inspection and needs no test of its own. It is the oracle.
- `printMin` emits the minimal parenthesisation, using the real `LEFT_BP` /
  `RIGHT_ASSOC` semantics.

The property is then `parse(printMin(ast)) ≡ parse(printFull(ast)) ≡ ast`, comparing
modulo spans. The first equality is what exercises precedence and associativity; the
oracle makes it meaningful, because `printMin` and the parser would have to hold exactly
inverse bugs to agree with `printFull` as well. No production code, no dependency, and
precedence coverage the brief's single round trip would not have given.

### Recommendation

**Do it, with findings 3 and 4 folded in.** Without finding 3 the change would ship a
guard that passes its own tests and still crashes on `1+1+…+1`; without finding 4 the
constant would be justified against the wrong number on the wrong runtime. The cost is
roughly 40 lines of parser change and three test files.

---

## Global Constraints

- **No document that checks today may change by a byte.** The deepest formula anywhere
  in this repository's Markdown is **depth 5**
  (`ROUND(MaxNodes * (1 - budget.reserved_capacity) - 0.5, 0)`). Any cap in the hundreds
  is orders of magnitude clear of every real document; the acceptance tests that parse
  published docs are the check that this holds.
- **The refusal is a `LangError` with a valid span**, so `build` converts it into a
  positioned `TYPE` finding like every other parse refusal. Never a thrown
  `RangeError`, never an unhandled rejection.
- **Both guards share one exported-nowhere constant** with a comment stating the
  measured margin and the reasoning. One number, one place to revisit.
- **The depth walk is iterative.** A recursive guard against deep recursion is not a
  guard. Explicit stack, no exceptions.
- **No new dependency**, and no test library — §2.4 is explicit, and the repo's four
  runtime deps are all load-bearing. The generator is hand-rolled with a fixed seed so
  a failure is reproducible from the seed alone.
- **No `any`, no `as any`, no `@ts-ignore` / `@ts-expect-error`.**
- `fix:` for the parser commit, `test:` for the test commits; conventional commits.
- Never `bunx visimark`. Use `bun src/cli/main.ts` from `packages/visimark`, or
  `visimark-dev`.
- Each commit carries exactly one `Co-Authored-By` trailer resolved from
  [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the
  session doing the work. Do not copy a trailer out of this plan.

### Verification gate — run after *every* task, loop until green

```
bun test                      # 741 pass, 0 fail (baseline on this branch)
bun run typecheck
bun run lint                  # unchanged: 1785 warnings, all from docs/vendor/ (§2.6)
cd packages/visimark && bun src/cli/main.ts check ../../docs/example-invoice.md
cd packages/visimark && bun src/cli/main.ts fmt ../../docs/example-charts.md
cd ../.. && git diff --exit-code -- docs/
```

---

### Task 1: The depth budget in the parser

**Files:**
- Modify: `packages/visimark/src/lang/parser.ts`

**Interfaces:**

```ts
/** Deepest expression the pipeline will accept. Not exported: the guard is the
 *  parser's job, and no consumer should be able to raise it. */
const MAX_EXPR_DEPTH: number;

const DEPTH_MESSAGE = "expression nests too deeply";

class Parser {
  private depth = 0;          // parseBp recursion, guard 1
  private parseBp(minBp: number): Expr;   // ++ on entry, -- in finally
  parseTopLevel(): Expr;      // runs guard 2 before returning
}

/** Iterative — an explicit worklist, never the call stack. Returns the deepest
 *  node found so the refusal can point at it. */
function deepestNode(root: Expr): { depth: number; at: Expr };
```

- [ ] **Step 1.1** Guard 1: `depth` field on `Parser`, incremented on entry to
      `parseBp` and decremented in a `finally`. On exceeding the cap, throw
      `LangError(DEPTH_MESSAGE, t.start, t.end)` for the token at the point of refusal.
      The `finally` matters — `parseStatement`'s outer `catch` inspects and rethrows, and
      a leaked counter would make a later statement on the same line refuse spuriously.
- [ ] **Step 1.2** Guard 2: `deepestNode`, walked with an explicit `Expr[]` stack
      carrying a parallel depth, and called once at the end of `parseTopLevel`. On
      exceeding the cap, throw `LangError(DEPTH_MESSAGE, at.start, at.end)` — the
      deepest node's own span, not the whole line, so the caret lands somewhere useful
      in a 60 KB expression.
- [ ] **Step 1.3** The comment carrying finding 3 and finding 4: that the two guards
      exist because parser recursion depth and AST depth diverge on left-associative
      chains, that the ceiling is the shallowest of five AST walkers and not the
      parser, the measured numbers from finding 1 including the Node figure from
      Task 4, and that the deepest real formula in the repo is 5. This is the comment
      that stops the second guard being deleted as redundant.
- [ ] **Step 1.4** Verification gate.

**Commit:** `fix: refuse expressions deeper than the pipeline can walk`

---

### Task 2: Pathological-input tests

**Files:**
- Create: `packages/visimark/test/lang/pathological.test.ts`
- Create: `packages/visimark-lsp/test/resilience.test.ts`
- Modify: `packages/visimark-lsp/src/server.ts`

Each case asserts a **finding or a result, never a throw** — the property
`SECURITY.md` actually promises.

- [ ] **Step 2.1** Depth cases through `parseStatement`: deep parens, deep calls, a
      unary-minus run, a right-associative `^` chain, and — the case from finding 3 —
      a long left-associative `+` chain. Each asserts a `LangError` with a span inside
      the line, and each is annotated with the `RangeError` it pins so a future reader
      knows why the number is what it is.
- [ ] **Step 2.2** End-to-end through `check()`: a document with a pathological formula
      yields findings and a normal exit, and the findings carry usable spans.
- [ ] **Step 2.3** The cases that already pass, pinned as regressions with a comment
      saying so (finding 5): a 200,000-character identifier, a 300-column table read
      by a short formula, and a 200 KB block asserting linear lexer time. Separately,
      the 300-term `SUM(C0) + … + SUM(C299)` chain over that same table, pinned as
      **now refused** with a comment citing maintainer decision 1 — it is the one
      input this change makes stricter, so the test says so out loud.
- [ ] **Step 2.4** The LSP case the brief asks for, and the sharpest test here: open a
      pathological document, then open a clean one and assert its diagnostics still
      arrive. On today's code the second open fails with `Connection is closed.`
- [ ] **Step 2.5** The catch-all, per maintainer decision 3: wrap `runCheck`'s body in
      `try`/`catch`, publish an empty diagnostic set for that document, and log the
      error to the connection so it is visible in the client's output channel rather
      than swallowed. `void runCheck(doc)` stops being able to end the process.
- [ ] **Step 2.6** Verification gate.

**Commit:** `fix: keep the language server alive through an unexpected throw`

---

### Task 3: The round-trip property test

**Files:**
- Create: `packages/visimark/test/lang/roundtrip.test.ts`

Per finding 7: a seeded generator and two test-local printers, no production printer and
no generator dependency.

- [ ] **Step 3.1** A 3-line xorshift PRNG with a fixed seed, and `randomExpr(depth)`
      producing `num` / `str` / `date` / `ref` / qualified `ref` / `unary` / `binary`
      over the real `LEFT_BP` table / `call` with a real arity from
      `eval/functions.ts`. Generated depth stays under the cap; the boundary itself is
      Task 2's job.
- [ ] **Step 3.2** `printFull` (every node parenthesised — the oracle, correct by
      inspection) and `printMin` (minimal parenthesisation from `LEFT_BP` /
      `RIGHT_ASSOC`).
- [ ] **Step 3.3** Over ~2,000 generated trees assert
      `parse(printMin(e)) ≡ parse(printFull(e)) ≡ e`, comparing modulo `start`/`end`.
      On failure, print the seed and the offending source — a property test that cannot
      be reproduced from its output is a flake report.
- [ ] **Step 3.4** A note at the top of the file on why the printers live in the test
      and not in `src/lang/`, so nobody promotes them later without a reason to.
- [ ] **Step 3.5** Verification gate.

**Commit:** `test: round-trip generated expressions against a parenthesised oracle`

---

### Task 4: Fix the cap against the smallest runtime, and record the promise

**Files:**
- Modify: `packages/visimark/src/lang/parser.ts` (the constant and its comment)
- Modify: `SECURITY.md`

- [ ] **Step 4.1** Measure the overflow threshold for each of the five AST walkers
      under **Node** as well as Bun, using the packed tarball the way `ci.yml` does.
      Record the smallest. If it puts the chosen cap within ~10× of an overflow, lower
      the cap and say so here rather than shipping a number that only holds on Bun.
- [ ] **Step 4.2** Fold the measured numbers into the Task 1 comment.
- [ ] **Step 4.3** `SECURITY.md` Scope gains a short paragraph, alongside the
      concurrent-processes one: expression depth is bounded at parse time so that no
      document can exhaust the stack, the bound is far above any real formula, and a
      document that still exhausts memory or time is in scope and worth a report.
- [ ] **Step 4.4** Verification gate.

**Commit:** `docs: state the expression-depth bound in SECURITY.md`

---

## Maintainer decisions (2026-09-15)

1. **The cap is `256`.** ~50× the deepest real formula in this repo and the largest
   margin below Node's stack. The trade-off is accepted knowingly: a 300-column table
   whose formula is `SUM(C0) + SUM(C1) + … + SUM(C299)` checks cleanly today and will
   be refused. That is not invoice arithmetic, and it gets a finding with a span rather
   than a crash. The number lives in one constant with the reasoning beside it.
2. **The refusal reuses `TYPE`** — what every parse refusal already carries, and no
   change to [`structured-output-json-spec.md`](structured-output-json-spec.md)'s closed
   `error.code` enum. One new message, not one new concept.
3. **The LSP catch-all is in**, as Task 2 Step 2.5. The depth cap closes today's crash;
   the catch-all closes the class, because `void runCheck(doc)` will turn any future
   unexpected throw into a dead server for every open file. It logs rather than
   swallowing, so it cannot quietly mask a real bug.

## Out of scope

- §2.1 (`check()` decomposition), §2.5 (playground bundle), §2.6 (lint), §2.7 (action
  pinning), §2.8 (`cmdExplain`).
- **Memory and time exhaustion.** This change bounds *stack* depth. A document that is
  merely enormous — a million-row table — is a different limit and a different fix.
- **Making the walkers iterative.** Rewriting `evalExpr`, `rebase` and the three others
  to explicit stacks would remove the ceiling rather than bound it, but it is five
  rewrites of load-bearing code to buy depth no real document wants.
- **`remark`'s own recursion** over deeply nested Markdown, which is upstream's parser
  and upstream's limit.
