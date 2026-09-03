# Handoff — line numbers in `visimark check`

**Design (normative):** `docs/superpowers/specs/2026-09-03-check-line-numbers-design.md`

Read it first. It is short, and it settles the two questions that would
otherwise get relitigated mid-implementation: why a gutter rather than
`file:line:`, and why there is no flag.

## Where things stand

Nothing is implemented. The design is approved.

The engine is green — 224 tests, both worked examples passing as the acceptance
suite — and everything is committed and merged to `master`. The editor plugins
shipped, along with the function table, the removal of boolean literals, and
the fix that made `bin/visimark.js` runnable. Branch from `master`.

## The invariant that changes

The rule that governs every change to the engine:

> If the transcript test fails, the change is wrong — do not edit the example
> documents.

**This change is the one sanctioned exception.** The transcript inside
`doc/example-invoice-drift.md` is check output *of that same file*, so adding a
gutter necessarily rewrites it. Regenerate the fenced `console` block; do not
weaken the tests that pin it.

Two further invariants stay in force throughout: offsets are UTF-16 code units,
never bytes; and a green `check` is not evidence of anything, because it reports
`0 problems` on a document containing no formulas at all. When verifying by
hand, change an input and confirm the checker starts complaining.

## Order of work

TDD throughout; the design's Testing section is the list.

1. `src/report/lines.ts` — `lineStarts` / `lineAt`. Pure, easy to test, no
   dependencies. Start here.
2. `formatCheck` grows a required third parameter, `source`, and applies the
   gutter per the design's seven rendering rules. The existing unit tests in
   `test/report/format.test.ts` use span-less synthetic findings, so rule 1
   (`W = 0` → no gutter) should keep them byte-identical. If they move, the
   rule is implemented wrong.
3. The four callers: `cmdCheck`, `cmdFmt`, `extension.ts`, and the three test
   files. `cmdFmt` passes the **pre-fmt** source — see the design's subtlety
   section, and add the fmt-preserves-line-count test that guards it.
4. Regenerate the transcript, last, once the output is final:

   ```bash
   bun packages/visimark/src/cli/main.ts check doc/example-invoice-drift.md
   ```

   Paste the output into the `console` block in that file, replacing everything
   between the `$ visimark check doc/example-invoice-drift.md` line and the
   closing fence. The path argument must be exactly that, because the report
   echoes it as its header line.

5. `bun test`, `bun run typecheck`, both green.

## Three things that will bite

1. **`cmdFmt` reports against the source it checked, not the file it wrote.**
   The `unfixable` findings' spans are offsets into the pre-fmt text. They stay
   valid for the written file only because `fmt` never adds or removes a
   newline. Test that invariant rather than trusting it.

2. **`formatCheck` is public API.** It is exported from `src/index.ts` and the
   VS Code extension calls it for Show Report. Update
   `editors/vscode/src/extension.ts` in the same commit, and run
   `bun run typecheck` at the root — the extension is a separate workspace and
   the package build will not catch it.

3. **Do not give the two span-less findings a line.** The collapsed anchor-group
   `STALE` and the `NOTE` are aggregates over findings that already carry their
   own lines. Blank gutter. Reaching for `binding.span` to fill them in produces
   a number that points somewhere misleading.

## Verification

Beyond the suite: change an input in `doc/example-invoice.md`, run `check`, and
confirm the reported line is the line you edited. A green check proves nothing
on its own.
