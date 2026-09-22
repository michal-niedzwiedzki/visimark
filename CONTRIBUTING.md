# Contributing to VisiMark

Thank you for looking. This file is what you need to get a change landed: how to
set the repository up, what to run before you push, what CI will check, and —
most importantly — which changes need a decision before you write any code.

Please read the first section before opening a pull request for anything that
changes the language, the file format, or the CLI's behaviour. It will save you
work.

## The design is deliberately small

VisiMark ships **thirteen functions and a fixed operator set**. That is not a
gap waiting to be filled. A document's numbers must depend on its own text and
the version of VisiMark reading it, and on nothing else — no locale, no clock,
no network, no config file, no plugins — because a number you cannot recompute
from the document is a number the tool cannot honestly check.

So "no" is a common answer here, and it is meant to be a *reasoned* one. Every
proposal and every decision is recorded in
[`docs/vocabulary-catalogue.md`](docs/vocabulary-catalogue.md), so the same
request is not argued twice and a refusal has a link you can read.

**Before proposing anything, search that catalogue.** Your idea may already be
in it, approved, deferred or rejected, with the reasoning attached.

### Which route your change takes

| What you want to change | Route |
|---|---|
| A new function, operator or aggregate | Open a [vocabulary request](https://github.com/michal-niedzwiedzki/visimark/issues/new?template=vocabulary-request.yml) first. One primitive per issue. |
| Syntax, semantics, the file format, write-back — anything that changes what a **document means** | Open a [language feature](https://github.com/michal-niedzwiedzki/visimark/issues/new?template=language-feature.yml) issue first, with a concrete proposal and a motivating document. |
| CLI options, exit codes, output formats — anything a **machine** downstream sees | Open a [tooling, CLI or process](https://github.com/michal-niedzwiedzki/visimark/issues/new?template=tooling-change.yml) issue, with the before and after sessions, exit codes included. |
| A bug — the tool does something it does not claim to do | Pull request, straight away. An issue is welcome but not required. |
| Documentation: a typo, a wrong statement, a missing explanation | Pull request, straight away. A larger change to the site, the playground, the tutorial or the examples goes on the [site, playground or docs](https://github.com/michal-niedzwiedzki/visimark/issues/new?template=site-docs.yml) form. |
| Editor support, the playground, CI, releasing, the repo's own machinery | Issue first if it changes behaviour — the [tooling, CLI or process](https://github.com/michal-niedzwiedzki/visimark/issues/new?template=tooling-change.yml) form; pull request straight away if it is a fix. |
| Positioning, prioritisation, an audience or an integration to chase | The [project direction](https://github.com/michal-niedzwiedzki/visimark/issues/new?template=direction.yml) form. It gets a comment, never a catalogue row. |

The journey from an issue to a decision is
[`docs/issue-runbook.md`](docs/issue-runbook.md). The short version: the
maintainer decides, the deciding comment is the reason, and an approved change
gets a written spec before anyone implements it.

### What a proposal is judged against

A vocabulary primitive has to clear five bars, set out in full in the
[catalogue preface](docs/vocabulary-catalogue.md#requesting-an-addition):

1. **It fits the shape system.** A map is scalar → scalar. A reduce is
   vector → scalar and takes a bare column reference, never an expression.
   There is no vector → vector.
2. **Its value is document-local.** Nothing ambient. A value that genuinely
   comes from outside belongs in an input column, where a human wrote it down.
3. **It adds no ambiguity.** Nothing a reader could read two ways.
4. **A real document needs it.** Paste the table and its `vmark` block into the
   issue. A primitive with no motivating document is deferred by default.
5. **Its precision behaviour is stated.** Say where the result's decimal width
   comes from, or say that it does not follow at all and a binding using it must
   declare `precision N`.

Anything else — a language feature, a format change, a tooling change — is
judged against the same design document: its
[purpose and non-goals](docs/visimark-design.md#1-purpose), its
[four constraints](docs/visimark-design.md#2-constraints-that-shaped-the-design)
and the no-plugin rule, and diffability. Criterion 4 applies to every class of
change, not only to vocabulary.

## Setting up

The repository is a Bun workspace. You need [Bun](https://bun.sh); the version
is pinned in `packageManager` in `package.json`, and matching it matters for one
CI check (see below).

```console
$ git clone https://github.com/michal-niedzwiedzki/visimark
$ cd visimark
$ bun install
```

`bun install` builds the CLI as a postinstall step and links it into
`node_modules/.bin`, so `bun run` sees a `visimark` built from your working
tree rather than the published package.

Then check that it works:

```console
$ bun test
$ bunx visimark check docs/example-invoice.md
```

Node is not needed to develop, but the published CLI must run under it, so CI
exercises that separately. VisiMark supports Node 18 and newer.

## The commands

| Command | What it does |
|---|---|
| `bun test` | The whole suite. It runs in a few seconds — there is no reason not to run it. |
| `bun run typecheck` | TypeScript, across every workspace |
| `bun run lint` | `oxlint`, with warnings treated as failures |
| `bun run format` | `oxfmt`, in place |
| `bun run format:check` | `oxfmt`, read-only — this is what CI runs |
| `bun run build` | Builds every package |
| `bun run gen:docs` | Regenerates the function reference from the engine's own registry |
| `bun run --filter visimark build:playground` | Rebuilds the browser bundles committed under `docs/vendor/` |
| `bun run serve` | Serves `docs/` on `http://localhost:8080` — needed for the playground and the tutorial pages, which fetch their content and cannot run from `file://` |
| `bun run vscode-install` | Builds, packages and installs the VS Code extension locally |

## Before you push

Run these, in this order. It is the same ground CI covers, and it is much faster
to find a problem here.

```console
$ bun run format
$ bun run lint
$ bun run typecheck
$ bun run build
$ bun test
```

If you touched anything a generated or committed artifact depends on, also run
the matching regeneration and **commit the result**:

```console
$ bun run gen:docs                              # if you changed a builtin function
$ bun run --filter visimark build:playground    # if you changed engine or playground source
```

If you touched any Markdown document in `docs/` or the repository's own prose,
check it the way the project's own CI does:

```console
$ bunx visimark check docs/your-file.md
```

## What CI checks, and how to fix each one

CI is [`ci.yml`](.github/workflows/ci.yml) and
[`dogfood.yml`](.github/workflows/dogfood.yml). Most jobs are the commands
above. These are the ones that surprise people, so they are worth knowing in
advance.

**The committed playground bundle must match the source.** `docs/vendor/` holds
built browser bundles, and GitHub Pages serves `docs/` verbatim with no build
step — so nothing else would notice them going stale. They did go stale once,
for two releases, and the deployed playground silently lacked three chart
engines the docs already described. Fix: run the `build:playground` command and
commit the diff. If the diff looks like pure minifier churn, your Bun does not
match `packageManager` in `package.json`.

**The generated function reference must match the registry.** `bun run gen:docs`
writes `docs/function-reference.md` and part of `docs/visimark-design.md` from
the engine's own function registry, so that what the documents promise and what
`visimark ref` prints cannot drift. Fix: run it and commit the result.

**Every version-carrying file must agree.** Four files carry the version — three
package manifests and `action.yml`'s pinned `version` default. One tag publishes
all of them, and the Action's default is what a consumer's `npx` actually
installs. You only touch these in a release commit; see
[`docs/releasing.md`](docs/releasing.md). The same commit needs a dated
`## X.Y.Z - YYYY-MM-DD` heading in `CHANGELOG.md` and in
`editors/vscode/CHANGELOG.md`; a separate CI step checks that each has one.

**The built CLI must run under Node, not only Bun.** A separate job builds with
Bun and then exercises `dist/` under Node against the worked examples, including
the drift invoice, which is required to *fail*. It also feeds the parser a
pathological deeply nested expression and requires a finding rather than a stack
overflow.

**A global install must work with only one runtime present.** Two smoke jobs
install the packed tarball in a Node-only runner and a Bun-only container. The
launcher has to work in both.

**The repository's own documents must pass `visimark check`.** See the next
section.

## The repository eats its own cooking

`dogfood.yml` runs the shipped GitHub Action against this repository's own
documents — the worked examples, the tutorial, the CI guide, the design doc, the
README and the changelog. If your pull request touches one of them and the
numbers in it stop agreeing with its formulas, the build goes red.

There are two findings you are likely to meet, and each has exactly one correct
response.

**`STALE` — a stored number disagrees with its formula.** Run
`bunx visimark fmt docs/your-file.md`, then read the diff. Those new numbers are
the consequence of your edit; make sure they are the consequence you intended.

**`COVERAGE` — the document has a table and no rules.** Either run
`bunx visimark infer docs/your-file.md` and read the proposal, or, if the
document genuinely has no arithmetic, put `<!--vmark:no-formulas-->` on its own
line at the end of the file — having actually read it first.

**Never edit a computed number by hand to make a build pass.** That is the exact
failure the whole project exists to catch. Change the input or change the rule,
then run `fmt`.

Two more documentation rules that matter here:

- **Every command transcript in the documentation is real.** Run the command,
  paste what it printed. Do not adjust the output to match the prose; adjust the
  prose. The transcripts are the project's strongest claim, and one invented
  line costs more than it saves.
- **A document that changes behaviour changes the design document too.**
  `docs/visimark-design.md` is normative. If your change makes it wrong, it is
  part of your change.

## Tests

Tests live next to what they test, in each package's `test/` directory, and run
under `bun test`.

**A bug fix comes with a test that fails before it.** Write the failing test
first, watch it fail for the reason you expect, then fix it. A test that passes
before your change does not test your change.

The worked examples double as the acceptance suite: `check` on the drift invoice
has to reproduce that document's own transcript, `fmt` has to leave the clean
invoice untouched, and `infer` on the plain quote has to reproduce the proposal
printed in its appendix. If you change engine behaviour, expect those to move —
and look hard at the diff when they do, because those documents are what the
README promises readers.

## When a language change lands

An approved primitive or language feature is not finished when the engine
passes its tests. These move together, in the same pull request:

- the engine, and its tests
- `bun run gen:docs` output, committed
- `docs/visimark-design.md` — the normative specification
- `docs/cli-reference.md`
- `CHANGELOG.md`, under `## Unreleased`
- the catalogue row, moved into the
  [Shipped register](docs/vocabulary-catalogue.md#shipped) as `UNRELEASED`
- `skills/visimark/SKILL.md`, if the change affects how an agent should author
  documents

## Commits and pull requests

**Commit subjects** are `type: a lowercase summary`, where the type is one of
`feat`, `fix`, `docs`, `refactor`, `chore`, `ci` or `skills`. Keep the subject
short and put the reasoning in the body. `git log --oneline` shows the house
style.

**Pull requests are squash-merged**, so the pull request title becomes the
commit subject on `master`. Write it accordingly.

**Explain why, not what.** The diff already says what changed. The body should
say what was wrong before, and why this is the right fix rather than a different
one.

**Never bypass a hook or a check** — no `--no-verify`, no skipping a red job. If
a check is wrong, fix the check in the same pull request and say so.

### If an AI assistant wrote part of it

That is fine, and it is normal in this repository. Credit it honestly:

- The commit **Author** stays you, the human sending the change.
- The assistant gets a `Co-Authored-By:` trailer naming the model that actually
  did the work — `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`,
  `Co-Authored-By: Grok 4.6 <grok@x.ai>`, and so on.

Do not copy a trailer out of an old commit, a plan or a command file: name the
model that wrote *this* change. The full rule is
[`.agents/rules/ai-attribution.md`](.agents/rules/ai-attribution.md).

The same standard applies to the content: an agent is reliable at writing
formulas and unreliable at arithmetic, so let `visimark fmt` compute every
number that follows from another number, and read the diff before you push it.

## Releases

Cutting a release is the maintainer's job and is tag-driven — pushing a
`vX.Y.Z` tag publishes the engine to npm and the extension to the VS Code
Marketplace and Open VSX. The checklist is
[`docs/releasing.md`](docs/releasing.md). Contributors do not bump versions;
put your entry under `## Unreleased` in `CHANGELOG.md` and leave the numbers
alone.

## Security

Do not open a public issue for a suspected vulnerability. Report it privately —
[`SECURITY.md`](SECURITY.md) has the two routes and what to include.

## Getting help

Open an issue and ask. A question about how something is meant to work is often
a documentation bug, and it is treated as one.

<!--vmark:no-formulas-->
