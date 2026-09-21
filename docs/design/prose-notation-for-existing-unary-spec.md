# Prose notation for unary vocabulary — feature spec

**Status:** approved (#64) · **Date:** 2026-09-21 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/64#issuecomment-5759705769

## 1. Purpose

Add four prose spellings for four shipped mappers. Each resolves to an existing
`Call` node before any other stage sees it; nothing is added to the evaluator.

| Written | Resolves to | Mechanism |
|---|---|---|
| `\|x\|` | `ABS(x)` | delimiter pair |
| `⌊x⌋` | `FLOOR(x, 1)` | delimiter pair, step supplied |
| `⌈x⌉` | `CEILING(x, 1)` | delimiter pair, step supplied |
| `√(x)` | `SQRT(x)` | identifier alias, the `Σ` mechanism |

The motivation is legibility, not expressive power, and the issue says so. A
numerate reader who never learned to read a function call recognises `|x|` and
`⌊x⌋` before they recognise VisiMark. It is judged on cost, the way `Σ`
([#43](https://github.com/michal-niedzwiedzki/visimark/issues/43)) was. Existing
vocabulary computes everything the new spellings compute.

The one real document that uses any of the four functions is the tutorial
capstone, whose reconciliation sheet asserts a tolerance:

```vmark
assert ABS(variance) <= 0.05
```

That line becomes `assert |variance| <= 0.05`, and it is the acceptance case
(§6). No other example document uses `ABS`, `FLOOR`, `CEILING` or `SQRT`.

This spec is the "new catalogue issue, judged on its own facts" that
[`as-an-alias-for-sum-spec.md` §7](as-an-alias-for-sum-spec.md) reserved for
`√`. Its approval is not precedent for `∏`, `∫` or any other glyph.

## 2. Syntax

### 2.1 Tokens

`packages/visimark/src/lang/lexer.ts` gains two things, both beside the `Σ`
branch and before the identifier branch:

- **Identifier glyphs.** The `Σ`/`∑` branch generalises to a closed map
  `{ "Σ": "SUM", "∑": "SUM", "√": "SQRT" }`. The glyph lexes as an `ident`
  token whose value is the function name and whose span is the one character
  written. `√` is U+221A, one UTF-16 code unit.
- **Delimiter glyphs.** `|` (U+007C), `⌊` (U+230A), `⌋` (U+230B), `⌈`
  (U+2308) and `⌉` (U+2309) lex as a new token kind `delim`, value the glyph,
  span one code unit each. `TokenKind` in `token.ts` gains `"delim"`.

`|` lexes as "unexpected character" today, so no existing document can contain
it in an expression. Adjacent bars lex as two tokens: there is no `||` token,
and `or` is the only word operator for disjunction.

Every other look-alike stays "unexpected character": U+2223 `∣`, U+2225 `∥`,
U+FF5C `｜`, U+2502 `│`, the corner brackets `⎣ ⎦ ⎡ ⎤`, and U+221B `∛`. Only
the codepoints named above are recognised.

### 2.2 Grammar

The parser's `nud` gains one case, `delim`, driven by a table:

| Opener | Closer | Function | Extra argument |
|---|---|---|---|
| `\|` | `\|` | `ABS` | none |
| `⌊` | `⌋` | `FLOOR` | the literal `1` |
| `⌈` | `⌉` | `CEILING` | the literal `1` |

```
primary := … | "|" expr "|" | "⌊" expr "⌋" | "⌈" expr "⌉"
```

Parsing an opener calls `parseBp(0)` for the inner expression, then requires
the pair's closer as the next token. The result is `Call { name, args, start:
opener.start, end: closer.end }`. For `⌊` and `⌈`, `args` is `[inner, num("1")]`,
and the synthesized number's span is the **closing glyph**: the character the
author wrote, so no finding points at unwritten text.

**Position decides open versus close.** A `delim` token in operand-start
position (where `nud` runs) is an opener. After a complete operand (where the
binary-operator loop runs) `delim` has no binding power, so the loop stops and
the enclosing pair's closer check consumes it. This is why `|` can be its own
closer with no lookahead, and it is why `|` **nests**: `||a - b| - 1|` is
`ABS(ABS(a - b) - 1)`. The issue said `||x||` could not be written; that was
wrong, and this spec supersedes it.

A closer with no opener is an error (§4). `⌋` and `⌉` are never openers.

### 2.3 What the glyphs are not

- `√` is an alias, not a prefix operator. Parentheses are required: `√(x)`,
  never `√x`. This is the shape `Σ` shipped with, and it keeps the reach of
  the radical unambiguous.
- `⌊x⌋` is not `⌊(x)⌋`. The delimiters are the grouping.
- None of the five delimiter glyphs, nor `√`, is a valid identifier character,
  so no bound name changes meaning ([§6](../visimark-design.md#6-name-resolution-and-scoping)).

### 2.4 Rendering

Expressions live only inside fenced `vmark` blocks, and a fenced block is not
parsed for table syntax, so `|` cannot collide with a table
([§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 1
holds). §4's sentence "`|` would collide with table syntax" is stale and is
replaced (§7). One residual cost: documenting these spellings inside a
Markdown table needs `\|`, as this spec does.

## 3. Semantics

Every row is the identical `ABS`, `FLOOR`, `CEILING` or `SQRT` computation.
The inputs use `a = 7.5` and `b = 10`.

| Input | Value | Note |
|---|---|---|
| `\|a - b\|` | `2.5` | `ABS(a - b)` |
| `\|-a\|` | `7.5` | |
| `\|0\|` | `0` | |
| `\|\|a - b\| - 1\|` | `1.5` | nesting: `ABS(ABS(a - b) - 1)` |
| `\|a\| + \|b\| * \|a - b\|` | `32.5` | precedence is unchanged; each pair is one operand |
| `\|a\|-\|b\|` | `-2.5` | the middle `-` is infix, so the next `\|` opens |
| `⌊a⌋` | `7` | `FLOOR(7.5, 1)` |
| `⌊-a⌋` | `-8` | toward −∞ |
| `⌊7⌋` | `7` | |
| `⌊0.5⌋` | `0` | |
| `⌈a⌉` | `8` | `CEILING(7.5, 1)` |
| `⌈-a⌉` | `-7` | toward +∞ |
| `⌈-0.5⌉` | `0` | never `-0` |
| `⌊\|a - b\| * 3⌋` | `7` | pairs of different kinds nest |
| `√(b + 6)` | `4` | `SQRT(16)` |
| `√(0)` | `0` | |
| `Net_floor = ⌊Net⌋` | one value per row | a mapper over a column, row-wise, like `FLOOR(Net, 1)` |
| `t = \|SUM(Net)\|` | scalar | a reduce inside a mapper is legal, like `ABS(SUM(Net))` |

**Precision** is the precision of the function each spelling resolves to
([§7](../visimark-design.md#7-numeric-semantics)):

- `|x|` has the width of `x`.
- `⌊x⌋` and `⌈x⌉` have the width of the step, which is `1`, so their width is
  `0`: a written `⌊7.5⌋` is `7`, whatever the width of `x`.
- `√(x)` **must be declared**, exactly as `SQRT` must: `r precision 2 = √(16)`
  writes `4.00`.

**Spelling is per-occurrence.** A document may use `ABS(x)` in one binding and
`|x|` in the next. Nothing enforces consistency; that is a style question for
the author, as it is for `Σ`.

## 4. Type rules and errors

**No new finding code.** Every failure a prose spelling can produce is an
existing `TYPE` or `UNDEF` failure of the function it resolves to, reported
under that function's name at the span of the whole call, so a finding on
`|"s"|` says `ABS expects a number` and highlights `|"s"|`. This is the `Σ`
precedent: the canonical name appears in messages.

Malformed pairs are `TYPE` errors, reported at the token named:

| Input | Finding | Span |
|---|---|---|
| `\|a` | `TYPE` — expected `` `\|` `` | end of the expression |
| `⌊a` | `TYPE` — expected `` `⌋` `` | end of the expression |
| `⌊a⌉` | `TYPE` — expected `` `⌋` `` | the `⌉` |
| `(a⌋` | `TYPE` — expected `` `)` `` (the existing parenthesis message) | the `⌋` |
| `⌋a` | `TYPE` — `` `⌋` has no opening `⌊` `` | the `⌋` |
| `⌉a` | `TYPE` — `` `⌉` has no opening `⌈` `` | the `⌉` |
| `a \|b\|` | `TYPE` — unexpected `` `\|` `` | the first `\|` |
| `\|a\|b` | `TYPE` — unexpected ident | the `b` |
| `√a` | `TYPE` — unexpected ident | the `a` (parity with `Σ a`) |
| `√` alone | `UNDEF` — unknown name `SQRT` | the `√` (parity with a bare `Σ`) |

The existing top-level message `unexpected <kind>` is extended so that a
leftover `delim` token reads `` unexpected `<glyph>` `` instead of
`unexpected delim`. Nothing else in `parseTopLevel` changes.

Wrong operand types, `SQRT` of a negative, and every other function-level
failure are unchanged: `√(-1)` reports `SQRT of a negative number`,
`⌊"s"⌋` reports `FLOOR expects a number`. The synthesized step `1` can never
fail `FLOOR`'s and `CEILING`'s positive-step check, so `⌊x⌋` adds no failure
path. An error upstream of an operand suppresses the call exactly as it does
for the named spelling ([§8](../visimark-design.md#8-evaluation)).

A pair with a missing operand (`||`, `|-|`, `⌊⌋`) fails through the existing unexpected-token
path at the point the operand was expected, with no wording of its own.

A glyph on the left of `=` is not a valid binding name and fails through the
existing invalid-name path, unchanged.

A `param NAME = default LITERAL` default is a literal only
([scenario-params spec](scenario-params-spec.md)), so `default |3|` is rejected
as any non-literal default is today.

## 5. Interaction with the rest of the language

- **Shape system ([§4](../visimark-design.md#4-syntax)).** Every spelling is a
  mapper, scalar to scalar, or row-wise over a column. A reduce takes a bare
  column reference, so `SUM(|Net|)` is a `TYPE` error, exactly as
  `SUM(ABS(Net))` is. No boolean appears in a cell.
- **Evaluation and the dependency graph ([§8](../visimark-design.md#8-evaluation)).**
  Unchanged: the graph is built from `Ref` and `Call` nodes, and both spellings
  produce the same nodes.
- **Write-back ([§9](../visimark-design.md#9-write-back)).** Unchanged. `fmt`
  writes computed cells, anchors and generated artifacts, and never a binding's
  expression text. It never rewrites one spelling to the other, and no
  conversion flag is added. The tool owns nothing new.
- **Anchors ([§3](../visimark-design.md#3-document-model)),
  imports, `param`, `assert`, `chart`, column aliases, declared precision.**
  Unchanged. `assert |a - b| <= 0.05` parses through the same expression
  parser as `assert ABS(a - b) <= 0.05`. A prose spelling is legal wherever
  its function call is, and nowhere else.
- **Units ([§7](../visimark-design.md#7-numeric-semantics)).** Unchanged.
- **CLI surfaces.**
  - `check`: reports exactly what the named spelling reports, with the
    findings in §4 for malformed pairs.
  - `fmt`: never rewrites the spellings; computed cells and anchors are written
    as they are today.
  - `infer`: proposes the same rules it proposes today, in code notation. It
    never proposes any of these four functions today and does not start to.
    A notation option for `infer` is out of scope and tracked separately.
  - `explain`: echoes source text by span, so `|a - b|` is echoed as written
    while the dependency and evaluation-order description is identical.
  - `eval`, `--json`: values are identical, and nothing in the `--json` shape
    reveals which spelling produced them.
  - `ref`: unchanged. The four `ref` entries and their `--json` shape do not
    gain the prose spelling.
- **Did-you-mean.** A prose spelling is never a candidate. The edit-distance
  machinery walks the builtin function table and in-scope identifiers, and
  neither gains an entry.
- **Editor (`packages/visimark-lsp`).** Hover on a call recognises a name only
  when the source text at the call's start is that name, so the hover range of
  a call is the name token, or, for a glyph spelling, the **opening glyph**
  alone. This also repairs `Σ(Net)`, whose hover range is wrongly `Σ(N` today.
  Hover on the opening glyph of `|x|`, `⌊x⌋`, `⌈x⌉`, `√` and `Σ` shows the
  resolved function's entry; hover elsewhere inside the call shows what it
  showed before.

**What does not change:** the `FUNCTIONS` table, the identifier grammar, the
did-you-mean candidate set, arity checking, the error taxonomy
([§10](../visimark-design.md#10-error-taxonomy)), write-back ownership,
`fmt`, `infer`, `ref`, and every builtin other than the four gaining
spellings. **Documents that pass `check` today:** every one still passes,
because `|`, `⌊`, `⌋`, `⌈`, `⌉` and `√` are all "unexpected character" today.
No document in `docs/` uses them.

## 6. Acceptance

**The capstone.** In `docs/tutorial/capstone.md`, and every copy of that block
in `docs/tutorial.md`, the reconciliation assertion becomes:

```vmark
assert |variance| <= 0.05
```

The tutorial prose that quotes the assertion (the "deleted or loosened" note in
`docs/tutorial.md`) is edited to match. All other examples are unchanged, and
the three canonical documents' transcripts in
[§13](../visimark-design.md#13-testing) are unaffected.

```
$ visimark check docs/tutorial/capstone.md
docs/tutorial/capstone.md

  0 problems (0 stale, 0 errors)
$ echo $?
0
```

Sabotaging the tolerance still fails it: with `variance = 0.10`, `check`
reports an `ASSERT` finding and exits `1`, as `ABS(variance)` does today. A
`√(x)` binding with no declared width reports `PRECISION`, as `SQRT(x)` does.

**The fixture** `packages/visimark/test/fixtures/prose-notation.md`, exercising
every row of §3:

````
```vmark
a = 7.5
b = 10
abs1 = |a - b|
abs2 = ||a - b| - 1|
abs3 = |a| + |b| * |a - b|
fl = ⌊a⌋
ce = ⌈a⌉
fln = ⌊-a⌋
mix = ⌊|a - b| * 3⌋
rt = √(b + 6)
ok = ABS(a - b)
assert |a - b| <= 2.5
```
````

`visimark eval` prints:

```
a     7.5
b     10
abs1  2.5
abs2  1.5
abs3  32.5
fl    7
ce    8
fln   -8
mix   7
rt    4
ok    2.5
```

**Unit tests** (`packages/visimark/test/lang/`):

- `lex("|a|")`, `lex("⌊a⌋")`, `lex("⌈a⌉")` produce `delim` tokens with
  one-code-unit spans; `lex("√(a)")` is the token stream of `SQRT(a)` except
  for the first token's span.
- `parseExpr` of each spelling deep-equals the `Call` node of the named
  spelling, ignoring spans; `⌊a⌋` has `args[1]` equal to `num("1")` whose span
  is the `⌋`.
- Every row of the §4 table produces the stated message at the stated span.
- Nesting and precedence rows from §3.
- A document that passes `check` today produces byte-identical `check` output
  before and after (the three canonical examples, run in the acceptance suite).
- Did-you-mean for `ABSS(x)` never suggests `|`.
- LSP hover: on `Σ(Net)`, hovering `N` shows the `Net` binding, not `SUM`;
  hovering `Σ` shows `SUM`. Likewise for the four new spellings.
- `bun run gen:docs` produces no diff after the `FnDoc` edit, and CI's
  regeneration check passes.

## 7. Documentation

`FnDoc` in `packages/visimark/src/lang/reference.ts` gains an optional
`prose?: string`, set on `ABS` (`|x|`), `SQRT` (`√(x)`), `FLOOR` (`⌊x⌋`) and
`CEILING` (`⌈x⌉`). The generators render it, as a co-canonical spelling and not
a footnote:

- **§4 function table** (generated): the Function cell reads
  `` `ABS(x)` · `\|x\|` ``.
- **`docs/function-reference.md`** (generated): each of the four entries gains a
  line `**Also written:** `|x|``.
- **Playground reference panel and editor hover** render the same line, since
  they read `describeFunction`.

Hand-written edits:

- **§4 operators paragraph**: the sentence "`|` would collide with table
  syntax" is replaced by one saying `|` is legal only as an absolute-value
  delimiter, inside a fenced block, where it cannot collide with a table, so
  the earlier reasoning is visibly reconsidered and not silently dropped.
- **§4 `Σ` note** (line 340): extended to say `√` joins `Σ` and `∑` as a
  single-codepoint identifier substitution, and that the delimiter pairs are
  parsed, not aliased. "A closed substitution, not a general symbol-notation
  system" stays true and is restated for the new set: exactly these spellings,
  no others.
- **`docs/vocabulary-catalogue.md`**: section E row for #64, then moved to the
  Shipped register as `UNRELEASED` by the plan.
- **`CHANGELOG.md`** `## Unreleased` → `### Added`, and one line in
  `editors/vscode/CHANGELOG.md` for the hover fix and the new spellings.
- **`docs/tutorial.md`** and `docs/tutorial/capstone.md`, per §6.

Not edited: §1 (the audience sentence stays as written), §9, the `#43` spec, and
`docs/cli-reference.md`.

## 8. Non-goals

- **No `fmt --convert-notation`** and no other conversion pass. Both spellings
  stay legal input; `fmt` never rewrites an expression.
- **No `infer` notation option here.** `infer --math` is a section F change to
  the CLI surface and is decided on its own tooling issue. Neither an
  environment variable, a configuration file, nor detection from the document is
  proposed for it or for any notation choice.
- **No general symbol-notation system.** `∏`, `∫`, `∛`, `⌊x⌉`-style mixed
  delimiters and bracket notation for any other function are each a new
  catalogue issue.
- **No prose renderer for `explain`.** It echoes source text.
- **No amendment to §1's audience sentence**, and no standing exemption from
  the "a real document needs it" criterion for notation requests.
- **No `∑`-style prefix for `√`** (`√x` without parentheses).
- **No change to `ref` or its `--json` shape.**
- **No editor highlighting work.** The extension carries no TextMate grammar
  for expressions today.

## 9. Open questions

None.
