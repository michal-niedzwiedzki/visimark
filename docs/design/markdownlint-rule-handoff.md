# Handoff — `markdownlint-rule-visimark` (#153)

**Working note, not a design document.** It exists so the next agent can pick
up #153 without re-deriving anything. Delete it in the same commit that lands
the implementation — [`markdownlint-rule-spec.md`](markdownlint-rule-spec.md)
is the durable record, this file is not.

## Where things stand

| Thing | State |
|---|---|
| Issue [#153](https://github.com/michal-niedzwiedzki/visimark/issues/153) | **Open**, APPROVED. Closes automatically when a tagged release ships it. |
| [Deciding comment](https://github.com/michal-niedzwiedzki/visimark/issues/153#issuecomment-5782250622) | Posted |
| Catalogue PR [#155](https://github.com/michal-niedzwiedzki/visimark/pull/155) | **Merged** (`4a4a6c2`). Section F row is APPROVED with decided Pros/Cons. |
| Spec PR [#164](https://github.com/michal-niedzwiedzki/visimark/pull/164) | **Open, draft**, branch `issue/153-markdownlint-rule-impl` |
| [`docs/design/markdownlint-rule-spec.md`](markdownlint-rule-spec.md) | Committed. **Open questions: None.** |
| Implementation plan | **Not written.** This is the next step. |
| Code | **Not written.** |

Everything below is already settled in the spec. Read the spec first; this file
adds only what the spec deliberately leaves out — the working prototype, the
API traps, and the repo conventions the plan has to respect.

## What to do next

1. Write the plan to `docs/design/markdownlint-rule-plan.md` using
   `superpowers:writing-plans` (house format: `Goal`, `Architecture`,
   `Tech Stack`, a `Spec:` link, `Global Constraints`, then checkbox `Task`
   sections with `Files`, `Interfaces`, `Step`s). Model it on
   [`remark-plugin-plan.md`](remark-plugin-plan.md) — the sibling, and the
   closest precedent for every non-obvious step.
2. Execute it with `superpowers:executing-plans` on this branch.
3. Promote PR #164 out of draft only when CI is green.

**Global Constraints must point at
[`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for
the commit trailer, not paste a vendor name.** The trailer is resolved per
session; the commits already on this branch say `Claude Opus 5` because that is
who wrote them, which is not a reason to stamp the same line on yours.

## The working prototype

This is real, runs, and produced every literal output in the spec's §4. It is
the whole rule — the shipped `src/index.ts` should be recognisably this, in
TypeScript, importing from `visimark` rather than a path.

```js
import { analyze, describeFinding, lineOf } from "visimark";

const CODES = ["STALE","DATE","UNIT","UNDEF","DUP","VECTOR","CYCLE","TYPE","SHEET",
  "ANCHOR","ASSERT","PRECISION","ARTIFACT","IMPORT","WARN","NOTE","COVERAGE"];
const ADVISORY = new Set(["WARN", "NOTE"]);
const INFO = new URL("https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/visimark-design.md#10-error-taxonomy");

// One entry is enough: markdownlint runs a file's rules consecutively in one
// synchronous pass, so the first rule fills this and the other sixteen hit it.
let memo;
function findingsFor(source) {
  if (!memo || memo.source !== source) {
    memo = { source, findings: analyze(source).result.findings };
  }
  return memo.findings;
}

export default CODES.map((code) => ({
  names: [`visimark-${code.toLowerCase()}`],
  description: DESCRIPTIONS[code],            // spec §2.5
  tags: ADVISORY.has(code) ? ["visimark", "visimark-advisory"] : ["visimark"],
  parser: "none",
  information: INFO,
  function: (params, onError) => {
    const source = params.lines.join("\n");
    for (const f of findingsFor(source)) {
      if (f.code !== code || f.anchorGroup) continue;
      onError({
        lineNumber: f.span ? lineOf(source, f.span.start) : 1,
        detail: describeFinding(f),
      });
    }
  },
}));
```

Plus `recommended.json`, two lines:

```json
{ "visimark-advisory": false }
```

## Traps, each one hit for real

- **`information` must be a `URL` instance.** A string throws inside
  `markdownlint` v0.41.1's rule validation and takes the whole run down. Not
  obvious from the docs, which say "optional (absolute) `URL`".
- **`extends` goes inside `config`**, not at the top level of
  `.markdownlint-cli2.jsonc`. It is a `markdownlint` config property, not a
  `markdownlint-cli2` one. This is the single easiest thing for a consumer to
  get wrong, which is why the spec asks for it to be *shown* in `docs/ci.md`
  and the package README rather than described.
- **Do not touch front matter.** `markdownlint` strips it from `params.lines`
  and adds `frontMatterLines.length` back to every reported `lineNumber`
  itself. Adding an offset here double-counts it. Verified in
  `markdownlint/lib/markdownlint.mjs` and by running it.
- **`"default": false` disables custom rules too.** If a test config uses it,
  the rules must be re-enabled by name or tag or the test silently passes with
  zero violations — which is how the first prototype run looked green while
  doing nothing. Prefer `"default": true` in tests, or assert a non-zero count.
- **`bunx visimark` runs the *published* package, not this branch.** Use
  `bun run packages/visimark/src/cli/main.ts` for any local check.

## Verified environment

`markdownlint-cli2` v0.23.3, `markdownlint` v0.41.1, bun 1.4.2. `npm` is not on
`PATH` in this workspace — use `bun pm view` / `bun add`.

## Things the plan must not forget

Taken from the spec's §7, listed here because they are the steps most likely to
be dropped:

- **`docs/ci.md` renumbering.** The new chapter is **25**, inserted after
  chapter 24 ("The `remark`/`unified` plugin") and **before** the
  `# Part 7 — Rolling it out` divider — so it lands inside Part 6 and the Part 7
  boundary does not move. Existing 25→26, 26→27, 27→28. Confirmed against the
  working tree: the only external reference to a `ci.md` chapter number is
  `README.md:329`'s link to chapter 24, which is unaffected.
  `docs/tutorial.md`'s "chapter 24/26/27" mentions are that document's own,
  independent numbering.
- **`docs/visimark-design.md` §10 gains a `COVERAGE` row.** Pre-existing gap —
  the engine has always emitted `COVERAGE` and the taxonomy table has never
  listed it. `docs/visimark-design.md` **is** in the dogfood check's file list,
  so this edit is CI-visible; the spec file itself is not.
- **`ci.yml`'s version-agreement step** gains the eighth and ninth values
  (the new `package.json`'s `version` and its `dependencies.visimark` pin).
  Copy the `remark_version` / `remark_dep` lines and the `for pair in` entry.
- **`release.yml`** gains a publish leg *and* two easily-missed follow-ons: an
  entry in the gate's leg-outcome loop (around line 280) and one in the
  registry-presence retry.
- **`docs/releasing.md`** "Bump the version" file list.
- **`CHANGELOG.md`** under `## Unreleased` → `### Added`. A merged
  implementation PR with no `Unreleased` line is a bug in the plan.
- **No `editors/vscode/CHANGELOG.md` entry** — the LSP and extension surfaces
  do not change.
- **`docs/vocabulary-catalogue.md`** — move the section F row into the Shipped
  register as `UNRELEASED`, condensed to that table's six columns, **Landed**
  linking PR #164, **Released** `—`. Do not promote it to `SHIPPED` and do not
  close #153; the release workflow does both.

## Open risk

None blocking. The one judgement call worth knowing you can revisit: the spec
reports span-less findings at **line 1** so a document-scope `COVERAGE` is not
silently dropped, which is a deliberate divergence from `remark-lint-visimark`,
where vfile permits a message with no position at all. If that proves wrong in
practice, it is a one-line change here and a separate issue for #152's side —
not a reason to reopen this spec.
