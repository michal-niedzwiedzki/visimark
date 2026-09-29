# Type-aware anchor placeholder acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make anchor-placeholder acceptance type-aware, so `check`/`fmt` refuse (`ANCHOR`) a bare span that doesn't unambiguously denote a value of the anchor's own type, instead of silently claiming it as a rewrite target.

**Architecture:** Two independent, small changes to existing code paths. (1) `packages/visimark/src/parse/document.ts`'s `innerValueSpan` gets a one-child guard so a delimited placeholder with nested Markdown inside it (a literal `**` inside `**…**`) is refused rather than mis-scoped. (2) `packages/visimark/src/eval/check.ts`'s `evalScalar` gains a new per-anchor check, run once the binding's resolved value type is known, that validates a **bare** (unwrapped) anchor target's trailing token against that type before accepting it — reusing `parseDecorated` (numeric) and adding `parseIsoDate` (date); a string-typed scalar never accepts a bare target. Anchors this new check refuses are tracked in a local `Set` so the existing numeric `STALE` loop later in the same function skips them (they are `ANCHOR`, not `STALE`).

**Tech Stack:** TypeScript, Bun test runner, existing VisiMark parse/eval pipeline. No new dependencies.

**Spec:** `docs/design/an-anchor-with-no-explicit-placeholder-spec.md`

## Global Constraints

- Every commit ends with the `Co-Authored-By:` trailer this session's `.agents/rules/ai-attribution.md` resolves to — never hardcode a vendor name in this plan; the executor resolves the trailer at commit time.
- No new [§10](../visimark-design.md#10-error-taxonomy) finding code — every new refusal is `ANCHOR`.
- No grammar change — `<!--vmark=sheet.name-->` and `<!--vmark=sheet.name%-->` are byte-for-byte unchanged; only acceptance of the *preceding* span changes.
- `fmt` never writes a span this feature refuses (same rule as any other non-`STALE` finding).
- Date- and string-valued scalars gain **no** `STALE` verification or `fmt` write-back from this work — that stays exactly as unimplemented as it is today. Do not add it as a "while I'm in here" extra.
- Run `bun test`, `bun run typecheck`, and `bun run build` from the repo root after every task, plus `bun run packages/visimark/src/cli/main.ts check` on `docs/example-invoice.md` and `docs/playground/tutorial/03-sheets.md` (both must still report `0 problems`) before the final task's commit.

## Review Focus

- **A numeric anchor whose bare token is decorated** (`$110.00`, `12 N`) must still be accepted — `parseDecorated` already treats a decorated number as `kind: "number"`; a regression here would silently start refusing every in-tree invoice-style document.
- **A refused bare anchor must not also be reported `STALE`.** Without the `refusedAnchors` skip in the existing numeric `STALE` loop, a bare non-numeric token in front of a numeric anchor would double-report `ANCHOR` and `STALE` for the same span — confusing, and not what the spec's acceptance fixture (§6) shows.
- **Suppression under an upstream error.** If the scalar is unevaluable (an upstream `UNDEF`/`CYCLE`/etc.), `evalScalar` never reaches the new check for that binding — its anchors must not get a spurious `ANCHOR` on top of the existing suppression `NOTE`. This is free from where the check is inserted (inside the same `try` block, after `v0` is computed) but needs an explicit test, since silently getting it right by construction is easy to break with a later refactor.
- **A percent-sigil anchor (`<!--vmark=x.y%-->`) on a refused bare span.** The existing `percentMine`/`TYPE`/`UNIT` percent-sigil logic runs independently of this new check and is not gated by `refusedAnchors` — a refused span can produce both `ANCHOR` (bad target) and a percent-sigil `TYPE`/`UNIT` finding if applicable. That's intentional (two independently true problems), but needs a test so a future reader doesn't "fix" it into hiding one.
- **The one-child guard must not break `collectFigures`'s existing call to `innerValueSpan`.** `collectFigures` (same file) already checks `child.children?.length === 1` itself before calling `innerValueSpan` for its own purpose (detecting whole-number figures in prose) — the new internal guard is redundant there, not conflicting, but a test pinning that prose-figure detection is unaffected catches a future accidental double-guard bug.

---

### Task 1: Refuse a delimited anchor placeholder whose content isn't a single plain span

**Files:**
- Modify: `packages/visimark/src/parse/document.ts:336-347` (`innerValueSpan`, the `strong`/`emphasis` branch)
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: nothing new — `innerValueSpan` is an existing internal function, unexported, called by `anchorValueSpan` (same file) and by `collectFigures` (same file).
- Produces: nothing new — `innerValueSpan` still returns `(Span & { kind: AnchorTargetKind }) | null`; it now returns `null` (instead of a truncated span) when a `strong`/`emphasis` node has more than one child.

- [ ] **Step 1: Write the failing test**

Add to `packages/visimark/test/eval/check.test.ts` (near the existing `HYPHENATED_SHEET_ID`/`ANCHOR` test):

```typescript
test("a delimited anchor placeholder with nested markdown inside it refuses instead of mis-scoping", () => {
  const src = `Claim: **a **bold** claim**<!--vmark=s.x-->.

\`\`\`vmark #s
x = "a bold claim"
\`\`\`
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code)).toEqual(["ANCHOR"]);
  const anchor = r.findings.find((f) => f.code === "ANCHOR")!;
  expect(anchor.message).toBe("no value to rewrite in front of this anchor");
  expect(r.exitCode).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/visimark/test/eval/check.test.ts -t "nested markdown"`
Expected: FAIL. Today `innerValueSpan` silently returns the span of just `"a "` (the first text child), so `x`'s anchor is treated as seeded with a non-qualifying target instead of refused — the test's `expect(r.findings.map(...)).toEqual(["ANCHOR"])` fails because no finding is produced at all (the string scalar `x` is currently never `STALE`-checked either, so `check` reports `0 problems`).

- [ ] **Step 3: Write minimal implementation**

In `packages/visimark/src/parse/document.ts`, change the `strong`/`emphasis` branch of `innerValueSpan`:

```typescript
function innerValueSpan(node: MdNode): (Span & { kind: AnchorTargetKind }) | null {
  if (node.type === "strong" || node.type === "emphasis") {
    const t = node.children?.[0];
    if (node.children?.length === 1 && t && t.type === "text") {
      return {
        start: off(t, "start"),
        end: off(t, "end"),
        kind: node.type,
      };
    }
    return null;
  }
```

(Only the `if` condition changes — `node.children?.length === 1 &&` is prepended. Everything else in the function, including the `inlineCode` and `text` branches below it, is untouched.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/visimark/test/eval/check.test.ts -t "nested markdown"`
Expected: PASS.

- [ ] **Step 5: Verify `collectFigures`'s own call site is unaffected**

Run the full suite for this file to confirm no regression in prose-figure detection (which already guards `length === 1` itself before calling `innerValueSpan`):

Run: `bun test packages/visimark/test/eval/check.test.ts`
Expected: PASS, including every existing test in the file.

- [ ] **Step 6: Commit**

```bash
git add packages/visimark/src/parse/document.ts packages/visimark/test/eval/check.test.ts
git commit -m "fix: refuse a delimited anchor placeholder with nested markdown inside it

<Co-Authored-By trailer per .agents/rules/ai-attribution.md>"
```

---

### Task 2: Type-aware acceptance for a bare anchor placeholder

**Files:**
- Modify: `packages/visimark/src/eval/check.ts` (imports; `evalScalar`; the numeric `STALE` loop inside `evalScalar`)
- Test: `packages/visimark/test/eval/check.test.ts`

**Interfaces:**
- Consumes: `parseDecorated` (`packages/visimark/src/eval/units.ts`, already imported in `check.ts`); `parseIsoDate` (`packages/visimark/src/eval/dates.ts`, exported as `parseIsoDate(text: string): IsoResult` where `IsoResult` is `{ ok: true; iso: string } | { ok: false; ... }` — newly imported here); `valueAnchorsOf(model, id)` (already defined in this file, returns anchors whose `value` is non-null and not an image); each anchor's `commentSpan: Span`, `value!.kind: AnchorTargetKind`, `value!.start`/`value!.end`.
- Produces: a local `refusedAnchors: Set<number>` (keyed by `a.commentSpan.start`) inside the `check()` function, consumed later in the same function by the existing numeric `STALE` loop. Not exported — internal bookkeeping only.

- [ ] **Step 1: Write the failing tests**

Add to `packages/visimark/test/eval/check.test.ts`:

```typescript
test("a bare non-numeric token in front of a numeric anchor refuses instead of being silently rewritten", () => {
  const src = `\`\`\`vmark #s
b precision 2 = 0.25
\`\`\`

It comes to <!--vmark=s.b--> PLN.
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code)).toEqual(["ANCHOR"]);
  expect(r.findings.some((f) => f.code === "STALE")).toBe(false);
  const anchor = r.findings[0]!;
  expect(anchor.message).toBe(
    "no number to rewrite in front of this anchor — wrap a placeholder instead, such as **0** or **_**",
  );
  expect(r.exitCode).toBe(1);
});

test("a bare numeric-shaped token in front of a numeric anchor is still accepted, unchanged", () => {
  const src = `\`\`\`vmark #s
order precision 2 = 110.00
\`\`\`

Order total: 110.00<!--vmark=s.order-->.
`;
  const r = run(src);
  expect(r.findings).toEqual([]);
  expect(r.exitCode).toBe(0);
});

test("a bare non-date token in front of a date anchor refuses", () => {
  const src = `\`\`\`vmark #s
due = 2026-02-01
\`\`\`

Due sometime soon<!--vmark=s.due-->.
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code)).toEqual(["ANCHOR"]);
  expect(r.findings[0]!.message).toBe(
    "no date to rewrite in front of this anchor — wrap a placeholder instead, such as **2026-01-01** or **_**",
  );
  expect(r.exitCode).toBe(1);
});

test("a bare ISO-shaped token in front of a date anchor is accepted (acceptance only — still never STALE-checked)", () => {
  const src = `\`\`\`vmark #s
due = 2026-01-15
\`\`\`

Due by 2026-01-15<!--vmark=s.due-->.
`;
  const r = run(src);
  expect(r.findings).toEqual([]);
  expect(r.exitCode).toBe(0);
});

test("a bare non-ISO date-shaped token does not qualify as a date anchor's target", () => {
  const src = `\`\`\`vmark #s
due = 2026-01-15
\`\`\`

Due by 01/15/2026<!--vmark=s.due-->.
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code)).toEqual(["ANCHOR"]);
});

test("bare prose in front of a string anchor always refuses", () => {
  const src = `\`\`\`vmark #s
status = "all clear"
\`\`\`

The status is no problem<!--vmark=s.status--> today.
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code)).toEqual(["ANCHOR"]);
  expect(r.findings[0]!.message).toBe(
    "a string anchor cannot rewrite bare prose — wrap a placeholder instead, such as **_**",
  );
  expect(r.exitCode).toBe(1);
});

test("a delimited placeholder is accepted for a string anchor regardless of content", () => {
  const src = `\`\`\`vmark #s
status = "all clear"
\`\`\`

Status: **all clear**<!--vmark=s.status-->.
`;
  const r = run(src);
  expect(r.findings).toEqual([]);
  expect(r.exitCode).toBe(0);
});

test("a refused anchor is suppressed, not doubly reported, when the scalar is unevaluable upstream", () => {
  const src = `\`\`\`vmark #s
b precision 2 = missing_name
\`\`\`

It comes to <!--vmark=s.b--> PLN.
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code)).toEqual(["UNDEF"]);
});

test("a well-formed but wrong date anchor is still not verified — non-goal, unchanged from today", () => {
  const src = `\`\`\`vmark #s
due = 2026-01-15
\`\`\`

Due by 2026-02-01<!--vmark=s.due-->.
`;
  const r = run(src);
  // 2026-02-01 is a well-formed ISO date, so it's accepted as a target —
  // but it disagrees with the stored 2026-01-15, and this feature adds no
  // date STALE verification, so that disagreement is still invisible.
  expect(r.findings).toEqual([]);
  expect(r.exitCode).toBe(0);
});

test("a percent sigil on a refused string-anchor span reports both ANCHOR and the existing TYPE refusal", () => {
  const src = `\`\`\`vmark #s
status = "all clear"
\`\`\`

The status is no problem<!--vmark=s.status%--> today.
`;
  const r = run(src);
  expect(r.findings.map((f) => f.code).sort()).toEqual(["ANCHOR", "TYPE"]);
  const type = r.findings.find((f) => f.code === "TYPE")!;
  expect(type.message).toBe("a % sigil is only legal on a numeric scalar");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/visimark/test/eval/check.test.ts -t "anchor refuses"`
Run: `bun test packages/visimark/test/eval/check.test.ts -t "bare prose in front of a string anchor"`
Run: `bun test packages/visimark/test/eval/check.test.ts -t "bare non-date"`
Expected: FAIL on each. Today, `check(build(locate(src)))` for the numeric case reports `STALE   s.b   to ≠ 0.25` instead of `ANCHOR`; for the date and string cases it reports `0 problems`.

- [ ] **Step 3: Add the `parseIsoDate` import**

In `packages/visimark/src/eval/check.ts`, add to the existing import block (near the other `./` imports, alongside where `parseDecorated` is imported):

```typescript
import { parseIsoDate } from "./dates.js";
```

- [ ] **Step 4: Declare `refusedAnchors`**

In `packages/visimark/src/eval/check.ts`, inside `export function check(...)`, right after the existing line `const emit = st.emit;` (around line 116), add:

```typescript
  // anchors this pass refuses as a rewrite target — keyed by the comment's
  // own source offset, which is unique per anchor. Consulted by the numeric
  // STALE loop in evalScalar below so a refused span is reported ANCHOR
  // only, never STALE too.
  const refusedAnchors = new Set<number>();
```

- [ ] **Step 5: Insert the type-aware acceptance check**

In `evalScalar` (same file), insert the following block immediately after the `if (v0.t === "bool") { ... return; }` block closes (right before the existing line `const anchorText = anchorValueText(model, binding.id);`):

```typescript
      for (const a of valueAnchorsOf(model, binding.id)) {
        if (a.value!.kind !== "text") continue;
        const text = model.source.slice(a.value!.start, a.value!.end);
        if (v0.t === "num") {
          if (parseDecorated(text).kind === "number") continue;
          refusedAnchors.add(a.commentSpan.start);
          emit(
            {
              code: "ANCHOR",
              sheetId: binding.sheetId,
              name: binding.name,
              sourceOffset: a.commentSpan.start,
              span: a.commentSpan,
              message:
                "no number to rewrite in front of this anchor — wrap a placeholder instead, such as **0** or **_**",
            },
            { sheetId: binding.sheetId },
          );
        } else if (v0.t === "date") {
          if (parseIsoDate(text).ok) continue;
          refusedAnchors.add(a.commentSpan.start);
          emit(
            {
              code: "ANCHOR",
              sheetId: binding.sheetId,
              name: binding.name,
              sourceOffset: a.commentSpan.start,
              span: a.commentSpan,
              message:
                "no date to rewrite in front of this anchor — wrap a placeholder instead, such as **2026-01-01** or **_**",
            },
            { sheetId: binding.sheetId },
          );
        } else {
          refusedAnchors.add(a.commentSpan.start);
          emit(
            {
              code: "ANCHOR",
              sheetId: binding.sheetId,
              name: binding.name,
              sourceOffset: a.commentSpan.start,
              span: a.commentSpan,
              message:
                "a string anchor cannot rewrite bare prose — wrap a placeholder instead, such as **_**",
            },
            { sheetId: binding.sheetId },
          );
        }
      }
```

This runs for every binding type, inside the same `try` block as the rest of `evalScalar`, so an upstream `Unevaluable` throw (an unresolved name, a cycle, etc.) skips it exactly the way it already skips everything below — satisfying the Review Focus suppression case without any extra code.

- [ ] **Step 6: Skip refused anchors in the existing numeric `STALE` loop**

In the same file, find the existing loop (currently reading, unindented for the diff):

```typescript
        for (const a of mine) {
          const text = model.source.slice(a.value!.start, a.value!.end);
          if (matchesStored(v, text, prec)) continue;
```

Change its first line to:

```typescript
        for (const a of mine) {
          if (refusedAnchors.has(a.commentSpan.start)) continue;
          const text = model.source.slice(a.value!.start, a.value!.end);
          if (matchesStored(v, text, prec)) continue;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun test packages/visimark/test/eval/check.test.ts`
Expected: PASS, all tests in the file including the new ones from Step 1 and Task 1's test.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `bun test && bun run typecheck`
Expected: PASS. (`parseIsoDate`'s `IsoResult` return type is a discriminated union on `ok`; `.ok` narrows correctly with no cast needed.)

- [ ] **Step 9: Commit**

```bash
git add packages/visimark/src/eval/check.ts packages/visimark/test/eval/check.test.ts
git commit -m "feat: refuse a bare anchor placeholder that doesn't denote a value of its own type

<Co-Authored-By trailer per .agents/rules/ai-attribution.md>"
```

---

### Task 3: End-to-end acceptance fixture and CLI tests

**Files:**
- Create: `packages/visimark/test/fixtures/anchor-placeholder-acceptance.md`
- Modify: `packages/visimark/test/cli/cli.test.ts`

**Interfaces:**
- Consumes: `runCli` and `capture` helpers already used throughout `cli.test.ts` (see the existing `percentFixture` tests, e.g. around line 279-320, for the exact calling convention).
- Produces: nothing new — this task only adds tests and a fixture, exercising Task 1 and Task 2's behavior through the actual CLI.

- [ ] **Step 1: Create the fixture**

Write `packages/visimark/test/fixtures/anchor-placeholder-acceptance.md`:

````markdown
Order total: **110.00**<!--vmark=s.order-->.
It comes to <!--vmark=s.bad--> PLN.
Due by 2026-01-15<!--vmark=s.due-->.
Due sometime soon<!--vmark=s.due_bad-->.
Status: **all clear**<!--vmark=s.status-->.
The status is no problem<!--vmark=s.status_bad--> today.
Seed: **_**<!--vmark=s.seed-->.
Claim: **a **bold** claim**<!--vmark=s.embed-->.

```vmark #s
order precision 2 = 110.00
bad precision 2 = 0.25
due = 2026-01-15
due_bad = 2026-02-01
status = "all clear"
status_bad = "all clear"
seed precision 2 = 7
embed = "a bold claim"
```
````

- [ ] **Step 2: Write the acceptance tests**

(These exercise behavior Task 1 and Task 2 already implemented, so they are
expected to pass, not fail — this task pins the end-to-end CLI contract
rather than driving new implementation.)

Add to `packages/visimark/test/cli/cli.test.ts`, near the existing `percentFixture` block:

```typescript
const anchorAcceptanceFixture = fileURLToPath(
  new URL("../fixtures/anchor-placeholder-acceptance.md", import.meta.url),
);

test("check reports the four ANCHOR refusals and the one STALE seed on the anchor-acceptance fixture", async () => {
  const c = capture();
  expect(await runCli(["check", anchorAcceptanceFixture], c.io)).toBe(1);
  const out = c.out();
  expect(out).toContain(
    "no number to rewrite in front of this anchor — wrap a placeholder instead, such as **0** or **_**",
  );
  expect(out).toContain(
    "no date to rewrite in front of this anchor — wrap a placeholder instead, such as **2026-01-01** or **_**",
  );
  expect(out).toContain(
    "a string anchor cannot rewrite bare prose — wrap a placeholder instead, such as **_**",
  );
  expect(out).toContain("no value to rewrite in front of this anchor");
  expect(out).toContain("_ ≠ 7.00");
  expect(out).toContain("6 problems (2 stale, 4 errors)");
});

test("fmt on the anchor-acceptance fixture rewrites only the seeded span and leaves every ANCHOR span untouched", async () => {
  const src = readFileSync(anchorAcceptanceFixture, "utf8");
  const dir = mkdtempSync(join(tmpdir(), "vm-anchor-"));
  const path = join(dir, "a.md");
  writeFileSync(path, src);
  const fmt1 = capture();
  expect(await runCli(["fmt", path], fmt1.io)).toBe(0);
  const rewritten = readFileSync(path, "utf8");
  expect(rewritten).toContain("**7.00**<!--vmark=s.seed-->");
  expect(rewritten).toContain("It comes to <!--vmark=s.bad--> PLN.");
  expect(rewritten).toContain("Due sometime soon<!--vmark=s.due_bad-->.");
  expect(rewritten).toContain("The status is no problem<!--vmark=s.status_bad--> today.");
  expect(rewritten).toContain("Claim: **a **bold** claim**<!--vmark=s.embed-->.");
  expect(fmt1.out()).toContain("updated 1 anchor");
  // fmt never writes an ANCHOR-refused span, so the only edit across the
  // whole fixture is s.seed's — the second fmt is therefore a true no-op.
  const fmt2 = capture();
  expect(await runCli(["fmt", path], fmt2.io)).toBe(0);
  expect(fmt2.out()).toContain("unchanged");
});
```

Confirm the exact `fmt1.out()` wording (`"updated 1 anchor"`) against the real CLI in Step 4 below once Task 1/2 are merged, and correct it if the implementation phrases the count differently — the assertion's substance (one span changes, everything else is a no-op) is what matters.

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test packages/visimark/test/cli/cli.test.ts -t "anchor-acceptance"`
Expected: PASS on the `check` test, since Task 1/2 already landed by this point in the plan; the value of running it here is to confirm the assertions match reality before committing, adjusting `fmt1.out()`'s exact wording per the note above if needed.

- [ ] **Step 4: Run the fixture through the CLI directly to pin the exact wording**

Run: `bun run packages/visimark/src/cli/main.ts check packages/visimark/test/fixtures/anchor-placeholder-acceptance.md`
Run: `bun run packages/visimark/src/cli/main.ts fmt packages/visimark/test/fixtures/anchor-placeholder-acceptance.md` (on a scratch copy, not the committed fixture)

Use the real output to finalize the exact assertions in Step 2 — the spec (§6) states the expected session, but confirm it against the actual implementation from Task 1/2 rather than trusting the spec's prose verbatim, since a message or a count could differ by one character in practice.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/visimark/test/cli/cli.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/visimark/test/fixtures/anchor-placeholder-acceptance.md packages/visimark/test/cli/cli.test.ts
git commit -m "test: end-to-end acceptance fixture for type-aware anchor placeholders

<Co-Authored-By trailer per .agents/rules/ai-attribution.md>"
```

---

### Task 4: Documentation

**Files:**
- Modify: `docs/visimark-design.md` (§3 Document model, §10 Error taxonomy)
- Modify: `docs/tutorial.md` (ch. 9, "Always give an anchor a placeholder")
- Modify: `CHANGELOG.md`
- Modify: `docs/vocabulary-catalogue.md` (move the #298 row from section E into the Shipped register as `UNRELEASED`)

**Interfaces:**
- Consumes: nothing — pure documentation, no code interface.
- Produces: nothing — this is the plan's required final task per `docs/issue-runbook.md`'s front-loading rule; a merged implementation PR with no `## Unreleased` `CHANGELOG.md` line is a bug in the plan.

- [ ] **Step 1: Amend `docs/visimark-design.md` §3**

Find this paragraph (currently the third-to-last paragraph of §3, right after the `%` anchor paragraph and its example, ending "...HTML comments are invisible in every target renderer, so the sentence reads normally."):

```
The anchor rewrites the text content of the inline node immediately preceding
it. That node must be `strong`, `emphasis`, `inlineCode`, or a text node; anything
else is an `ANCHOR` error. An anchor with nothing in front of it is legal authoring syntax — `fmt` seeds it — and a bare text node need not show a
number, because a scalar's width comes from its binding rather than from its
anchor ([§7](#7-numeric-semantics)). A string-valued scalar can therefore be
materialised in prose at all, which the old numeric requirement prevented.
HTML comments are invisible in every target renderer, so the sentence reads
normally.
```

Replace it with:

```
The anchor rewrites the text content of the inline node immediately preceding
it. That node must be `strong`, `emphasis`, `inlineCode`, or a text node;
anything else is an `ANCHOR` error. A delimited node (`strong`, `emphasis`,
`inlineCode`) is accepted regardless of its content — `**0**`, `**hello**`,
and `**_**` are equally valid seeds, because the wrapping itself is the
explicit "this is the anchor's target" signal — provided a `strong` or
`emphasis` node wraps exactly one plain text child; one that doesn't (a
literal `**` inside a `**`-wrapped value, producing nested emphasis) is
`ANCHOR`, not a silently mis-scoped span. A bare, unwrapped text node is held
to a narrower rule: its trailing whitespace-delimited token must itself
unambiguously denote a value of the anchor's own resolved type — numeric or
strict-ISO-date shaped for a numeric or date anchor, and never accepted at
all for a string anchor, since bare prose cannot unambiguously denote an
arbitrary string. Anything else bare in front of an anchor is `ANCHOR`, not a
silently claimed placeholder. An anchor with nothing in front of it is legal
authoring syntax — `fmt` seeds it. A string-valued scalar can therefore be
materialised in prose, via a delimited node, which the old numeric
requirement prevented. HTML comments are invisible in every target renderer,
so the sentence reads normally.
```

- [ ] **Step 2: Amend `docs/visimark-design.md` §10**

Find this sentence in the `STALE`/`ANCHOR` widening paragraph:

```
`STALE` is widened once more: an anchor whose rendered text disagrees with its
scalar's width is `STALE` rather than a conflict, which is what makes `686.0000`
and a bare `0` converge on one rendering under `fmt`. `ANCHOR` narrows to match
— a bare text node no longer has to end in a number ([§3](#3-document-model)).
```

Append one sentence directly after it:

```
`ANCHOR` widens again here: a bare text node's trailing token must once more
denote a value of the anchor's own resolved type — though a type-aware one,
not strictly numeric as before, and never satisfiable by bare prose for a
string anchor. A delimited node keeps its own exemption from this
requirement, gaining instead the narrower requirement that it wrap exactly
one plain text child ([§3](#3-document-model)).
```

- [ ] **Step 3: Rewrite `docs/tutorial.md` ch. 9**

Find this section (currently titled "### Always give an anchor a placeholder"):

```
### Always give an anchor a placeholder

The anchor rewrites the element directly in front of it. With `**0**` in front,
that element is the bold text, which is what you want. With plain prose in
front, it is the last word of that prose:

```console
$ tail -1 seed.md
Net of tax it comes to <!--vmark=order.net_total-->  PLN.
$ visimark fmt seed.md
seed.md: updated 1 anchor
$ tail -1 seed.md
Net of tax it comes 158.00 <!--vmark=order.net_total--> PLN.
```

The word `to` was replaced by the number. So write a placeholder, and make it
bold: `**0**<!--vmark=order.net_total-->`. The placeholder's digits do not
matter. What `fmt` never does is *invent* an anchor — you decide where a value
appears in your prose.
```

Replace it with:

```
### Always give an anchor a placeholder

The anchor rewrites the element directly in front of it. With `**0**` in
front, that element is the bold text, which is what you want. A bare,
unwrapped word only counts as a placeholder when it already looks like a
value of the anchor's own type — a numeric anchor accepts a bare
numeric-shaped token, a date anchor accepts a bare ISO-shaped token, and a
string anchor never accepts bare prose at all. Anything else bare in front of
an anchor refuses instead of guessing:

```console
$ tail -1 seed.md
Net of tax it comes to <!--vmark=order.net_total-->  PLN.
$ visimark check seed.md
  ANCHOR  order.net_total   no number to rewrite in front of this anchor — wrap a placeholder instead, such as **0** or **_**
$ visimark fmt seed.md
seed.md: unchanged
```

`fmt` leaves the word `to` alone — it is not a number, so it does not qualify
as a placeholder, and `fmt` never writes what it doesn't own. Wrap a
placeholder instead, and make it bold: `**0**<!--vmark=order.net_total-->` or
`**_**<!--vmark=order.net_total-->`. `_` is the recommended seed when the
value has no natural placeholder of its own — it reads as "fill me in"
without implying a specific number. The placeholder's content does not
matter, digits or `_` alike: it is replaced at the binding's own width. What
`fmt` never does is *invent* an anchor — you decide where a value appears in
your prose.
```

Verify the `$ visimark check seed.md` line's exact output against the real CLI once Task 2 is merged (the `order.net_total` name and sheet id are illustrative of this chapter's running example — confirm they match whatever binding name chapter 9 actually uses at this point in the tutorial, and adjust if it differs).

- [ ] **Step 4: Add the `CHANGELOG.md` entry**

Add under `## Unreleased` → `### Added` (create the `### Added` subheading if `## Unreleased` currently only has `### Changed`):

```markdown
### Added

- **A bare, unwrapped word in front of an anchor comment is no longer
  silently claimed as its rewrite target.** `fmt` used to overwrite whatever
  word happened to sit in front of an anchor, deleting it — and `check` never
  verified a string- or date-anchored value against its surrounding prose at
  all. Both now require the bare token to already denote a value of the
  anchor's own type (numeric, ISO date, or — never, since bare prose is
  always ambiguous — string); anything else refuses with `ANCHOR` instead. A
  delimited placeholder (`**0**`, `` `0` ``) is unaffected, and `**_**` is now
  the documented convention for an explicit seed. See
  [#298](https://github.com/michal-niedzwiedzki/visimark/issues/298).
```

- [ ] **Step 5: Move the catalogue row to the Shipped register**

In `docs/vocabulary-catalogue.md`, find the section E row (`| Type-aware anchor placeholder acceptance (\`ANCHOR\`) | ... | [#298](...) | [APPROVED](...) |`) and delete it from the section E table.

Add a new row to the `## Shipped` table (`| Name | Kind | Request | Landed | Released | Decision |`), immediately after the table's header/most-recent row, in this exact form:

```
| Type-aware anchor placeholder acceptance | language feature | [#298](https://github.com/michal-niedzwiedzki/visimark/issues/298) | [#300](https://github.com/michal-niedzwiedzki/visimark/pull/300) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/298#issuecomment-5886082114) |
```

(`Released` stays `—` until a tagged release ships it — `docs/releasing.md` fills that cell and closes issue #298 at release time. Do not promote this row to `SHIPPED` here.)

- [ ] **Step 6: Run the full check suite against the protected example documents**

Run: `bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md`
Expected: `0 problems`.

Run: `bun run packages/visimark/src/cli/main.ts check docs/playground/tutorial/03-sheets.md`
Expected: `0 problems`.

Run: `bun test && bun run typecheck && bun run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/visimark-design.md docs/tutorial.md CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "docs: type-aware anchor placeholder acceptance

Updates visimark-design.md §3/§10, tutorial.md ch. 9, CHANGELOG.md, and
moves the #298 catalogue row to the Shipped register as UNRELEASED.

<Co-Authored-By trailer per .agents/rules/ai-attribution.md>"
```
