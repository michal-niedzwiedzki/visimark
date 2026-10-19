# visimark-investigate

The one investigation core behind `bun run repo:investigate` and the
homepage's "Scan your repo" widget. It takes a repository's files as text,
with the VisiMark engine passed in as an argument, and returns a versioned
**Report**: the numbers that are provably wrong, the ones worth a look, how
ready the repository is to adopt VisiMark, and its contribution posture. It
reads no file, opens no connection and imports no engine code, so the CLI and
the browser run exactly the same judgement over the same input.

Private and unversioned: `scripts/` and `site/` use it from source. The
design is [`one-investigation-core-behind-repo-spec.md`](../../docs/design/one-investigation-core-behind-repo-spec.md).

## Using it

```ts
import { importTargets, investigate, selectFiles, summaryLines, findingLines } from "visimark-investigate";

const { markdown, skipped } = selectFiles(paths); // decide what to read first
// read `markdown`, then the files `importTargets(texts, engine)` names
const report = investigate({ repo, engineVersion, paths, texts, skipped, workflowTexts, clonePath }, engine);
```

`engine` is anything with the engine's `locate`, `build`, `check`, `infer`,
`isProblem`, `memoryReader` and `describeFinding`: the CLI passes
`packages/visimark/src/browser.ts`, the widget passes `window.VisiMark`.

## Rules

A rule is one file under `src/rules/`:

```ts
interface Rule {
  id: string; // "total-row"
  label: string; // "sum check", the "found by" tag
  scope: "file" | "repo";
  run(doc: DocInput, ctx: RuleContext): RuleResult;
}
```

`run` returns its findings, the tables it verified a relation in (`checked`),
and the counts the adoption axis reads. Heuristic rules read `doc.masked`, a
copy with code, comments, front matter and blockquotes blanked out at the same
offsets; engine rules read `doc.text`.

To add a rule:

1. Write `src/rules/<id>.ts`.
2. Add it to `RULES` in `src/rules/registry.ts`, whose order is the order
   merged findings list their rules.
3. Add `test/fixtures/rules/<id>/` with `good.md` (no finding), `bad.md`, and
   `bad.expected.json` (the Findings `bad.md` gives). `test/registry.test.ts`
   fails a rule without them, and `test/fix-property.test.ts` checks that
   applying each finding's `fix` removes it.

The four rules today are `total-row`, `line-product`, `engine-check` and
`engine-infer`.

## The Report

`version: 1`. Within a version, changes are additive only. The full shape is
in `src/types.ts` and in the spec's
[§3.3](../../docs/design/one-investigation-core-behind-repo-spec.md#33-the-report-version-1).
A finding's `id` names the cell by content (`docs/budget.md#t1/Cost/Total`),
so it survives edits elsewhere in the file. Its optional `fix` is a list of
offset edits that carry the text they replace.

<!--vmark:no-formulas-->
