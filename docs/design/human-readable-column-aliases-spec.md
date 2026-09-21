# Human-readable column references and aliases — feature spec

**Status:** approved (#86) · **Date:** 2026-09-14 · **Decision:** <https://github.com/michal-niedzwiedzki/visimark/issues/86#issuecomment-5668665880>

## 1. Purpose

A binding name must be a valid identifier ([§3](../visimark-design.md#3-document-model), [§4](../visimark-design.md#4-syntax)), and a column rule is recognised only when that identifier equals a table header exactly. A header written for a human reader — `Bandwidth per Unit (TB/s, full-duplex)` — can therefore never be a column rule's target and can never appear as an operand in a formula. Today the only way to compute against such a column is to rewrite the printed header into an identifier, which is exactly the kind of intrusion [§9](../visimark-design.md#9-write-back) exists to forbid when the table belongs to someone else.

The motivating case (issue #86) is a GPU-networking table:

```markdown
| GPUs | Bandwidth per Unit (TB/s, full-duplex) | GPU-to-GPU Bandwidth (GB/s, full-duplex) |
|---:|---:|---:|
| 8 | 3.2 | 400 |
```

with a calculation that needs to read the first computed column and write the second, using short names, while leaving the table untouched:

```
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
"GPU-to-GPU Bandwidth (GB/s, full-duplex)" is gpu_bw

gpu_bw = ROUND(bpu / GPUs * 1000, 0)
```

A second, independently-motivating case surfaced in review: reaching out to other GitHub projects to add VisiMark to an existing document. Those tables are not the author's to rewrite at all — "clean it up first" is not an option — so the reachability gap is not a style preference there, it is the difference between VisiMark being usable on a real document and not.

Two separate problems are being solved, and the spec keeps them as two separate primitives:

1. **Reachability** — a quoted header is legal wherever an identifier binding name is legal today. This alone lets a formula **write** a column rule for a header that is not an identifier — useful when the column is only ever produced, never read back elsewhere in the sheet.
2. **Ergonomics** — `is` gives that column a short, formula-facing name so the rest of the sheet does not have to keep repeating the full quoted header. `is` is also the *only* way to **read** an existing header's values in a formula: a quoted string is already a string literal in expression position (`IF(Terms == "net 30", …)`), so a bare quoted header cannot double as a column operand without colliding with that — constraint 3 forbids exactly this kind of context-dependent reading. An input column with a non-identifier header is therefore unreachable as a formula operand until it is named with `is`.

No existing catalogue row covers this (see the pre-review's overlap analysis on #86: `Σ`/`SUM` is a closed two-codepoint lexer substitution; `labelled`/`unlabelled` name **imported** CSV columns, not in-document GFM headers; whole-sheet materialisation, REJECTED, was about inlining imported data, not naming).

## 2. Syntax

Two additions, both usable only inside a `vmark` block that owns a table ([§3](../visimark-design.md#3-document-model)):

```
"<header text>" = <expr>          # column rule, quoted form
"<header text>" is <symbol>       # alias declaration
```

- **Quoted column rule.** Wherever a binding's left-hand side is today required to be an identifier, a **string literal** is also legal. It is a column rule if and only if `<header text>` is byte-identical to some header cell's text in the sheet's table; there is no other outcome — a quoted binding never becomes a scalar (see §3). The string literal uses the grammar that already lexes `"net 30"` ([§4](../visimark-design.md#4-syntax)): everything between two `"` characters, verbatim, with no escape sequences. A header whose raw source text contains a literal `"` cannot be referenced this way — see §7.
- **`is` — alias declaration.** `is` is a new reserved word, tokenised beside `assert` and `chart` ([§4](../visimark-design.md#4-syntax), [§18](../visimark-design.md#18-generated-artifacts)). `<symbol>` is an identifier, `[A-Za-z_][A-Za-z0-9_]*`. After `"<header text>" is <symbol>` is processed, `<symbol>` is a **complete second name** for that header's column, for every purpose a native identifier-header name has in the rest of the sheet: it may appear as an operand in any expression, as the bare argument to a reduce, and as the left-hand side of an ordinary `<symbol> = <expr>` binding — which is then a column rule for that header, exactly as if the header's own text equalled `<symbol>`. The alias does not create a second column, a second vector, or a new node in the dependency graph; it is a second key resolving to the same column data.
- **Direction is not encoded in the keyword.** The original proposal's `now` is dropped. A column rule already has direction — `name = expr` writes, a header with no rule is input — so a single alias form plus ordinary `=` covers both reading and writing through a short name. (`now` also reads as a clock, the same family of name that got `TODAY()`/`WORKDAY()` rejected under constraint 4 — a reason to drop it even if a second keyword had been needed.)
- **Placement and scope.** Both forms are sheet-local, matching existing name resolution ([§6](../visimark-design.md#6-name-resolution-and-scoping)): a bare name (aliased or not) resolves in its own sheet, then document scope, never across a bare reference. A quoted header or an `is` declaration names a column of the **same sheet's own table** only — there is no cross-table quoted reference (`other."Long Header"`) in this feature; see §7.
- **Renders unmodified** ([§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 1). Both forms live entirely inside the `vmark` fence. The table is never rewritten by either form — not by inference, not by `fmt`, under no flag — so GitHub, VS Code preview, Obsidian and pandoc keep rendering the document exactly as before.

## 3. Semantics and errors

| Case | Result |
|---|---|
| `"H" = expr`, `H` matches exactly one header | Column rule for that header — identical evaluation to an identifier-named column rule. |
| `"H" = expr`, no header's text equals `H` | `UNDEF`, naming the quoted text, with a did-you-mean against the sheet's header texts. A quoted binding never falls back to becoming a scalar — unlike an unresolved identifier, an unresolved quoted header is unambiguously a mistake, not a new named value. |
| `"H" is x`, `H` matches exactly one header | `x` aliases that header's column, whether or not the header already carries a rule (from a plain identifier binding or from `"H" = expr`). |
| `"H" is x`, no header's text equals `H` | `UNDEF`, same treatment as above. |
| `x` (an alias) used as a bare operand, or as a reduce's argument | Resolves exactly as the header it names would — a per-row scalar inside a column rule, a vector inside a reduce. |
| `x = expr`, `x` is an alias for header `H` with no existing rule | Column rule for `H`, written through the alias exactly as `"H" = expr` would be. |
| `x = expr`, `x` is an alias for header `H` that **already** carries a rule (via `"H" = expr` or via `x = expr` itself, elsewhere) | `DUP` — a name bound twice in one scope ([§6](../visimark-design.md#6-name-resolution-and-scoping)), exactly as two identifier bindings on the same name collide today. |
| Alias symbol `x` collides with an existing column, scalar, builtin, or keyword (`is`, `assert`, `chart`, …) in the same sheet | `DUP`, same mechanism and message shape as any other name collision. |
| Two header cells in one table share byte-identical text | `DUP`, naming the header text and both header positions. Neither text becomes usable as a name — bare identifier **or** quoted — until the headers are told apart. This widens `DUP`'s existing case (today: "a name is bound twice by binding statements") to also cover two headers being the same name before any binding is written — the identical hazard this feature makes far more likely, since natural-language headers collide more easily than short identifiers, but one that already existed silently for identifier-shaped headers (`headerIndex` is last-write-wins today with no error). Closing it is not scoped to quoted references: it applies to plain identifier headers too. |
| An alias is declared and never referenced by any expression | `WARN`, naming the alias — the same treatment [§6](../visimark-design.md#6-name-resolution-and-scoping) already gives an unreferenced scalar, and for the same reason: a typo or an abandoned alias should not sit silently unused. |
| A header's raw source text contains a literal `"` | Cannot be referenced by a quoted form at all — the string-literal grammar has no escape ([§4](../visimark-design.md#4-syntax)). Out of scope; see §7. |

Both new checks are static, evaluated once per sheet before the dependency graph is built, and follow [§8](../visimark-design.md#8-evaluation)'s suppression rule: a sheet with an unresolved quoted reference reports that one `UNDEF` and does not cascade into unrelated `NOTE`s for bindings that do not depend on it.

## 4. Interaction with the rest of the language

- **Shape system** ([§4](../visimark-design.md#4-syntax)) — unaffected. An alias is a second name for the same vector or scalar-per-row reference; nothing here introduces a vector→vector transform or a new shape.
- **Write-back** ([§9](../visimark-design.md#9-write-back)) — unaffected in kind. A quoted or aliased column rule writes only the cells its column already has, exactly like an identifier column rule; neither form can create a header or a column. The tool's three owned categories (computed cells, anchored values, generated artifacts) do not gain a fourth.
- **Diffability** ([§13](../visimark-design.md#13-testing)) — unaffected. Writes stay the same single-cell byte splices every column rule already produces.
- **Name resolution** ([§6](../visimark-design.md#6-name-resolution-and-scoping)) — an alias is inserted into the same sheet-local name space as columns and scalars, subject to the same `DUP` check, the same did-you-mean on `UNDEF`, and the same "foreign column is a vector" rule when read via `sheet.alias` from another sheet.
- **Units** ([§7](../visimark-design.md#7-numeric-semantics)) — unaffected. A unit is inferred from cell decoration, never from header text; a unit-looking substring inside a quoted header (`"...(TB/s, full-duplex)"`) has no interaction with unit inference.
- **`explain`** ([§11](../visimark-design.md#11-cli)) — an aliased column's entry in a sheet's explanation names both the alias and the header it stands for, so a reader recovers the mapping without opening the table.
- **`eval --json` / `check --json`** — a `DUP`/`UNDEF`/`WARN` finding produced by this feature carries the same envelope fields as any other finding of that code; no new JSON shape.
- **What does not change.** Rounding and write precision ([§7](../visimark-design.md#7-numeric-semantics)), dates ([§5](../visimark-design.md#5-dates)), the builtin function table, and evaluation order ([§8](../visimark-design.md#8-evaluation)) — an alias resolves before the dependency graph is built, so the graph itself contains only the columns and scalars it already would.

## 5. `infer` support

Without this, `infer` would keep silently treating every non-identifier header as an unmanaged input ("no rule found — treating as inputs"), which defeats the point for exactly the tables this feature targets — someone else's table, full of wordy headers, is the case `infer` most needs to help with. `infer` gains one new proposal kind, printed alongside its existing buckets and written only with `--write`, same as every other proposal:

**Candidate selection.** Every header in the sheet's table that is not already an identifier, does not already have a rule, and is not already aliased is a candidate for an alias proposal (independent of whether the column is numeric — the reachability gap exists regardless of what the column later does).

**Name generation.**
1. Split the header text into tokens on any run of characters that are not `[A-Za-z0-9]`.
2. Drop tokens that match a fixed, built-in stopword list — `a, an, the, of, per, in, on, for, and, or, to, at, by` — closed and document-independent, so the rule stays deterministic ([§2](../visimark-design.md#2-constraints-that-shaped-the-design) constraint 4).
3. Take the first alphanumeric character of each remaining token, lower-cased, and join with no separator.
4. If the result is empty or starts with a digit, prefix `_`.

`"Bandwidth per Unit (TB/s, full-duplex)"` → tokens `Bandwidth, per, Unit, TB, s, full, duplex` → drop `per` → `Bandwidth, Unit, TB, s, full, duplex` → `b, u, t, s, f, d` → `butsfd`. This will often differ from what a human would pick (the issue's own `bpu` hand-picks which tokens matter) — the proposal is a starting point for `infer`'s printed suggestion, not a claim of the best name, exactly as `infer`'s existing scalar-naming proposals are.

**Collision handling.** If the generated name collides with an existing column, scalar, builtin, keyword, or another proposal in the same sheet, the alias is **not proposed** — it is listed in `infer`'s existing `ambiguous` bucket instead, printed but never written, the same treatment a near-miss numeric rule already gets. No new inference machinery: this is one more source feeding the bucket that already exists.

## 6. Acceptance

[§13](../visimark-design.md#13-testing)-style, following the precedent set for charts (`example-charts.md`): this feature gets its own worked example rather than being grafted onto the invoice pair, where wordy headers do not semantically belong.

**`docs/example-bandwidth.md` — a new normative example**, joining `example-invoice.md`, `example-invoice-drift.md` and `example-charts.md` in the acceptance suite:

```markdown
| GPUs | Bandwidth per Unit (TB/s, full-duplex) | GPU-to-GPU Bandwidth (GB/s, full-duplex) |
|---:|---:|---:|
|    8 |                                     3.2 |                                       400 |
|   16 |                                     3.2 |                                       400 |

```vmark #network
"Bandwidth per Unit (TB/s, full-duplex)" is bpu
"GPU-to-GPU Bandwidth (GB/s, full-duplex)" is gpu_bw

gpu_bw = ROUND(bpu / GPUs * 1000, 0)
peak = MAX(gpu_bw)
```
```

Anchored into prose: `Peak GPU-to-GPU bandwidth: **400**<!--vmark=network.peak-->`.

`visimark check docs/example-bandwidth.md` must print `0 problems (0 stale, 0 errors)`. `visimark fmt` must leave the document byte-for-byte identical. `visimark explain docs/example-bandwidth.md` must show `bpu` and `gpu_bw` each annotated with the header they alias.

**New fixtures, `packages/visimark/test/fixtures/`:**

- `column-alias-undef.md` — a quoted binding whose text matches no header. `check` must produce, transcript-exact:
  ```
  <path>/column-alias-undef.md

    UNDEF   network."Bandwidth per Unyt (TB/s)"   no column named "Bandwidth per Unyt (TB/s)" — did you mean "Bandwidth per Unit (TB/s, full-duplex)"?

    1 problem (0 stale, 1 error)
  ```
- `column-alias-dup-header.md` — a table with two header cells reading `Rate` (plain identifier text, to prove the widened `DUP` check is not quoted-syntax-specific). `check` must report one `DUP` naming both header positions and exit `1`.
- `column-alias-dup-target.md` — `"H" is x` followed by `x = 1` where `H` already carries `"H" = 2`. `check` must report `DUP` on the second binding of `x`.
- `column-alias-unused.md` — a declared, never-referenced `is` alias. `check` must report exactly one `WARN` naming the alias.
- `column-alias-quoted-string-header.md` — a header whose raw text contains a literal `"`. No quoted reference can name it; `infer` lists it under "no rule found — treating as inputs" like any other non-identifier header with no candidate alias.

**Unit coverage:** each row of the §3 table; an alias targeting a column with an existing rule vs. one with none; a foreign reference to an aliased column (`network.bpu` from another sheet) confirming it is still a vector outside an aggregate; `infer`'s stopword list and its collision fallback into `ambiguous`; `explain` output naming both alias and header; did-you-mean suggesting a header text, not just identifier names.

## 7. Non-goals

- **Cross-table / cross-sheet quoted references** (`other."Long Header"`). Nothing in the motivating documents needs one; revisit if a real document does.
- **Aliasing a scalar.** A scalar is named once, at its own definition — there is no printed-header/formula-name tension for it the way there is for a table column someone else already wrote. `is` applies to columns only.
- **Automatic identifier normalisation as a default.** The issue's original text treated this as already-existing behaviour; it is not ([§3](../visimark-design.md#3-document-model), [§4](../visimark-design.md#4-syntax)). Shipping a normalisation heuristic beside explicit aliases would be a second mechanism and a second collision source for the same problem — this spec ships only the explicit form.
- **Escaping a `"` inside a quoted header.** The string-literal grammar has no escape sequence today; adding one is a separate, general change to string literals, not scoped to this feature. A header containing a literal `"` remains unreachable by quoted reference or alias until that grammar changes.
- **A temporal or directional keyword (`now`).** Dropped; see §2.
- **Renaming the printed header.** Never happens, under any flag, by either form.

## 8. Open questions

None.

<!--vmark:no-formulas-->
