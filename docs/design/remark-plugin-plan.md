# A remark plugin wrapping visimark check — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a new package, `remark-lint-visimark`, exposing a `unified`/`remark` plugin that runs `visimark check` over a document already inside a host's `remark`/`remark-lint` pipeline and reports findings as `VFile` messages.

**Architecture:** A thin translation layer. The plugin ignores the host's parsed `tree` and re-parses `file.value` through the engine's already-public `analyze(source)`, then maps each `Finding` with a `span` to one `file.message()` call, using one new small engine export (`describeFinding`) to render a one-line reason and the finding's `code` to derive a stable `ruleId`. No new parse-entry-point surface, no engine change to `check`, `fmt`, or any CLI command.

**Tech Stack:** TypeScript, Bun (build/test), `unified`/`mdast` types (dev-only — the published package has no runtime dependency on `unified`), `visimark` (runtime dependency, exact version pin).

**Spec:** [`docs/design/remark-plugin-spec.md`](remark-plugin-spec.md)

## Global Constraints

- Commit trailer: resolve `Co-Authored-By:` from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) at commit time — never hardcode a vendor name in a step's example command.
- v1's `remarkLintVisimark()` takes **no arguments** and exposes no configuration surface (spec §2.1, §8).
- `Position` reports `{ line }` only — no column (spec §3).
- `ruleId` is `` `visimark-${code.toLowerCase()}` ``, `source` is always `"visimark"`, both packed into `file.message()`'s third argument as `` `visimark:${ruleId}` `` (spec §2.1, §3).
- `.fatal` is `true` for a finding where `isProblem(f)` is true, `undefined` otherwise (spec §3).
- A finding with no `span` is never turned into a `file.message()` call (spec §3, §4).
- Package: npm name `remark-lint-visimark`, directory `packages/remark-visimark`, dependency on `visimark` is an **exact** version pin (`"0.1.7"`, not a caret range) — never `workspace:*` (spec §2.1, §5).
- No autofix, no pre-parsed-tree entry point, no rule-options parameter — all closed for this version, not deferred as maybes (spec §8).
- `formatCheck` (`packages/visimark/src/report/format.ts`) is not modified — `describeFinding` is a new, separate export alongside it, not a refactor of it.

## Review Focus

- **An empty document / one with no `vmark` blocks at all.** `analyze()` must return zero findings and the plugin must call `file.message()` zero times — not throw, not emit a spurious message. (Task 2)
- **The plugin registered twice on the same pipeline** (`.use(remarkLintVisimark).use(remarkLintVisimark)`, or via two presets that both include it). Each registration independently re-parses and re-emits — a consumer sees every finding twice. This is a real, easy-to-trigger misconfiguration once the package is in a shared preset; pin the doubled-message behavior explicitly rather than leave it implicit. (Task 2)
- **`file.value` as a `Buffer`, not a `string`** — a document loaded from disk via `to-vfile`/`vfile` commonly carries `Buffer` content before a reader decodes it. `String(file.value)` must still work. (Task 2)
- **A `CYCLE` finding.** Its `span` comes from the *first binding in the cycle* (`packages/visimark/src/eval/check-report.ts`), not from the finding object having its own independently-set span — an implementation that assumes every finding's `span` is set the same way could still pass the simpler STALE/ASSERT tests while mishandling this one. (Task 1 for `describeFinding`, Task 2 for the end-to-end message)
- **A finding whose text comes from `f.message` verbatim with a `suggestion` appended** (`UNDEF`'s did-you-mean, `WARN`'s did-you-mean). Easy to implement the base sentence and forget the conditional suffix. (Task 1)

---

### Task 1: `describeFinding` — a one-line reason string per finding

**Files:**
- Modify: `packages/visimark/src/report/format.ts` (add `describeFinding`, alongside the existing `formatCheck`; no change to `formatCheck` or its helpers)
- Modify: `packages/visimark/src/index.ts` (re-export `describeFinding`)
- Test: `packages/visimark/test/report/describe-finding.test.ts` (new file)

**Interfaces:**
- Produces: `describeFinding(f: Finding): string` — a single-line, plain-English sentence for one finding, with no column padding and no ANSI. Exported from `packages/visimark/src/index.ts` alongside `formatCheck`.
- Consumes: `Finding` (`packages/visimark/src/model/types.ts`, already public).

- [ ] **Step 1: Write the failing tests**

Create `packages/visimark/test/report/describe-finding.test.ts`:

```ts
import { expect, test } from "bun:test";
import { describeFinding } from "../../src/report/format.js";
import type { Finding } from "../../src/model/types.js";

test("STALE, plain cell, with formula", () => {
  const f: Finding = {
    code: "STALE",
    sheetId: "lines",
    name: "Net",
    stored: "3120.00",
    computed: "5200.00",
    formula: "Qty * Rate",
  };
  expect(describeFinding(f)).toBe("lines.Net: stored 3120.00 ≠ computed 5200.00 (Qty * Rate)");
});

test("STALE, plain cell, no formula", () => {
  const f: Finding = { code: "STALE", sheetId: "s", name: "n", stored: "1", computed: "2" };
  expect(describeFinding(f)).toBe("s.n: stored 1 ≠ computed 2");
});

test("STALE, table-row cell with a row label", () => {
  const f: Finding = {
    code: "STALE",
    sheetId: "lines",
    name: "Net",
    rowLabel: "pen",
    stored: "9.99",
    computed: "10.00",
    formula: "Qty * Rate",
  };
  expect(describeFinding(f)).toBe("lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)");
});

test("STALE, artifact — f.message verbatim", () => {
  const f: Finding = { code: "STALE", artifact: "chart.svg", message: "chart.svg is stale; run `visimark fmt`" };
  expect(describeFinding(f)).toBe("chart.svg is stale; run `visimark fmt`");
});

test("ASSERT", () => {
  const f: Finding = {
    code: "ASSERT",
    sheetId: "calls",
    source: "assert spent <= rates.budget",
    message: "0.4266 <= 0.01",
  };
  expect(describeFinding(f)).toBe("assert spent <= rates.budget: 0.4266 <= 0.01 is false");
});

test("DATE, unambiguous fix", () => {
  const f: Finding = { code: "DATE", raw: "15.10.2026", isoFix: "2026-10-15" };
  expect(describeFinding(f)).toBe(
    '"15.10.2026" is not an ISO 8601 date (YYYY-MM-DD); unambiguous fix is 2026-10-15',
  );
});

test("DATE, ambiguous", () => {
  const f: Finding = { code: "DATE", raw: "03/04/2026", altA: "2026-03-04", altB: "2026-04-03", daysApart: 30 };
  expect(describeFinding(f)).toBe(
    '"03/04/2026" is not an ISO 8601 date (YYYY-MM-DD); ambiguous: 2026-03-04 or 2026-04-03, 30 days apart',
  );
});

test("UNDEF, with suggestion", () => {
  const f: Finding = { code: "UNDEF", raw: "rats.budget", suggestion: "rates.budget" };
  expect(describeFinding(f)).toBe("unknown name `rats.budget`; did you mean `rates.budget`?");
});

test("UNDEF, no suggestion", () => {
  const f: Finding = { code: "UNDEF", raw: "nope" };
  expect(describeFinding(f)).toBe("unknown name `nope`");
});

test("DUP", () => {
  const f: Finding = { code: "DUP", name: "Net" };
  expect(describeFinding(f)).toBe("`Net` is already defined in this scope");
});

test("VECTOR", () => {
  const f: Finding = { code: "VECTOR", raw: "Cost" };
  expect(describeFinding(f)).toBe("`Cost` is a column, not a value — wrap it in an aggregate");
});

test("CYCLE", () => {
  const f: Finding = { code: "CYCLE", cyclePath: ["a", "b", "a"] };
  expect(describeFinding(f)).toBe("a → b → a");
});

test("WARN, with suggestion", () => {
  const f: Finding = { code: "WARN", sheetId: "s", name: "unused", suggestion: "used" };
  expect(describeFinding(f)).toBe("s.unused is defined and never read — did you mean `used`?");
});

test("WARN, no suggestion", () => {
  const f: Finding = { code: "WARN", sheetId: "s", name: "unused" };
  expect(describeFinding(f)).toBe("s.unused is defined and never read");
});

test("codes that reuse f.message verbatim", () => {
  for (const code of ["UNIT", "SHEET", "IMPORT", "COVERAGE", "ARTIFACT", "TYPE", "ANCHOR", "NOTE"] as const) {
    const f: Finding = { code, message: "a full sentence already" };
    expect(describeFinding(f)).toBe("a full sentence already");
  }
});

test("PRECISION, with message", () => {
  const f: Finding = { code: "PRECISION", message: "no precision declared" };
  expect(describeFinding(f)).toBe("no precision declared");
});

test("PRECISION, fallback with raw", () => {
  const f: Finding = { code: "PRECISION", raw: "3.14159" };
  expect(describeFinding(f)).toBe("`3.14159` has no derivable precision");
});

test("PRECISION, fallback with no raw", () => {
  const f: Finding = { code: "PRECISION" };
  expect(describeFinding(f)).toBe("no precision declared and none follows from the formula");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/visimark && bun test test/report/describe-finding.test.ts`
Expected: FAIL — `describeFinding` is not exported.

- [ ] **Step 3: Implement `describeFinding`**

In `packages/visimark/src/report/format.ts`, append (do not touch `formatCheck` or its existing helpers above it):

```ts
/**
 * A single-line, plain-English sentence for one finding — the same
 * information formatCheck's per-code branches carry, flattened to one line
 * with no column padding. Used by anything that reports a finding outside
 * a fixed-width terminal report (the remark plugin, `remark-lint-visimark`).
 */
export function describeFinding(f: Finding): string {
  switch (f.code) {
    case "STALE":
      if (f.artifact !== undefined) return f.message ?? "";
      return (
        `${f.sheetId ?? ""}.${f.name ?? ""}` +
        (f.rowLabel ? ` (${f.rowLabel})` : "") +
        `: stored ${f.stored ?? ""} ≠ computed ${f.computed ?? ""}` +
        (f.formula ? ` (${f.formula})` : "")
      );
    case "ASSERT":
      return `${f.source ?? ""}: ${f.message ?? ""} is false`;
    case "DATE": {
      const head = `"${f.raw ?? ""}" is not an ISO 8601 date (YYYY-MM-DD)`;
      if (f.isoFix) return `${head}; unambiguous fix is ${f.isoFix}`;
      if (f.altA && f.altB) return `${head}; ambiguous: ${f.altA} or ${f.altB}, ${f.daysApart} days apart`;
      return head;
    }
    case "UNDEF":
      return `unknown name \`${f.raw}\`` + (f.suggestion ? `; did you mean \`${f.suggestion}\`?` : "");
    case "DUP":
      return `\`${f.name}\` is already defined in this scope`;
    case "VECTOR":
      return `\`${f.raw}\` is a column, not a value — wrap it in an aggregate`;
    case "CYCLE":
      return (f.cyclePath ?? []).join(" → ");
    case "WARN":
      return (
        `${f.sheetId ?? ""}.${f.name ?? ""} is defined and never read` +
        (f.suggestion ? ` — did you mean \`${f.suggestion}\`?` : "")
      );
    case "PRECISION":
      return (
        f.message ??
        (f.raw ? `\`${f.raw}\` has no derivable precision` : "no precision declared and none follows from the formula")
      );
    default:
      // UNIT, SHEET, IMPORT, COVERAGE, ARTIFACT, TYPE, ANCHOR, NOTE — format.ts's
      // own renderGroup() branches already treat f.message as a complete sentence.
      return f.message ?? "";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/visimark && bun test test/report/describe-finding.test.ts`
Expected: PASS, all 18 tests.

- [ ] **Step 5: Re-export from the package root**

In `packages/visimark/src/index.ts`, change:

```ts
export { formatCheck } from "./report/format.js";
```

to:

```ts
export { describeFinding, formatCheck } from "./report/format.js";
```

- [ ] **Step 6: Typecheck and run the full engine suite**

Run: `cd packages/visimark && bun run typecheck && bun test`
Expected: PASS, no new errors.

- [ ] **Step 7: Commit**

```bash
git add packages/visimark/src/report/format.ts packages/visimark/src/index.ts packages/visimark/test/report/describe-finding.test.ts
git commit -m "feat(visimark): add describeFinding, a one-line reason per finding

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

---

### Task 2: The `remark-lint-visimark` package

**Files:**
- Create: `packages/remark-visimark/package.json`
- Create: `packages/remark-visimark/tsconfig.json`
- Create: `packages/remark-visimark/tsconfig.build.json`
- Create: `packages/remark-visimark/LICENSE` (copy of the repository root `LICENSE`, verbatim)
- Create: `packages/remark-visimark/README.md`
- Create: `packages/remark-visimark/src/index.ts`
- Test: `packages/remark-visimark/test/plugin.test.ts`

**Interfaces:**
- Consumes: `analyze`, `lineOf`, `isProblem`, `describeFinding` from `visimark` (Task 1's new export plus three already-public ones).
- Produces: `remarkLintVisimark` — default export, a zero-argument `unified` plugin attacher: `() => (tree: Root, file: VFile) => void`. Package name on npm: `remark-lint-visimark`.

- [ ] **Step 1: Scaffold the package manifest**

Create `packages/remark-visimark/package.json`:

```json
{
  "name": "remark-lint-visimark",
  "version": "0.1.7",
  "description": "A unified/remark plugin that runs visimark check over a document and reports findings as VFile messages.",
  "keywords": ["remark-lint", "remark-plugin", "unified", "markdown", "visimark", "lint"],
  "homepage": "https://github.com/michal-niedzwiedzki/visimark#readme",
  "bugs": "https://github.com/michal-niedzwiedzki/visimark/issues",
  "license": "MIT",
  "author": "Michał Niedźwiedzki <michal@epsi.pl>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/michal-niedzwiedzki/visimark.git",
    "directory": "packages/remark-visimark"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "bun": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "bun build src/index.ts --target node --outdir dist && tsc -p tsconfig.build.json",
    "prepublishOnly": "bun run typecheck && bun test && bun run build"
  },
  "dependencies": {
    "visimark": "0.1.7"
  },
  "devDependencies": {
    "@types/mdast": "^4.0.4",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "unified": "^11.0.4"
  }
}
```

`"visimark": "0.1.7"` is an exact pin, not `"^0.1.7"` — the version-agreement check added in Task 3 enforces that this string equals `packages/visimark/package.json`'s own `version` field byte-for-byte, the same way `action.yml`'s pinned default and `scripts/precommit-visimark-check.sh`'s pins are checked today.

- [ ] **Step 2: Scaffold the TypeScript config**

Create `packages/remark-visimark/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "visimark": ["../visimark/src/index.ts"]
    }
  },
  "include": ["src", "test"]
}
```

Create `packages/remark-visimark/tsconfig.build.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Add LICENSE and README**

```bash
cp LICENSE packages/remark-visimark/LICENSE
```

Create `packages/remark-visimark/README.md`:

```markdown
# remark-lint-visimark

A [`unified`](https://unifiedjs.com)/[`remark`](https://remark.js.org) plugin
that runs [`visimark check`](https://github.com/michal-niedzwiedzki/visimark)
over a document already in your `remark`/`remark-lint` pipeline and reports
its findings as `VFile` messages — the same channel `remark-lint` rules
already use.

## Install

```sh
npm install --save-dev remark-lint-visimark
```

## Use

`.remarkrc.json`:

```json
{ "plugins": ["remark-preset-lint-recommended", "remark-lint-visimark"] }
```

or programmatically:

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkLintVisimark from "remark-lint-visimark";

const file = await unified().use(remarkParse).use(remarkLintVisimark).process(vfile);
```

Every VisiMark finding with a source location becomes a `file.message()`
call: `fatal: true` for a stale number or any other check-failing finding,
`fatal` left unset (a warning, visible under `remark --frail`) for advice.
`ruleId` is per finding kind (`visimark-stale`, `visimark-assert`, …),
`source` is `"visimark"`.

This plugin takes no options and performs no autofix — see
[`docs/ci.md`](https://github.com/michal-niedzwiedzki/visimark/blob/master/docs/ci.md)
in the main repository for the full write-up.
```

- [ ] **Step 4: Write the failing plugin tests**

Create `packages/remark-visimark/test/plugin.test.ts`:

```ts
import { expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { VFile } from "vfile";
import remarkLintVisimark from "../src/index.js";

async function run(content: string | Buffer): Promise<VFile> {
  const file = new VFile({ value: content });
  return unified().use(remarkParse).use(remarkLintVisimark).process(file);
}

const clean = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 10.00 |

\`\`\`vmark #s
Net = Qty * Rate
\`\`\`
`;

const stale = `| Item | Qty | Rate |  Net |
|------|----:|-----:|-----:|
| pen  |   2 | 5.00 | 9.99 |

\`\`\`vmark #lines
Net = Qty * Rate
\`\`\`
`;

const failingAssert = `\`\`\`vmark #calls
spent  = 5
budget = 1

assert spent <= budget
\`\`\`
`;

test("clean document produces no messages", async () => {
  const file = await run(clean);
  expect(file.messages).toHaveLength(0);
});

test("a plain STALE cell produces one fatal message with a line and no column", async () => {
  const file = await run(stale);
  expect(file.messages).toHaveLength(1);
  const m = file.messages[0]!;
  expect(m.fatal).toBe(true);
  expect(m.source).toBe("visimark");
  expect(m.ruleId).toBe("visimark-stale");
  expect(m.reason).toBe("lines.Net (pen): stored 9.99 ≠ computed 10.00 (Qty * Rate)");
  expect(m.place).toMatchObject({ line: 3 });
  expect((m.place as { column?: number })?.column).toBeUndefined();
});

test("a failing assert produces one fatal message", async () => {
  const file = await run(failingAssert);
  expect(file.messages).toHaveLength(1);
  const m = file.messages[0]!;
  expect(m.fatal).toBe(true);
  expect(m.ruleId).toBe("visimark-assert");
  expect(m.reason).toBe("assert spent <= budget: 5 <= 1 is false");
});

test("file.value as a Buffer is handled the same as a string", async () => {
  const file = await run(Buffer.from(stale, "utf8"));
  expect(file.messages).toHaveLength(1);
  expect(file.messages[0]!.ruleId).toBe("visimark-stale");
});

test("registering the plugin twice reports every finding twice", async () => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkLintVisimark)
    .use(remarkLintVisimark)
    .process(new VFile({ value: stale }));
  expect(file.messages).toHaveLength(2);
});

test("the host's own parsed tree is ignored — no remark-gfm needed for a table to be seen", async () => {
  // unified().use(remarkParse) alone does not know about GFM tables; the
  // plugin must still find the STALE finding by re-parsing file.value with
  // its own locate(), which applies remark-gfm internally.
  const file = await run(stale);
  expect(file.messages).toHaveLength(1);
});

test("a WARN finding is a non-fatal message", async () => {
  const warn = `\`\`\`vmark #s
unused = 1
\`\`\`
`;
  const file = await run(warn);
  expect(file.messages).toHaveLength(1);
  expect(file.messages[0]!.fatal).toBeUndefined();
  expect(file.messages[0]!.ruleId).toBe("visimark-warn");
});

test("a stale prose anchor's collapsed group finding (no span) is not reported, only the cell it anchors", async () => {
  // A stale scalar bound to a prose anchor produces two findings: the cell's
  // own STALE (has a span) and a collapsed anchorGroup STALE with no span
  // (spec §3, §4) — only the first becomes a file.message().
  const anchored = `\`\`\`vmark #lines
Net = 2 * 5.00
\`\`\`

Net comes to **9.99**<!--vmark=lines.Net-->.
`;
  const file = await run(anchored);
  expect(file.messages).toHaveLength(1);
  expect(file.messages[0]!.ruleId).toBe("visimark-stale");
  expect(file.messages[0]!.reason).toBe("lines.Net: stored 9.99 ≠ computed 10.00");
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `cd packages/remark-visimark && bun test`
Expected: FAIL — `src/index.ts` does not exist yet.

- [ ] **Step 6: Implement the plugin**

Create `packages/remark-visimark/src/index.ts`:

```ts
import { analyze, describeFinding, isProblem, lineOf } from "visimark";
import type { FindingCode } from "visimark";
import type { Plugin } from "unified";
import type { Root } from "mdast";

function ruleId(code: FindingCode): string {
  return `visimark-${code.toLowerCase()}`;
}

const remarkLintVisimark: Plugin<[], Root> = function remarkLintVisimark() {
  return (_tree, file) => {
    const source = String(file.value);
    const { result } = analyze(source);
    for (const finding of result.findings) {
      if (!finding.span) continue; // no single site to attach a Position to
      const line = lineOf(source, finding.span.start);
      const message = file.message(describeFinding(finding), { line }, `visimark:${ruleId(finding.code)}`);
      message.fatal = isProblem(finding) ? true : undefined;
    }
  };
};

export default remarkLintVisimark;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd packages/remark-visimark && bun test`
Expected: PASS, all 8 tests.

- [ ] **Step 8: Typecheck**

Run: `cd packages/remark-visimark && bun run typecheck`
Expected: PASS, no errors.

- [ ] **Step 9: Install and build from the repo root**

```bash
bun install
bun run --filter remark-lint-visimark build
```

Expected: `packages/remark-visimark/dist/index.js` and `dist/index.d.ts` exist.

- [ ] **Step 10: Commit**

```bash
git add packages/remark-visimark
git commit -m "feat: add remark-lint-visimark, a unified plugin wrapping visimark check

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

---

### Task 3: CI version-agreement check and the release publish leg

**Files:**
- Modify: `.github/workflows/ci.yml:26-59` (the "every version-carrying file must agree" step)
- Modify: `.github/workflows/release.yml` (add a publish leg after "Publish the engine to npm")
- Modify: `docs/releasing.md:88-103` ("Bump the version" step)

**Interfaces:**
- Consumes: `packages/remark-visimark/package.json`'s `"version"` and `"dependencies"."visimark"` fields (Task 2).

- [ ] **Step 1: Extend the version-agreement check**

In `.github/workflows/ci.yml`, the "every version-carrying file must agree" step currently reads (after #149's change):

```yaml
      # Five files carry the version and all five must agree. ...
      - name: every version-carrying file must agree
        run: |
          set -e
          engine=$(bun -e 'console.log(require("./packages/visimark/package.json").version)')
          lsp=$(bun -e 'console.log(require("./packages/visimark-lsp/package.json").version)')
          ext=$(bun -e 'console.log(require("./editors/vscode/package.json").version)')
          pinned=$(awk '/^  version:/{f=1} f && /^    default:/{sub(/^    default: *"/,"");sub(/"[[:space:]]*$/,"");print;exit}' action.yml)
          precommit_versions=$(grep -oE 'visimark@[0-9]+\.[0-9]+\.[0-9]+' scripts/precommit-visimark-check.sh | sed 's/^visimark@//' | sort -u)
          precommit_count=$(echo "$precommit_versions" | grep -c .)
          echo "engine=$engine lsp=$lsp vscode=$ext action.yml=$pinned precommit-hook=$precommit_versions"
          if [ -z "$pinned" ]; then
            echo "::error::could not read the version default out of action.yml. The version input or its default line moved; fix this check rather than deleting it."
            exit 1
          fi
          fail=0
          if [ "$precommit_count" != "1" ]; then
            echo "::error file=scripts/precommit-visimark-check.sh::expected exactly one visimark@<version> pin (the bunx and npx branches must agree), found: $(echo "$precommit_versions" | tr '\n' ' ')"
            fail=1
            precommit=""
          else
            precommit=$precommit_versions
          fi
          for pair in "packages/visimark-lsp/package.json:$lsp" "editors/vscode/package.json:$ext" "action.yml:$pinned" "scripts/precommit-visimark-check.sh:$precommit"; do
            file=${pair%%:*}; got=${pair#*:}
            if [ -n "$got" ] && [ "$got" != "$engine" ]; then
              echo "::error file=$file::$file says $got but packages/visimark/package.json says $engine. Bump every version-carrying file in the release commit — see docs/releasing.md."
              fail=1
            fi
          done
          exit $fail
```

Replace it with:

```yaml
      # Seven files/fields carry the version and all seven must agree. ...
      - name: every version-carrying file must agree
        run: |
          set -e
          engine=$(bun -e 'console.log(require("./packages/visimark/package.json").version)')
          lsp=$(bun -e 'console.log(require("./packages/visimark-lsp/package.json").version)')
          ext=$(bun -e 'console.log(require("./editors/vscode/package.json").version)')
          pinned=$(awk '/^  version:/{f=1} f && /^    default:/{sub(/^    default: *"/,"");sub(/"[[:space:]]*$/,"");print;exit}' action.yml)
          precommit_versions=$(grep -oE 'visimark@[0-9]+\.[0-9]+\.[0-9]+' scripts/precommit-visimark-check.sh | sed 's/^visimark@//' | sort -u)
          precommit_count=$(echo "$precommit_versions" | grep -c .)
          remark_version=$(bun -e 'console.log(require("./packages/remark-visimark/package.json").version)')
          remark_dep=$(bun -e 'console.log(require("./packages/remark-visimark/package.json").dependencies.visimark)')
          echo "engine=$engine lsp=$lsp vscode=$ext action.yml=$pinned precommit-hook=$precommit_versions remark-plugin=$remark_version remark-plugin-dep=$remark_dep"
          if [ -z "$pinned" ]; then
            echo "::error::could not read the version default out of action.yml. The version input or its default line moved; fix this check rather than deleting it."
            exit 1
          fi
          fail=0
          if [ "$precommit_count" != "1" ]; then
            echo "::error file=scripts/precommit-visimark-check.sh::expected exactly one visimark@<version> pin (the bunx and npx branches must agree), found: $(echo "$precommit_versions" | tr '\n' ' ')"
            fail=1
            precommit=""
          else
            precommit=$precommit_versions
          fi
          for pair in "packages/visimark-lsp/package.json:$lsp" "editors/vscode/package.json:$ext" "action.yml:$pinned" "scripts/precommit-visimark-check.sh:$precommit" "packages/remark-visimark/package.json (version):$remark_version" "packages/remark-visimark/package.json (visimark dep):$remark_dep"; do
            file=${pair%%:*}; got=${pair#*:}
            if [ -n "$got" ] && [ "$got" != "$engine" ]; then
              echo "::error file=$file::$file says $got but packages/visimark/package.json says $engine. Bump every version-carrying file in the release commit — see docs/releasing.md."
              fail=1
            fi
          done
          exit $fail
```

- [ ] **Step 2: Add the release publish leg**

In `.github/workflows/release.yml`, immediately after the `Publish the engine to npm` step, add:

```yaml
      - name: Publish the remark plugin to npm
        id: remark-plugin
        continue-on-error: true
        working-directory: packages/remark-visimark
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          if npm view "remark-lint-visimark@$ENGINE_VERSION" version >/dev/null 2>&1; then
            echo "remark-lint-visimark@$ENGINE_VERSION is already on npm; skipping."
          else
            npm publish --provenance --access public
          fi
```

Find the job's final "every leg must have landed" step (the one that turns any recorded `continue-on-error` failure back into a failed job) and add `steps.remark-plugin.outcome` to whatever list of leg outcomes it already checks, in the same form as the existing `steps.npm.outcome` entry.

- [ ] **Step 3: Update the release checklist**

In `docs/releasing.md`, replace the "Bump the version" step's file list:

```
   packages/visimark/package.json
   packages/visimark-lsp/package.json
   editors/vscode/package.json
   action.yml                                # the `version` input's default
   scripts/precommit-visimark-check.sh       # both visimark@ pins inside it
```

with:

```
   packages/visimark/package.json
   packages/visimark-lsp/package.json
   editors/vscode/package.json
   action.yml                                # the `version` input's default
   scripts/precommit-visimark-check.sh       # both visimark@ pins inside it
   packages/remark-visimark/package.json     # its own version AND its visimark dependency pin
```

and update the surrounding prose's "all five" / "in the list" wording to "all six" / "seven values" (the `remark-visimark` manifest contributes two: its own version and its `visimark` dependency), keeping the sentence about `ci.yml`'s check being the confirmation.

- [ ] **Step 4: Run the local checks**

Run: `bun install && bun run typecheck && bun run build && bun test`
Expected: PASS. (The version-agreement step itself only runs in CI, but confirm the `bun -e require(...)` lines are valid by running them locally: `bun -e 'console.log(require("./packages/remark-visimark/package.json").version)'` should print `0.1.7`.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml docs/releasing.md
git commit -m "chore: track the remark plugin package in the version-agreement check and release workflow

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

---

### Task 4: Documentation

**Files:**
- Modify: `docs/ci.md` (new chapter 24, renumbering the existing 24→25, 25→26, 26→27)
- Modify: `README.md` (one sentence in "In CI")
- Modify: `CHANGELOG.md` (`## Unreleased` → `### Added`)
- Modify: `docs/vocabulary-catalogue.md` (move the #152 row from section F into the Shipped register as `UNRELEASED`)

**Interfaces:** none — this task touches no code.

- [ ] **Step 1: Renumber `docs/ci.md`'s trailing chapters**

Confirmed against the working tree: no other file references `docs/ci.md`'s chapter numbers by number (`docs/tutorial.md`'s own "chapter 24/26" mentions are that document's *own*, independent 1–30 numbering — unrelated). Renumber in place, editing only the heading lines:

```
## 24. Turning it on in a repository that already has documents   →   ## 25. Turning it on in a repository that already has documents
## 25. Troubleshooting                                             →   ## 26. Troubleshooting
## 26. The checklist                                                →   ## 27. The checklist
```

- [ ] **Step 2: Insert the new chapter**

Insert, immediately after chapter 23 ("Git hooks and pre-commit") and before the `# Part 7 — Rolling it out` divider:

```markdown
## 24. The `remark`/`unified` plugin

A project already running [`remark`](https://remark.js.org)/`remark-lint` —
Docusaurus, Astro, or any other `unified`-based Markdown toolchain — adds
VisiMark findings to that same pipeline with `remark-lint-visimark`:

```json
{ "plugins": ["remark-preset-lint-recommended", "remark-lint-visimark"] }
```

```console
$ npx remark docs/ --frail
docs/quote.md
  12:1  error  0.4266 <= 2.00 is false  visimark-assert  visimark

1 error
$ echo $?
1
```

`--frail` is `remark-cli`'s own flag, not this plugin's: a `STALE` cell or any
other check-failing finding is always fatal and fails a plain `remark` run;
advisory findings (`WARN`, `NOTE`) are reported but only fail the run under
`--frail`, the same severity split `check`'s own exit code already uses.

The plugin takes no options, reports a line but no column, and does no
autofix — see the package's own
[README](https://github.com/michal-niedzwiedzki/visimark/tree/master/packages/remark-visimark)
for the full contract. Like the other entries in this part, it only ever runs
`check`; `fmt`, `infer`, `explain`, `eval` and `--json` are unaffected and
unavailable through it.
```

- [ ] **Step 3: One sentence in the README**

In `README.md`'s "In CI" section, immediately after the existing composite-Action paragraph (the one ending "...the decision is about a document, not about a CI run."), add:

```markdown
A project already on `remark`/`remark-lint` adds the same checks with
[`remark-lint-visimark`](https://www.npmjs.com/package/remark-lint-visimark)
instead — see [`docs/ci.md` chapter 24](docs/ci.md#24-the-remarkunified-plugin).
```

- [ ] **Step 4: Changelog**

In `CHANGELOG.md`, under `## Unreleased`, add:

```markdown
### Added

- A `remark`/`unified` plugin, `remark-lint-visimark`, reports `visimark check`
  findings as `VFile` messages inside an existing `remark`/`remark-lint`
  pipeline. See [`remark-plugin-spec.md`](docs/design/remark-plugin-spec.md)
  and [#152](https://github.com/michal-niedzwiedzki/visimark/issues/152).
```

- [ ] **Step 5: Move the catalogue row to the Shipped register**

In `docs/vocabulary-catalogue.md`, delete the section-F row whose Request cell links `#152` (added by the catalogue PR, `Status` currently `[APPROVED](...)`), and add this row to the **Shipped** table, in issue-number order among its neighbors:

```
| A `remark`/`unified` plugin wrapping `visimark check` (`remark-lint-visimark`) | tooling | [#152](https://github.com/michal-niedzwiedzki/visimark/issues/152) | [#159](https://github.com/michal-niedzwiedzki/visimark/pull/159) | — | [APPROVED](https://github.com/michal-niedzwiedzki/visimark/issues/152#issuecomment-5781287493) |
```

(`Landed` links this implementation PR; `Released` stays `—` until the next tagged release ships it, per the `UNRELEASED` → `SHIPPED` flow `docs/releasing.md` already automates.)

Before editing, run `git fetch origin && git merge origin/master` (or rebase) on this branch first if `docs/vocabulary-catalogue.md` has moved on `master` since this branch was created — the file has an active section-F table other issues also land rows in, so this step must edit the current tip, not a stale copy.

- [ ] **Step 6: Full local verification**

Run, from the repo root:
```bash
bun install
bun run typecheck
bun run build
bun test
bun run packages/visimark/src/cli/main.ts check docs/example-invoice.md
bun run packages/visimark/src/cli/main.ts check docs/example-agent-budget.md
```
Expected: everything PASSes/exits `0` — this task touched no example document's arithmetic, only prose and the catalogue.

- [ ] **Step 7: Commit**

```bash
git add docs/ci.md README.md CHANGELOG.md docs/vocabulary-catalogue.md
git commit -m "docs: document the remark plugin, changelog, and catalogue entry for #152

Co-Authored-By: <resolve from .agents/rules/ai-attribution.md>"
```

- [ ] **Step 8: Push and wait for CI**

```bash
git push
gh pr checks <spec-PR-number> --watch
```

On green, promote the PR out of draft: `gh pr ready <spec-PR-number>`.
