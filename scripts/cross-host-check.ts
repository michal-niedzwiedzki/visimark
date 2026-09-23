/**
 * Cross-host equivalence check: runs `check`, `eval`, and `explain --json`
 * for every `docs/example-*.md` file through two hosts — the real CLI
 * subprocess and the committed browser bundle, loaded in a `node:vm` sandbox
 * — and fails if their `--json` envelopes disagree.
 *
 * See docs/design/cross-host-equivalence-check-spec.md.
 *
 * **The sandbox's `document.createElement` must be a working stand-in, not a
 * stub.** `bun build --target browser` resolves `decode-named-character-reference`'s
 * `"browser"` export condition, which decodes an HTML entity by writing it
 * into a real element's `innerHTML` and reading `textContent` back — the way
 * a real browser's HTML parser does it. A bare `() => ({})` stub (as
 * `playground.test.ts`'s own sandbox uses) makes that call read back
 * `undefined` and crash on the first named entity (`&nbsp;`, `&amp;`, …) any
 * real document contains. This is not a real playground bug — a real browser
 * has a working DOM — but it means this script cannot reuse that sandbox
 * verbatim: it needs an `innerHTML`/`textContent` pair backed by the same
 * decoder's own Node-targeted variant, so both hosts decode identically.
 *
 * Usage: `bun scripts/cross-host-check.ts`. Exit 0 clean, 1 on divergence or
 * a CLI subprocess failure.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { decodeNamedCharacterReference } from "decode-named-character-reference";

import { readVersion } from "../packages/visimark/src/cli/version.js";
import { explainView } from "../packages/visimark/src/report/explain.js";
import { explainJson } from "../packages/visimark/src/report/envelope.js";
import {
  evalValues,
  findingSummary,
  publicAssertions,
  publicCharts,
  publicFinding,
  statusFromExit,
} from "../packages/visimark/src/report/json.js";
import { compareEnvelopes, type Divergence } from "./cross-host-compare.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const docsDir = join(repoRoot, "docs");
const bundlePath = join(docsDir, "vendor", "visimark-browser.js");
const cliEntry = join(repoRoot, "packages/visimark/src/cli/main.ts");

const COMMANDS = ["check", "eval", "explain"] as const;
type Command = (typeof COMMANDS)[number];

/**
 * The two documents whose file-dependent fields legitimately differ between
 * a host with a real filesystem and one with none, and exactly which
 * `explain --json` field names those are — empirically confirmed by running
 * both hosts' real output side by side (not guessed): `example-invoice-csv-import.md`
 * loses `hasTable`/`inputs`/`import.stampStatus`/each scalar's
 * `precision`/`precisionFrom` when no reader is supplied; every chart-bearing
 * document (`example-charts.md`, and `example-onboarding-dashboard.md` —
 * `grep -l '^chart ' docs/example-*.md` found both; the issue that motivated
 * this only named the import document and `example-charts.md` as "the two
 * file-reading documents", which undercounted by one) loses only each
 * chart's `state`. `check`/`eval --json` need no exclusions at all: `check`
 * already suppresses every finding a `skipped` import or chart would
 * otherwise cascade (`eval/check.ts`'s "neverAttempted" suppression), and
 * `eval` never passes a reader on either host to begin with (`cmdEval` calls
 * `check(model)` with no `doc` option — spec §4's correction), so both hosts
 * already agree without help.
 */
const EXPLAIN_ONLY_EXCLUDED_KEYS: Record<string, string[]> = {
  "example-invoice-csv-import.md": [
    "hasTable",
    "stampStatus",
    "inputs",
    "precision",
    "precisionFrom",
  ],
  "example-charts.md": ["state"],
  "example-onboarding-dashboard.md": ["state"],
};

/** every exact JSON path under `envelope` whose last segment is one of `keys` */
function pathsNamed(envelope: unknown, keys: string[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const next = path ? `${path}.${k}` : k;
        if (keys.includes(k)) out.push(next);
        walk(val, next);
      }
    }
  };
  walk(envelope, "");
  return out;
}

function corpusFiles(): string[] {
  return readdirSync(docsDir)
    .filter((f) => /^example-.*\.md$/.test(f))
    .sort();
}

function loadBundle(): Record<string, unknown> {
  const source = readFileSync(bundlePath, "utf8");
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: () => {
        let decoded = "";
        return {
          set innerHTML(value: string) {
            const m = /^&([^;]+);$/.exec(value);
            decoded = (m && decodeNamedCharacterReference(m[1])) || value;
          },
          get textContent() {
            return decoded;
          },
        };
      },
      currentScript: null,
      addEventListener() {},
      querySelector: () => null,
    },
    navigator: { userAgent: "test" },
    crypto: globalThis.crypto,
  };
  sandbox.window = sandbox;
  createContext(sandbox);
  runInContext(source, sandbox, { filename: "visimark-browser.js" });
  return sandbox.VisiMark as Record<string, unknown>;
}

interface Finding {
  code: string;
  [k: string]: unknown;
}
interface CheckResult {
  findings: Finding[];
  exitCode: 0 | 1;
  assertions: { holds: boolean | null }[];
  charts: unknown[];
  values: Map<string, unknown>;
  cells: Map<string, unknown[]>;
}
interface VM {
  locate: (s: string) => unknown;
  build: (m: unknown) => unknown;
  check: (m: unknown) => CheckResult;
}

function runCli(command: Command, file: string): { envelope: unknown } | { error: string } {
  const proc = Bun.spawnSync(["bun", "run", cliEntry, command, join("docs", file), "--json"], {
    cwd: repoRoot,
  });
  const stdout = proc.stdout.toString("utf8");
  try {
    return { envelope: JSON.parse(stdout) };
  } catch {
    return {
      error: `CLI produced non-JSON stdout (exit ${proc.exitCode}): ${stdout || proc.stderr.toString("utf8")}`,
    };
  }
}

function browserEnvelope(vm: VM, command: Command, file: string, source: string): unknown {
  const model = vm.build(vm.locate(source));
  const relPath = join("docs", file);

  if (command === "check") {
    const result = vm.check(model);
    const summary = findingSummary(result.findings);
    return {
      command: "check",
      visimark: readVersion(),
      status: statusFromExit(result.exitCode),
      files: [
        { path: relPath, findings: result.findings.map((f) => publicFinding(relPath, f)), summary },
      ],
      summary: { files: 1, ...summary },
    };
  }
  if (command === "eval") {
    const result = vm.check(model);
    const assertExit: 0 | 1 = result.assertions.some((a) => a.holds === false) ? 1 : 0;
    return {
      command: "eval",
      visimark: readVersion(),
      status: statusFromExit(assertExit),
      file: relPath,
      values: evalValues(result as never),
      assertions: publicAssertions(result.assertions as never),
      charts: publicCharts(result.charts as never),
    };
  }
  const checkResult = vm.check(model);
  const view = explainView(model as never, checkResult as never, []);
  return explainJson(view, relPath);
}

function main(): number {
  const vm = loadBundle() as unknown as VM;
  const files = corpusFiles();
  const allDivergences: { file: string; command: Command; divergences: Divergence[] }[] = [];
  const failures: string[] = [];
  let pairs = 0;

  for (const file of files) {
    const source = readFileSync(join(docsDir, file), "utf8");
    for (const command of COMMANDS) {
      pairs++;
      const cli = runCli(command, file);
      if ("error" in cli) {
        failures.push(`${file} ${command}: ${cli.error}`);
        continue;
      }
      let browser: unknown;
      try {
        browser = browserEnvelope(vm, command, file, source);
      } catch (e) {
        failures.push(`${file} ${command}: browser side threw: ${(e as Error).message}`);
        continue;
      }
      const scopedExclusions =
        command === "explain" && EXPLAIN_ONLY_EXCLUDED_KEYS[file]
          ? pathsNamed(cli.envelope, EXPLAIN_ONLY_EXCLUDED_KEYS[file])
          : [];
      const divergences = compareEnvelopes(cli.envelope, browser, { scopedExclusions });
      if (divergences.length > 0) allDivergences.push({ file, command, divergences });
    }
  }

  if (failures.length > 0 || allDivergences.length > 0) {
    for (const f of failures) console.error(f);
    for (const { file, command, divergences } of allDivergences) {
      for (const d of divergences) {
        console.error(`${file} ${command}: ${d.path || "(root)"}`);
        console.error(`  cli:     ${JSON.stringify(d.cli)}`);
        console.error(`  browser: ${JSON.stringify(d.browser)}`);
      }
    }
    return 1;
  }

  console.log(
    `${files.length} documents × ${COMMANDS.length} commands, ${pairs} pairs, 0 divergences`,
  );
  return 0;
}

process.exit(main());
