# Function reference — feature spec

**Status:** proposed · **Date:** 2026-09-16 · **Decision:** pending

## 1. Purpose

VisiMark has thirteen builtin functions. What is true about each of them is
currently recorded in three places that do not know about one another:

| Where | What it holds | Machine-readable |
|---|---|---|
| [`eval/functions.ts`](../../packages/visimark/src/eval/functions.ts) | `kind` and `arity` | yes |
| [`visimark-design.md` §4](../visimark-design.md#4-syntax) | the one-line `Meaning` column | no |
| [`docs/vocab/*-spec.md`](../vocab/) | semantics, type rules, errors, worked cases | no |

Three consequences follow. A reader hovering `EOMONTH` in an editor is told
nothing — [`hover.ts`](../../packages/visimark-lsp/src/hover.ts) answers for
bindings and table cells, and is silent on function names. An agent writing a
`vmark` block has no way to ask what a function does, so the
[skill](../../skills/visimark/SKILL.md) carries a hand-copied subset that drifts.
And the design doc's table is maintained by hand against a table in source that
nothing compares it to.

This spec adds one machine-readable reference registry, one exported query
function over it, and three consumers: the CLI, the language server, and a
build-time document generator.

This is a tooling / process change, catalogued in
[`vocabulary-catalogue.md`](../vocabulary-catalogue.md) **section F**. It changes
no document syntax, no evaluation, no finding set, and no write-back.

## 2. What this is not

**Not derived from [`docs/vocab/*-spec.md`](../vocab/).** Those are decision
records: why a function exists, what was argued, what was rejected. They are
frozen when the issue closes. The reference answers "what does it do" and
changes whenever behaviour does. The two rot on different clocks, and deriving
one from the other would force the frozen document to be edited every time the
live one moved. They stay separate, and neither is generated from the other.

**No free-prose "caveats" or "unexpected behaviours" field.** A field for
surprises is somewhere to put a wart instead of fixing it. Everything that
would have gone there is stated as a typed `error` or as an executable
`example`, both of which CI checks. A behaviour that can be expressed as
neither is a design bug, and belongs in an issue.

**Not a docs format.** No localisation, no user-defined functions, no reference
entries for operators. Operators may follow later; nothing here forecloses it.

## 3. The registry

`eval/functions.ts` stays as it is: `kind` and `arity`, the table the evaluator,
the dependency walk and the reporter turn on. The engine must not depend on
prose.

Documentation lives beside it in a new `src/lang/reference.ts`:

```ts
export interface FnParam {
  name: string;
  type: "number" | "date" | "bool" | "string" | "column";
  note: string;
}

export interface FnError {
  /**
   * The offending thing, as a **noun phrase** — "a negative operand", "an
   * empty column", "a non-whole `months`". Never a sentence: this string is
   * rendered into `{when} is a {code} error` for the design-doc table
   * (section 7), and into `{when} -> {code}` for `visimark ref`. A clause
   * reads correctly in neither.
   */
  when: string;
  /** the finding code it produces */
  code: FindingCode;
}

export interface FnExample {
  /** an expression in the language */
  expr: string;
  /** the value it evaluates to, rendered as the engine renders it */
  is: string;
  /** vmark source establishing any column the expression references */
  given?: string;
}

export interface FnDoc {
  /** one line; this is the `Meaning` column of the design-doc table */
  summary: string;
  /** exactly `arity` entries — see section 3.1 */
  params: readonly FnParam[];
  returns: string;
  /** only where the function has rounding behaviour of its own */
  precision?: string;
  errors: readonly FnError[];
  examples: readonly FnExample[];
  /** related function names, for "see also" */
  see?: readonly string[];
}
```

### 3.1 Keeping the two tables in step

Existence is enforced by the type system; arity agreement is enforced by a test.

For the compiler to know the set of function names, `FUNCTIONS` must be built
from a `const` object literal rather than written directly as a `Map`. The
exported value keeps its current `ReadonlyMap<string, FnSpec>` type, so every
existing consumer is untouched:

```ts
const TABLE = { SUM: { kind: "reduce", arity: 1 }, /* ... */ } as const;
export type FunctionName = keyof typeof TABLE;
export const FUNCTIONS: ReadonlyMap<string, FnSpec> = new Map(Object.entries(TABLE));
```

`reference.ts` then declares `Record<FunctionName, FnDoc>`, and adding a
function without documenting it fails `typecheck`.

`params.length === arity` is not expressible this way without type-level
arithmetic that would cost more than it returns. A unit test asserts it for
every entry, along with: every `code` is a real finding code, every function
has at least one example, and no `see` entry names an unknown function.

### 3.2 Examples are executed

Every `FnExample` runs against the evaluator in CI. The harness synthesises a
document from `given` (when present) followed by a binding of `expr`, evaluates
it, and compares the rendered value to `is`.

A map function needs no fixture — `EOMONTH(2026-01-31, 1)` stands alone. A
reduce needs a column, so its examples carry a `given` establishing a small
table. An example that stops being true fails the build, which is the whole
reason the field is preferred to prose.

## 4. The query API

```ts
export function describeFunction(name: string): (FnDoc & FnSpec) | null;
export function functionNames(): readonly string[];
```

Exported from the `visimark` package, alongside `dependencies` and `refText`,
and added to the `api` object that
[`browser-entry.ts`](../../packages/visimark/src/playground/browser-entry.ts)
assigns to `window.VisiMark`.

**Every consumer imports this; none of them shells out to the CLI.**
[`hover.ts`](../../packages/visimark-lsp/src/hover.ts) already imports from
`visimark`. A subprocess per hover would be slow, would have to locate a
binary, and would not work in the browser at all.

Four consumers: `visimark ref` (section 5), the playground (section 5.1),
hover (section 6), and the generator (section 7).

## 5. CLI: `visimark ref`

A new command, thin over `describeFunction`. It is not part of `explain`, which
is firmly about a document.

| Command | What it does | Reads | Writes | Fails the run when |
|---|---|---|---|---|
| `visimark ref [NAME]` | Prints the reference entry for `NAME`, or lists every function when `NAME` is omitted | nothing | nothing | `NAME` is not a builtin function |

`ref` is the one command that reads no file. An unknown `NAME` exits non-zero
with the same did-you-mean suggestion the `TYPE` finding already produces, so
`visimark ref LEN` points at `LENGTH` if it ever exists and at nothing if the
name is unlike anything builtin.

`--json` emits the `FnDoc` under the envelope of
[`structured-output-json-spec.md`](structured-output-json-spec.md).

Text output:

```console
$ visimark ref EOMONTH
EOMONTH(d, months) — map, 2 arguments

  Last day of the month `months` calendar months from `d`.

  d        date     the date whose month starts the count; its day is discarded
  months   number   whole number of months to move; may be negative

  returns  date

  errors
    a non-whole `months`                     TYPE
    a result outside years 1-9999            DATE

  examples
    EOMONTH(2026-01-15, 0)    = 2026-01-31
    EOMONTH(2026-01-31, 1)    = 2026-02-28
    EOMONTH(2026-03-31, -1)   = 2026-02-28

  see also  MIN, MAX
```

### 5.1 Playground

The reference is the playground's built-in help: a visitor writing a `vmark`
block in the browser can look a function up without leaving the page.

`browser-entry.ts` re-exports `describeFunction` and `functionNames` on
`window.VisiMark`. [`playground.html`](../playground.html) gains a reference
panel listing the thirteen names, each expanding to the same entry
`visimark ref` prints — signature, summary, parameters, errors, examples.

The panel is rendered from the API at runtime, not from a copy of
`function-reference.md`. A visitor and a CLI user must not be able to read two
different answers.

**Bundle cost.** `docs/vendor/visimark-browser.js` is 271 KB minified today.
The registry is prose that does not minify away — roughly 5 KB, under 2%. CI
byte-compares that bundle
([`ci.yml`](../../.github/workflows/ci.yml)), so the build must be re-run and
the result committed in the same change.

## 6. LSP: hover on a function name

[`hoverAt`](../../packages/visimark-lsp/src/hover.ts) gains a case ahead of its
binding and cell cases: if the offset falls on a function name inside a `vmark`
block, return its reference entry as Markdown.

`Call` nodes carry spans ([`parser.ts`](../../packages/visimark/src/lang/parser.ts)),
but `start`–`end` covers the whole call including its arguments. Hovering `Net`
in `SUM(Net)` must give the `Net` binding, not `SUM`. So the match is narrowed
to `call.start` … `call.start + call.name.length`, and where calls nest, the
innermost match wins.

The hover shows the signature, the summary, the parameters and the errors. It
omits the examples, which are long and belong in `visimark ref`.

## 7. Generated documents

Two outputs, one generator, both committed.

**`docs/function-reference.md`** — the full reference, one section per function,
grouped by kind. This is the document a reader is sent to and the document the
[skill](../../skills/visimark/SKILL.md) links.

**The table in [`visimark-design.md` §4](../visimark-design.md#4-syntax)** —
regenerated in place between HTML-comment markers, keeping its present four
columns (`Function`, `Kind`, `Arity`, `Meaning`), with a link to
`function-reference.md` for parameters and examples. The design doc stays
readable end to end; "here are the thirteen functions" is load-bearing in its
argument and does not become a link to follow.

Everything outside the markers — the shape prose, the exact-arity paragraph, the
`Σ` alias note — is hand-written and untouched.

### 7.1 Rendering the `Meaning` column

`Meaning` is **not** `summary` alone. Nine of the thirteen current cells carry
an error clause as well — `least value; numbers or dates, not mixed`,
`an empty column is a TYPE error` — and generating from `summary` alone would
make the design doc poorer than it is today.

`Meaning` is `summary`, followed by each `FnError` rendered as
`{when} is a {code} error`, joined with `; `. This is why section 3 requires
`when` to be a noun phrase.

One clause does not survive, and should not: `MOD`'s "the language has no `%`
operator" is a fact about the language, not about `MOD`. It moves into the
hand-written prose below the table, outside the markers.

The generator is `scripts/gen-function-reference.ts`, run by a root
`bun run gen:docs`. It imports the registry directly; Bun runs TypeScript, so
no build step precedes it.

## 8. CI

A job modelled on `playground-bundle` in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): regenerate, then
`git diff --exit-code` over `docs/function-reference.md` and
`docs/visimark-design.md`, failing with the command to run and commit. The
repository already uses and explains this mechanism for `docs/vendor/`; reusing
it beats inventing a second one.

Unlike the playground bundle, the output is text a human wrote most of, so Bun
is not pinned for this job — there is no minifier to churn.

## 9. Skill

[`skills/visimark/SKILL.md`](../../skills/visimark/SKILL.md) replaces its
hand-copied function rules with a pointer to `visimark ref` and to
`docs/function-reference.md`. The rules that are about the language rather than
about one function — map versus reduce, cross-sheet qualification — stay.

## 10. Acceptance

1. Adding an entry to `FUNCTIONS` without one in `reference.ts` fails `typecheck`.
2. A `params` list whose length disagrees with `arity` fails the test suite.
3. Every documented example evaluates to its stated value.
4. `visimark ref EOMONTH` prints the entry; `visimark ref` lists thirteen
   functions; `visimark ref NOPE` exits non-zero with a suggestion.
5. `visimark ref EOMONTH --json` validates against the structured-output envelope.
6. Hovering `SUM` in `SUM(Net)` shows the `SUM` entry; hovering `Net` in the
   same call shows the `Net` binding.
7. Editing a `summary` and running `bun run gen:docs` changes both generated
   documents; CI fails if the change is not committed.
8. Every fact in today's §4 table survives into the generated one. Checked by
   reading the diff once, not asserted byte-for-byte: the rendering rule in
   section 7.1 reproduces the prose closely but not always to the comma, and
   `MOD`'s `%` clause moves out of the table by design.
9. The playground's reference panel and `visimark ref` print the same entry for
   every function.

## 11. Non-goals

Reference entries for operators. Localisation. Deriving anything from, or
writing anything to, [`docs/vocab/`](../vocab/). A `--verbose` link from a
finding into the reference (worth having; a separate change). Hover for
functions outside a `vmark` block.

## 12. Decisions taken

Both questions this spec opened are now settled.

1. **`ref` ships in the published CLI**, with `--json`, and is exposed to the
   browser besides. The agent skill and the playground are both consumers, and
   both need it at runtime rather than at build time.
2. **The design-doc table keeps its error clauses**, generated by the rule in
   section 7.1 rather than dropped. Byte-identity is not the acceptance test;
   losing no fact is.
