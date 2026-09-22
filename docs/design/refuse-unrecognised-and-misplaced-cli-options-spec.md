# Refuse unrecognised and misplaced CLI options — feature spec

**Status:** approved (#121) · **Date:** 2026-09-21 · **Decision:** https://github.com/michal-niedzwiedzki/visimark/issues/121#issuecomment-5758855875

## 1. Purpose

Every `visimark` command reads its arguments through one shared `parseArgs`
that adds any `--word` to a set each command consults selectively. Nothing
checks what is left over, so an option a command does not know, or one that
belongs to another command, is ignored and the run reports whatever it would
have reported without it. These run today and exit `0`:

```
$ visimark check invoice.md --jsonn          # human report, not JSON
$ visimark check drift.md --fix-dates        # read-only; dates untouched
$ visimark fmt invoice.md --write            # --write belongs to infer
$ visimark check invoice.md --get vat        # full check; --get ignored
```

and this one fails, but names the wrong problem, after already checking the
first file:

```
$ visimark check invoice.md --format yaml
invoice.md … 0 problems
visimark: cannot read yaml                   # exit 2
```

The CLI is the product ([§11](../visimark-design.md#11-cli)) and its main
callers are CI jobs and agents, which do not read a report they did not expect.
A run that looks right and is wrong is what constraint 3 ("ambiguity is an
error, never a guess", [§2](../visimark-design.md#2-constraints-that-shaped-the-design))
exists to prevent, and the CLI was the one place it did not apply.
[`ci.md`](../ci.md) already documents the trap twice (an "About `--jsonn`"
section and a troubleshooting row). `--scenario` was carved out as the one
refused option in v0.1.6 ([`scenario-params-spec.md`](scenario-params-spec.md)
§5.3) for exactly this reason; this makes it the rule.

This is a tooling change, catalogue **section F**. It changes no document
syntax, evaluation, finding set or write-back.

## 2. The surface

The options each command accepts, and nothing else:

| Token | Kind | Accepted by |
|---|---|---|
| `--json` | flag | `check`, `fmt`, `infer`, `eval`, `explain`, `ref` |
| `--fix-dates` | flag | `fmt` |
| `--no-artifacts` | flag | `fmt` |
| `--write` | flag | `infer` |
| `--get NAME` | value | `eval` |
| `--scenario FILE` (`-` is stdin) | value | `eval` |
| `#sheet` | positional, repeatable | `explain` |

Positional arguments: `check`, `fmt`, `infer` take one or more files; `eval`
and `explain` take exactly one; `ref` takes at most one `NAME`.

Arguments are read left to right and **the first violation is the one
reported**. A refusal is exit `2`, one `visimark: …` line on stderr, nothing on
stdout, and no file read or written. The rules:

1. A token that is exactly `--get` or `--scenario` is a value option and takes
   the next token as its value. On a command that does not accept it, it is
   refused as misplaced (rule 4) and no value is consumed.
2. A missing value, or a value that starts with `--`, is
   `visimark: --get needs a name` or
   `visimark: --scenario needs a file, or - for stdin` (the shipped wording).
   `--get ""` is the same refusal.
3. A token that starts with `--` and is on the command's list is accepted.
4. A token that starts with `--` and is on another command's list is
   `visimark: <option> is only valid with <command>`.
5. Any other token that starts with `--`, or with a single `-` and has more
   characters (`-j`, `-h`), is `visimark: unknown option <token>`, plus
   ``— did you mean `<option>`?`` when `closest(token, <this command's options>, 3)`
   finds one. `--`, `--help` and `-h` are ordinary unknown options with the
   additions below. No `=` form exists, and no `--` terminator.
6. `<known option>=<text>` (`--json=true`, `--get=vat`) is an unknown option
   with a hint in place of a guess: for a value option
   ``— write `--get vat` ``; for a flag ``— `--json` takes no value``.
7. `--` adds ``— to name a file that starts with -, write ./-name``.
8. `--help` and `-h` after a command add a second stderr line: that command's
   `usage:` line (`ref`, which had none, gets `usage: visimark ref [NAME] [--json]`).
   Only the first line is `error.message`.
9. A `#name` token on any command but `explain` is
   `visimark: #<name> is only valid with explain`.
10. A second file to `eval` or `explain` is `visimark: eval takes one file` (or
    `explain`); a second name to `ref` is `visimark: ref takes one name`.
11. A lone `-` and any other token is a file, as today; `--scenario -` is
    unchanged.

`visimark --help`, `-h`, `--version`, `-v` and `version` in the command
position, and an unknown or missing command, are unchanged.

## 3. The machine contract

| Outcome | Exit | stdout | stderr | `--json` |
|---|---|---|---|---|
| Unknown, misplaced or malformed option; extra positional | `2` | empty | the one message line (two for `--help`/`-h`) | envelope, `status: "error"`, `error.code: "USAGE"`, `command` the invoked command, `error.message` the message line |
| Everything that ran before | unchanged | unchanged | unchanged | unchanged |
| `--scenario` fault under `eval` (bad key, JSON number, width) | `2` | empty | as shipped | `error.code: "SCENARIO"`, unchanged |

`--json` is recognised first: if the exact token `--json` appears anywhere in
the arguments to a document command, the refusal is emitted as the envelope on
stdout as well as the line on stderr. `--json=true` is not `--json`, so it gets
stderr only. No new exit code; `2` keeps its meaning, "your request did not
make sense, not your document is wrong". No new error code:
`error.code` stays one of `USAGE`, `READ`, `SCENARIO`.

**Changed from v0.1.6:** `--scenario` on any command but `eval`, and
`--scenario` with no value, move from `SCENARIO` to `USAGE`. Their messages do
not change. `SCENARIO` now means only a fault in a scenario's content.

**Ordering.** Option validation runs before the "no file given" usage error,
before any file is read and before any write. `check missing.md --jsonn`
reports the option; `fmt drift.md --bogus` leaves `drift.md` byte-identical.

## 4. Behaviour table

`invoice.md` passes `check`; `drift.md` is `docs/example-invoice-drift.md`.
Each row's stdout is empty in text mode.

| Invocation | stderr | Exit |
|---|---|---|
| `check invoice.md --jsonn` | ``visimark: unknown option --jsonn — did you mean `--json`?`` | `2` |
| `check invoice.md --jsonn --json` | same line; stdout is the `USAGE` envelope | `2` |
| `check drift.md --fix-dates` | `visimark: --fix-dates is only valid with fmt` | `2` |
| `check drift.md --no-artifacts` | `visimark: --no-artifacts is only valid with fmt` | `2` |
| `fmt invoice.md --write` | `visimark: --write is only valid with infer` | `2` |
| `check invoice.md --get vat` | `visimark: --get is only valid with eval` | `2` |
| `check invoice.md --scenario s.json` | `visimark: --scenario is only valid with eval` | `2` |
| `check invoice.md --format yaml` | `visimark: unknown option --format` (no guess: nothing within 3) | `2` |
| `fmt drift.md --bogus` | `visimark: unknown option --bogus`; `drift.md` unchanged | `2` |
| `check missing.md --jsonn` | ``visimark: unknown option --jsonn — did you mean `--json`?`` | `2` |
| `check --jsonn` | same (the option, not the missing file) | `2` |
| `check invoice.md --json=true` | ``visimark: unknown option --json=true — `--json` takes no value`` | `2` |
| `eval invoice.md --get=vat` | ``visimark: unknown option --get=vat — write `--get vat` `` | `2` |
| `check invoice.md -j` | `visimark: unknown option -j` | `2` |
| `check invoice.md --` | ``visimark: unknown option -- — to name a file that starts with -, write ./-name`` | `2` |
| `check invoice.md --help` | `visimark: unknown option --help` then `usage: visimark check FILE...` | `2` |
| `ref --help` | `visimark: unknown option --help` then `usage: visimark ref [NAME] [--json]` | `2` |
| `check invoice.md '#lines'` | `visimark: #lines is only valid with explain` | `2` |
| `eval invoice.md drift.md` | `visimark: eval takes one file` | `2` |
| `explain invoice.md drift.md` | `visimark: explain takes one file` | `2` |
| `ref SUM MAX` | `visimark: ref takes one name` | `2` |
| `ref SUM --jsonn` | ``visimark: unknown option --jsonn — did you mean `--json`?`` | `2` |
| `eval invoice.md --get --json` | `visimark: --get needs a name`; stdout the `USAGE` envelope | `2` |
| `eval invoice.md --get` | `visimark: --get needs a name` | `2` |
| `eval invoice.md --scenario` | `visimark: --scenario needs a file, or - for stdin`; `USAGE` under `--json` | `2` |
| `check invoice.md --json` | unchanged | `0` |
| `fmt drift.md --fix-dates` | unchanged | as today |
| `infer quote.md --write` | unchanged | `0` |
| `eval invoice.md --get vat --json` | unchanged | `0` |
| `explain invoice.md '#lines' '#recon'` | unchanged | `0` |
| `eval invoice.md --scenario s.json` | unchanged | as today |

## 5. Compatibility

**What breaks.** A job that passes an option to a command that does not own
it, or an option the installed engine does not know. Inside this repository
nothing does: no workflow passes `args`, and every option in the docs sits on
its own command. Outside it, the clear case is the composite Action: `args` is
free text word-split between the command and the files
([`action.yml`](../../action.yml)), and [`ci.md`](../ci.md) shows
`--fix-dates` as its example. `args: --fix-dates` with the default
`command: check` is a silent read-only run in v0.1.6 and exit `2` after.
`runCli` is exported from `packages/visimark/src/index.ts`, so an embedder
sees the same change.

**What does not.** A correct invocation behaves as before, byte for byte,
including `--scenario` output under `eval`. Consumers pinned to an older engine
or Action ref are untouched until they bump.

**Migration note (verbatim, for `CHANGELOG.md` under `### Changed`):**

> **Breaking:** every command now refuses an option it does not recognise, or
> one that belongs to another command, with exit `2` and a `visimark: …` line
> on stderr. Before, the option was ignored and the run reported success. If a
> job now fails with `unknown option` or `is only valid with`, remove the
> option or move it to the command that owns it. To use an option a newer
> release added, pin the engine, and the Action ref, to that release. A
> misplaced `--scenario`, or `--scenario` with no value, now reports
> `error.code: "USAGE"` under `--json` instead of `"SCENARIO"`.

**Release.** Ships as `0.1.7`. **Reversibility:** undoing it takes another
release; a pinned consumer is unaffected either way.

## 6. Interaction with the rest of the tooling

- **`--json`.** The envelope shape is unchanged; only a new way to reach `USAGE`.
- **`--scenario`.** The refusal special case (`refuseScenario`) is deleted; its
  wording survives as rule 4. Scenario content faults are unchanged.
- **The did-you-mean idiom** is `ref`'s (`closest`, threshold 3).
- **Release workflow, LSP and extension.** Unchanged: the LSP uses the engine,
  not the CLI, and `release.yml` calls no option of its own.
- **Review workflow.** `.claude/commands/` invoke the CLI with valid options
  only; the implementation re-checks with a grep.

**Does not change:** exit-code meanings, the `0`/`1` semantics, default text
output, the unknown-command path, `--version`/`--help` in command position,
file-argument handling, the `--json` shape, document meaning and write-back.

## 7. Documentation to update

- `docs/cli-reference.md`: `--json` row (line 50), the ignore paragraph and its `--scenario` exception (53–57), the exit `2` row (65); add the accepted-options table.
- `docs/ci.md`: the "About `--jsonn`" section (735–741), the troubleshooting row (1179), and the `args` row (273): options must suit `command`.
- `docs/tutorial.md`: the ignore paragraph near line 1808.
- `docs/visimark-design.md` [§11](../visimark-design.md#11-cli): state the rule; fold the `--scenario` sentence into it.
- `docs/design/structured-output-json-spec.md`: lines 58–60, test rows 388–389, the `SCENARIO` row 401, "does not change" 429, unit coverage 494, non-goal 509. Line 24 is history and stays.
- `docs/design/scenario-params-spec.md`: §5.3 exception (322), the non-goal at 492, the `--scenario`-no-value row 264 (code becomes `USAGE`), §4.2 wording on the code.
- `action.yml`: the `args` description. `packages/visimark/src/cli/main.ts`: nothing to change in `USAGE`; the per-command usage strings are reused as they are.
- `CHANGELOG.md` `## Unreleased` → `### Changed`, with the migration note in §5.
- `docs/vocabulary-catalogue.md`: the row moves to the Shipped register as `UNRELEASED`.
- Historical plans (`structured-output-json-plan.md`, `function-reference-plan.md`) are a record and stay.
- Before finishing, `grep -rniE "unrecogni[sz]ed|unknown (option|flag)|ignored"` over `docs/`, `README.md`, `CONTRIBUTING.md` and `skills/`.

## 8. Non-goals

- Per-command `--help`, `=` syntax, short options and `--` termination.
- A `--strict` opt-in or an environment variable to restore ignoring: constraint 4.
- Changing the usage strings, which omit `--json` on some commands.
- Any change to what a document means.

## 9. Acceptance

[§13](../visimark-design.md#13-testing)-style. Every row of the behaviour table
is a test on `runCli` capturing stdout, stderr and the exit code, using
`docs/example-invoice.md` and `docs/example-invoice-drift.md` copies. Plus:

- `fmt drift.md --bogus` leaves the file's bytes identical and writes no artifact.
- With `--json`, stdout parses as one envelope with `status: "error"`,
  `error.code === "USAGE"`, `command` the invoked one, and `error.message`
  equal to the first stderr line.
- The three tests that pin ignoring (`cli.test.ts` "an unrecognised flag is
  ignored…", `json.test.ts` "check FILE --jsonn is ignored…", `ref.test.ts`
  "an unrecognised flag is ignored…") are rewritten to assert exit `2`, not
  deleted.
- `scenario.test.ts`: the misplaced and no-value cases assert `USAGE`; content
  faults still assert `SCENARIO`.
- `bun run packages/visimark/src/cli/main.ts check` exits `0` on every document
  the `dogfood` workflow lists.

## 10. Open questions

None.

<!--vmark:no-formulas-->
