# Refuse unrecognised and misplaced CLI options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `visimark` command exits `2` on an option it does not accept, or one that belongs to another command, and on extra positionals, before it reads or writes anything, per `docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md`.

**Architecture:** A new module `packages/visimark/src/cli/args.ts` owns the option table, the six usage lines and `parseArgs(command, args)`, which returns either the parsed arguments or a refusal (`message`, optional `usage`, and whether `--json` was present). It replaces the private `parseArgs` in `cli/commands.ts`. Each `cmd*` calls it first and, on a refusal, calls one `refuse()` helper that writes stderr and, under `--json`, the `USAGE` envelope. `refuseScenario` and its constant are deleted. No engine, model, write, infer or LSP change.

**Tech Stack:** TypeScript; Bun test runner; `oxlint` / `oxfmt`; the engine package `packages/visimark`.

**Spec:** `docs/design/refuse-unrecognised-and-misplaced-cli-options-spec.md`

## Global Constraints

- No new npm dependencies. No new exit code. No new `error.code` (`USAGE`, `READ`, `SCENARIO` only).
- The first violation in left-to-right argv order is the one reported; validation runs before "no file given", before any read and before any write.
- Messages are verbatim from the spec's [§2](refuse-unrecognised-and-misplaced-cli-options-spec.md#2-the-surface) and behaviour table. The `usage:` strings for `check`, `fmt`, `infer`, `eval` and `explain` do not change; `ref` gains `usage: visimark ref [NAME] [--json]`.
- `--json` is recognised by the exact token anywhere in the arguments. `--json=true` is not `--json`.
- Correct invocations behave byte-for-byte as before, including `--scenario` output and scenario content faults (`SCENARIO`).
- Never delete or weaken a test to get green: the three tests that pin ignoring are rewritten to assert the refusal.
- Work on branch `issue/121-refuse-unrecognised-and-misplaced-cli-options-impl` (draft PR #135); do not open a new PR.
- Every commit's message body ends with the `Co-Authored-By` trailer from [`.claude/rules/ai-attribution.md`](../../.claude/rules/ai-attribution.md) for the agent writing the commit. Do not copy a trailer out of this plan or an earlier commit.
- Fixtures: `docs/example-invoice.md` (passes `check`) and `docs/example-invoice-drift.md` (fails it). Tests that write use temp copies, never the originals.

---

### Task 1: the argument parser, `src/cli/args.ts`

**Files:**
- Create: `packages/visimark/src/cli/args.ts`
- Test: `packages/visimark/test/cli/args.test.ts`

**Interfaces:**
- Consumes: `closest` from `../report/levenshtein.js`; `CommandName` from `../report/json.js`.
- Produces:

```ts
export interface Parsed {
  files: string[];
  flags: Set<string>;               // "json", "fix-dates", "write"
  options: Map<string, string>;     // "get", "scenario" -> value (never empty)
  sheets: string[];                 // #sheet arguments, without the '#'
}
export interface Refusal {
  ok: false;
  message: string;                  // the first stderr line, and error.message
  usage?: string;                   // second stderr line, only for --help / -h
  json: boolean;                    // the exact token --json was present
}
export function parseArgs(command: CommandName, args: string[]): { ok: true; parsed: Parsed } | Refusal;
export function usageLine(command: CommandName): string;
```

- [ ] **Step 1: Write the failing tests**

Create `packages/visimark/test/cli/args.test.ts`. Table-driven: one array of `[command, args, message]` refusals and one of accepted invocations.

```ts
import { describe, expect, test } from "bun:test";
import { parseArgs, usageLine } from "../../src/cli/args.js";
import type { CommandName } from "../../src/report/json.js";

const REFUSED: [CommandName, string[], string][] = [
  ["check", ["a.md", "--jsonn"], "visimark: unknown option --jsonn — did you mean `--json`?"],
  ["check", ["a.md", "--format", "yaml"], "visimark: unknown option --format"],
  ["check", ["a.md", "--fix-dates"], "visimark: --fix-dates is only valid with fmt"],
  ["fmt", ["a.md", "--write"], "visimark: --write is only valid with infer"],
  ["check", ["a.md", "--get", "vat"], "visimark: --get is only valid with eval"],
  ["check", ["a.md", "--scenario", "s.json"], "visimark: --scenario is only valid with eval"],
  ["check", ["a.md", "--json=true"], "visimark: unknown option --json=true — `--json` takes no value"],
  ["eval", ["a.md", "--get=vat"], "visimark: unknown option --get=vat — write `--get vat`"],
  ["check", ["a.md", "-j"], "visimark: unknown option -j"],
  ["check", ["a.md", "--"], "visimark: unknown option -- — to name a file that starts with -, write ./-name"],
  ["check", ["a.md", "#lines"], "visimark: #lines is only valid with explain"],
  ["eval", ["a.md", "b.md"], "visimark: eval takes one file"],
  ["explain", ["a.md", "b.md"], "visimark: explain takes one file"],
  ["ref", ["SUM", "MAX"], "visimark: ref takes one name"],
  ["eval", ["a.md", "--get"], "visimark: --get needs a name"],
  ["eval", ["a.md", "--get", ""], "visimark: --get needs a name"],
  ["eval", ["a.md", "--get", "--json"], "visimark: --get needs a name"],
  ["eval", ["a.md", "--scenario"], "visimark: --scenario needs a file, or - for stdin"],
  ["eval", ["a.md", "--scenario", "--json"], "visimark: --scenario needs a file, or - for stdin"],
];

const ACCEPTED: [CommandName, string[]][] = [
  ["check", ["a.md", "b.md", "--json"]],
  ["fmt", ["a.md", "--fix-dates", "--json"]],
  ["infer", ["a.md", "--write"]],
  ["eval", ["a.md", "--get", "vat", "--json"]],
  ["eval", ["a.md", "--scenario", "-"]],
  ["explain", ["a.md", "#lines", "#recon"]],
  ["ref", []],
  ["ref", ["SUM", "--json"]],
];

describe("parseArgs refuses", () => {
  for (const [command, args, message] of REFUSED) {
    test(`${command} ${JSON.stringify(args)}`, () => {
      const r = parseArgs(command, args);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(message);
    });
  }

  test("the first violation in argv order wins", () => {
    const r = parseArgs("eval", ["a.md", "b.md", "--bogus"]);
    expect(!r.ok && r.message).toBe("visimark: eval takes one file");
    const s = parseArgs("check", ["--bogus", "--fix-dates"]);
    expect(!s.ok && s.message).toBe("visimark: unknown option --bogus");
  });

  test("--json is detected by the exact token; --json=true is not it", () => {
    const a = parseArgs("check", ["a.md", "--jsonn", "--json"]);
    expect(!a.ok && a.json).toBe(true);
    const b = parseArgs("check", ["a.md", "--json=true"]);
    expect(!b.ok && b.json).toBe(false);
  });

  test("--help and -h add the command's usage line; other refusals do not", () => {
    for (const flag of ["--help", "-h"]) {
      const r = parseArgs("check", ["a.md", flag]);
      expect(!r.ok && r.message).toBe(`visimark: unknown option ${flag}`);
      expect(!r.ok && r.usage).toBe("usage: visimark check FILE...");
    }
    const ref = parseArgs("ref", ["--help"]);
    expect(!ref.ok && ref.usage).toBe("usage: visimark ref [NAME] [--json]");
    const other = parseArgs("check", ["a.md", "--jsonn"]);
    expect(!other.ok && other.usage).toBeUndefined();
  });
});

describe("parseArgs accepts", () => {
  for (const [command, args] of ACCEPTED) {
    test(`${command} ${JSON.stringify(args)}`, () => {
      expect(parseArgs(command, args).ok).toBe(true);
    });
  }

  test("it returns what the commands read", () => {
    const r = parseArgs("eval", ["a.md", "--get", "vat", "--scenario", "-", "--json"]);
    if (!r.ok) throw new Error(r.message);
    expect(r.parsed.files).toEqual(["a.md"]);
    expect(r.parsed.options.get("get")).toBe("vat");
    expect(r.parsed.options.get("scenario")).toBe("-");
    expect(r.parsed.flags.has("json")).toBe(true);
    const e = parseArgs("explain", ["a.md", "#lines"]);
    if (!e.ok) throw new Error(e.message);
    expect(e.parsed.sheets).toEqual(["lines"]);
  });

  test("a lone - is a file, as today", () => {
    const r = parseArgs("check", ["-"]);
    if (!r.ok) throw new Error(r.message);
    expect(r.parsed.files).toEqual(["-"]);
  });
});

test("usageLine returns the strings the commands print today", () => {
  expect(usageLine("fmt")).toBe("usage: visimark fmt FILE... [--fix-dates]");
  expect(usageLine("eval")).toBe(
    "usage: visimark eval FILE [--scenario FILE|-] [--get NAME] [--json]",
  );
});
```

- [ ] **Step 2: Run to see it fail** — `bun test packages/visimark/test/cli/args.test.ts` fails with "Cannot find module '../../src/cli/args.js'".

- [ ] **Step 3: Implement `src/cli/args.ts`**

```ts
import { closest } from "../report/levenshtein.js";
import type { CommandName } from "../report/json.js";

export interface Parsed {
  files: string[];
  flags: Set<string>;
  options: Map<string, string>;
  sheets: string[];
}
export interface Refusal {
  ok: false;
  message: string;
  usage?: string;
  json: boolean;
}

const USAGE: Record<CommandName, string> = {
  check: "usage: visimark check FILE...",
  fmt: "usage: visimark fmt FILE... [--fix-dates]",
  infer: "usage: visimark infer FILE... [--write]",
  eval: "usage: visimark eval FILE [--scenario FILE|-] [--get NAME] [--json]",
  explain: "usage: visimark explain FILE [#sheet]",
  ref: "usage: visimark ref [NAME] [--json]",
};

export function usageLine(command: CommandName): string {
  return USAGE[command];
}

const ALL: readonly CommandName[] = ["check", "fmt", "infer", "eval", "explain", "ref"];

interface OptionSpec {
  commands: readonly CommandName[];
  value: boolean;
  needsValue?: string;
}

const OPTIONS: Record<string, OptionSpec> = {
  "--json": { commands: ALL, value: false },
  "--fix-dates": { commands: ["fmt"], value: false },
  "--write": { commands: ["infer"], value: false },
  "--get": { commands: ["eval"], value: true, needsValue: "visimark: --get needs a name" },
  "--scenario": {
    commands: ["eval"],
    value: true,
    needsValue: "visimark: --scenario needs a file, or - for stdin",
  },
};

function unknownOption(token: string, command: CommandName): string {
  if (token === "--") {
    return "visimark: unknown option -- — to name a file that starts with -, write ./-name";
  }
  const eq = token.indexOf("=");
  if (eq > 0) {
    const name = token.slice(0, eq);
    const spec = OPTIONS[name];
    if (spec?.commands.includes(command)) {
      const hint = spec.value ? `write \`${name} ${token.slice(eq + 1)}\`` : `\`${name}\` takes no value`;
      return `visimark: unknown option ${token} — ${hint}`;
    }
  }
  const mine = Object.keys(OPTIONS).filter((o) => OPTIONS[o]!.commands.includes(command));
  const guess = token.startsWith("--") ? closest(token, mine, 3) : null;
  return `visimark: unknown option ${token}` + (guess ? ` — did you mean \`${guess}\`?` : "");
}

export function parseArgs(
  command: CommandName,
  args: string[],
): { ok: true; parsed: Parsed } | Refusal {
  const json = args.includes("--json");
  const refuse = (message: string, usage = false): Refusal => ({
    ok: false,
    message,
    ...(usage ? { usage: USAGE[command] } : {}),
    json,
  });
  const files: string[] = [];
  const flags = new Set<string>();
  const options = new Map<string, string>();
  const sheets: string[] = [];
  const maxFiles = command === "eval" || command === "explain" || command === "ref" ? 1 : Infinity;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("#")) {
      if (command !== "explain") return refuse(`visimark: ${a} is only valid with explain`);
      sheets.push(a.slice(1));
    } else if (a.startsWith("-") && a !== "-") {
      const spec = OPTIONS[a];
      if (!spec) return refuse(unknownOption(a, command), a === "--help" || a === "-h");
      if (!spec.commands.includes(command)) {
        return refuse(`visimark: ${a} is only valid with ${spec.commands[0]}`);
      }
      if (spec.value) {
        const v = args[i + 1];
        if (v === undefined || v === "" || v.startsWith("--")) return refuse(spec.needsValue!);
        options.set(a.slice(2), v);
        i++;
      } else {
        flags.add(a.slice(2));
      }
    } else {
      if (files.length >= maxFiles) {
        return refuse(command === "ref" ? "visimark: ref takes one name" : `visimark: ${command} takes one file`);
      }
      files.push(a);
    }
  }
  return { ok: true, parsed: { files, flags, options, sheets } };
}
```

`OPTIONS[a]` is safe against prototype keys because `a` always starts with `-`.

- [ ] **Step 4: Run** `bun test packages/visimark/test/cli/args.test.ts` — all pass. Then `bun run typecheck` and `bun run lint` — clean.

- [ ] **Step 5: Commit** — `git add packages/visimark/src/cli/args.ts packages/visimark/test/cli/args.test.ts`; message `feat(cli): argument parser that refuses unknown and misplaced options (#121)` with the trailer.

---

### Task 2: wire the commands, and pin the behaviour at the CLI

**Files:**
- Modify: `packages/visimark/src/cli/commands.ts`
- Create: `packages/visimark/test/cli/options.test.ts`
- Modify (rewrite, not delete): `packages/visimark/test/cli/cli.test.ts:123`, `packages/visimark/test/cli/json.test.ts:103`, `packages/visimark/test/cli/ref.test.ts:75`
- Modify: `packages/visimark/test/cli/scenario.test.ts` (the misplaced-`--scenario` and no-value tests)

**Interfaces:**
- Consumes: `parseArgs`, `usageLine`, `Refusal` from `./args.js`; existing `emitJson`, `errorEnvelope`, `CommandName`.
- Produces: `cmdCheck`, `cmdFmt`, `cmdInfer`, `cmdEval`, `cmdExplain`, `cmdRef` refuse per the spec; `refuse(command, r, out, err): 2` in `commands.ts`.

- [ ] **Step 1: Write the failing CLI tests.** Create `packages/visimark/test/cli/options.test.ts` with the `capture()` helper from `ref.test.ts` and these cases, each asserting `exit`, `stdout` and `stderr` exactly:
  - one table-driven `for` over **every row of the spec's [§4](refuse-unrecognised-and-misplaced-cli-options-spec.md#4-behaviour-table) refusal rows**, with `invoice.md` = `docs/example-invoice.md` and `drift.md` = a temp copy of `docs/example-invoice-drift.md`; expected stdout is `""`, exit `2`, stderr the row's message (two lines for `--help`);
  - `check invoice.md --jsonn --json`: exit `2`; `JSON.parse(stdout)` is `{ command: "check", status: "error", error: { code: "USAGE", message: <the stderr line> } }` and `visimark` equals the package version;
  - the same for `eval invoice.md --get --json`, `ref SUM --jsonn --json` (`command: "ref"`), and `eval invoice.md --scenario --json` (`USAGE`, not `SCENARIO`);
  - `check invoice.md --json=true`: exit `2`, stdout `""` (no envelope);
  - atomicity: `fmt <drift copy> --bogus` exits `2` and the file's bytes equal its bytes before; `fmt <drift copy> --write --fix-dates` likewise (a refusal after a valid option still touches nothing);
  - ordering: `check missing.md --jsonn` reports the option, not `cannot read`; `check --jsonn` reports the option, not the usage line;
  - unchanged, each asserting the same exit and stdout as before this change: `check invoice.md --json` (`0`), `infer <copy> --write`, `eval invoice.md --get vat --json`, `explain invoice.md '#lines' '#recon'` (`0`), `fmt <drift copy> --fix-dates`, and command-position `--version`, `--help`, and an unknown command (`visimark: unknown command …`, exit `2`).

  Rewrite the three pinned tests so each asserts the refusal:

```ts
// cli.test.ts:123
test("an unrecognised flag is refused with exit 2", async () => {
  const c = capture();
  expect(await runCli(["check", cleanPath, "--require-formulas"], c.io)).toBe(2);
  expect(c.err()).toBe("visimark: unknown option --require-formulas");
  expect(c.out()).toBe("");
});
```

  `json.test.ts:103` becomes "check FILE --jsonn is refused: stderr line, exit 2, no report" (`c.err()` is `` visimark: unknown option --jsonn — did you mean `--json`? ``, `c.out()` is `""`). `ref.test.ts:75` becomes "ref SUM --jsonn is refused" with the same message and exit `2`.

  In `scenario.test.ts`: the loop asserting `--scenario` is refused on `check`, `fmt`, `infer`, `explain` changes its `--json` expectation from `code: "SCENARIO"` to `code: "USAGE"`; the "no value is a usage error" test also parses the `--json` case and asserts `USAGE`. Content faults (`SCENARIO`, the width and JSON-number tests) do not change.

- [ ] **Step 2: Run** `bun test packages/visimark/test/cli` — the new and rewritten tests fail (options still ignored); nothing else regresses yet.

- [ ] **Step 3: Wire `commands.ts`.**
  1. Delete the private `Parsed` interface and `parseArgs`, the `SCENARIO_ONLY_EVAL` constant and `refuseScenario`. Import `{ parseArgs, usageLine, type Refusal }` from `./args.js`.
  2. Add:

```ts
function refuse(command: CommandName, r: Refusal, out: Writer, err: Writer): 2 {
  err(r.message);
  if (r.usage) err(r.usage);
  if (r.json) emitJson(out, errorEnvelope(command, "USAGE", r.message));
  return 2;
}
```

  3. In each command, replace `const parsed = parseArgs(args); if (refuseScenario(...)) return 2;` with:

```ts
const p = parseArgs("check", args);
if (!p.ok) return refuse("check", p, out, err);
const parsed = p.parsed;
```

     (`cmdEval` destructures `{ files, flags, options }` from `p.parsed`.) Use the command's own name each time.
  4. Replace each inline `const msg = "usage: visimark …"` with `usageLine("<command>")`. `ref` has none today and needs none.
  5. In `cmdEval`, delete the `if (scenarioFile === "") throw new ScenarioError("visimark: --scenario needs a file, or - for stdin")` branch: the parser now refuses a missing value.
  6. `cmdEval`'s `--get` block is unchanged: `no value named X` is still its own `USAGE`.

- [ ] **Step 4: Run** `bun test`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run build`. All green, including the untouched CLI suites. Then run the repo's own documents through the branch build:
  `bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md docs/tutorial.md docs/ci.md docs/cli-reference.md` exits `0`.

- [ ] **Step 5: Commit** — message `feat(cli): refuse unrecognised and misplaced options, exit 2 (#121)` with the trailer.

---

### Task 3: documentation

**Files:** every file in the spec's [§7](refuse-unrecognised-and-misplaced-cli-options-spec.md#7-documentation-to-update).

- [ ] **Step 1: `docs/cli-reference.md`.** Add an accepted-options table (command → options, the table in the spec's §2) above the options table. In the `--json` row, drop "Unrecognised flags stay ignored, so `--jsonn` is not `--json`." Replace the paragraph beginning "Unrecognised options are ignored" (lines 53–57) with: "Every command refuses an option it does not accept, whether unknown (``visimark: unknown option --jsonn — did you mean `--json`?``) or belonging to another command (`visimark: --write is only valid with infer`), and refuses extra file arguments. The refusal is exit `2`, comes before any file is read or written, and under `--json` is a `USAGE` envelope." In the `--scenario` row, "Every other command refuses `--scenario` with exit `2`" stays true; remove nothing else. In the exit `2` row add "an option the command does not accept".
- [ ] **Step 2: `docs/ci.md`.** Rewrite the "About `--jsonn`" section (lines ~733–741) to say a typo is now exit `2` with a did-you-mean, keeping the advice to check the exit code; replace the troubleshooting row at ~1179 with "A step fails with `unknown option` | A misspelled or misplaced option | Read the message: it names the option and the command that owns it"; in the `args` row (~273) add "each option must be valid for `command`".
- [ ] **Step 3: `docs/tutorial.md`.** Rewrite the paragraph near line 1808 the same way.
- [ ] **Step 4: `docs/visimark-design.md` §11.** After the `--json` paragraph add a paragraph stating the rule (unknown or misplaced option, or extra positional: exit `2`, before any file is touched, `USAGE` under `--json`); fold the sentence "`--scenario` is valid only with `eval`: every other command refuses it…" into it, keeping the §20 link.
- [ ] **Step 5: `docs/design/structured-output-json-spec.md`.** Lines 58–60: replace "Unknown flags stay ignored…" with a pointer to the new spec ("unknown flags are refused, see `refuse-unrecognised-and-misplaced-cli-options-spec.md`"). Test rows 388–389: `check file.md --jsonn` → "refused: exit 2, `unknown option --jsonn`"; extra files to `eval` / `explain` → "refused: `eval takes one file`". Row 401: a misplaced `--scenario` is `USAGE`; `SCENARIO` is content faults only. Line 429: remove "ignore-unknown-flags". Line 494: "ignore of `--jsonn`" → "refusal of `--jsonn`". Line 509: strike the non-goal and note that the change is decided in #121. Leave line 24 (history).
- [ ] **Step 6: `docs/design/scenario-params-spec.md`.** §5.3 (line ~322): replace the "deliberate exception… if it lands, this becomes one case of it" bullet with one saying `--scenario` on another command is refused like any misplaced option (#121). Line ~492 non-goal: mark it decided by #121. Row ~264 and §4.2: a `--scenario` with no value, and a misplaced one, are `USAGE`; `SCENARIO` is a fault in the file's content.
- [ ] **Step 7: `action.yml`.** `args` description: "Extra flags for the command; each must be valid for `command`, e.g. `--fix-dates` for `fmt`." The `version` default is bumped by the release commit, not here.
- [ ] **Step 8: `CHANGELOG.md`** under `## Unreleased`: a `### Changed` heading with the migration note from the spec's [§5](refuse-unrecognised-and-misplaced-cli-options-spec.md#5-compatibility) verbatim, linking [#121](https://github.com/michal-niedzwiedzki/visimark/issues/121).
- [ ] **Step 9: Catalogue.** Remove the `Refuse unrecognised and misplaced CLI options` row from section F and append to the Shipped register:

```
| Refuse unrecognised and misplaced CLI options | tooling | [#121](https://github.com/michal-niedzwiedzki/visimark/issues/121) | [#135](https://github.com/michal-niedzwiedzki/visimark/pull/135) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/121#issuecomment-5758855875) |
```

- [ ] **Step 10: Sweep.** `grep -rniE "unrecogni[sz]ed|unknown (option|flag)|ignored" docs README.md CONTRIBUTING.md skills .claude` and read every hit against the new behaviour; historical plans (`structured-output-json-plan.md`, `function-reference-plan.md`) stay as a record. Confirm `.claude/commands/*` and `.github/workflows/*` pass only valid options.
- [ ] **Step 11: Verify.** `bun run format:check`, then `bun run packages/visimark/src/cli/main.ts check` on every file the `dogfood` workflow lists (`.github/workflows/dogfood.yml`, the `files:` input) exits `0`; `bun test`, `bun run typecheck`, `bun run lint`, `bun run build` green.
- [ ] **Step 12: Commit** — message `docs: refuse unrecognised and misplaced CLI options (#121)` with the trailer. `editors/vscode/CHANGELOG.md` is not touched: the extension uses the engine, not the CLI.
