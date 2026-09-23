/**
 * Renders the files `visimark-mcp` serves as resources, from the sources they
 * are derived from. Run with `bun run gen:mcp`; CI re-runs it and fails on a
 * diff, exactly as `gen-function-reference.ts` is treated.
 *
 * Two kinds of output, both committed:
 *
 * - `packages/visimark-mcp/skill.md` — a **generated variant** of
 *   `skills/visimark/SKILL.md`. The source is written for a reader inside the
 *   clone; the resource is for a reader who has the MCP server and not the
 *   repository, so "Running it" is rewritten in tool names and every relative
 *   link to a doc becomes the resource URI that serves it. Generated rather
 *   than hand-maintained because two hand-written variants drift (spec §2.7).
 * - `packages/visimark-mcp/docs/*.md` — verbatim copies of the docs the server
 *   serves. Resources are served from files **inside the tarball** and never
 *   fetched at runtime: a network read would give the server an ambient
 *   dependency the CLI does not have, and make a resource's content depend on
 *   something other than the installed version (spec §2.6).
 *
 * The copies are committed rather than produced only by `build` so that the
 * resource tests can run before it, and so `npm pack` cannot quietly ship a
 * package with an empty resource. The freshness check is what keeps them true.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "packages/visimark-mcp");

/** The docs the server serves verbatim, by their path under `docs/`. */
export const SERVED_DOCS = [
  "cli-reference.md",
  "function-reference.md",
  "example-invoice.md",
  "example-invoice-drift.md",
] as const;

/** Relative links in the skill that have a resource URI to point at instead. */
const LINK_REWRITES: [RegExp, string][] = [
  [/\(\.\.\/\.\.\/docs\/cli-reference\.md\)/g, "(visimark://cli-reference)"],
  [/\(\.\.\/\.\.\/docs\/function-reference\.md\)/g, "(visimark://function-reference)"],
  [/\(\.\.\/\.\.\/docs\/example-invoice\.md\)/g, "(visimark://example/invoice)"],
  [/\(\.\.\/\.\.\/docs\/example-invoice-drift\.md\)/g, "(visimark://example/drift)"],
];

/**
 * "Running it", for a reader whose VisiMark is a set of tools rather than a
 * command. The orderings and the traps are the source file's and are not
 * restated here — only the way you invoke them changes.
 */
const RUNNING_IT = `## Running it

You reach VisiMark through this server's tools. Each one returns the same JSON
envelope the \`visimark\` CLI emits under \`--json\`, so what a field means is
what [\`cli-reference.md\`](visimark://cli-reference) says it means.

| Tool | What it does |
|---|---|
| \`visimark_check\` | Verify every computed number still agrees with its formula. Findings come back as a **successful** result with \`status: "problems"\` — a document that disagrees is not a broken call. |
| \`visimark_fmt\` | Plan the repair. Returns the edits and the artifact paths it would write, and writes nothing. |
| \`visimark_fmt_apply\` | Land a plan from \`visimark_fmt\`. Refused unless the operator started the server with \`--allow-write\` and the host declared a root. |
| \`visimark_infer\` | Propose rules for a document that has none. Returns proposals; writes nothing. |
| \`visimark_infer_apply\` | Land those proposals, behind the same gate. |
| \`visimark_eval\` | Evaluate the document; \`get\` selects a value, \`scenarioContent\` answers a what-if. |
| \`visimark_explain\` | The document's sheets, rules, precision and imports. |
| \`visimark_ref\` | What a builtin does. Reads no file. |

**Every read tool takes \`path\` or \`content\`.** A document you are drafting
in context has no path — pass it as \`content\` and skip the temp file. A
document given as \`content\` has no directory, so imports and generated
artifacts cannot be checked; the result's \`skipped\` names what was not looked
at, and it is not a clean pass.

**Do not guess a function's behaviour.** \`visimark_ref\` with a \`name\`
prints its signature, parameters, return type, errors and worked examples;
omit \`name\` for the whole reference. Every example it prints is executed
against the evaluator in CI, so what it says is what the engine does. The same
content is at [\`function-reference.md\`](visimark://function-reference).

**What-if questions: declare a \`param\`, never edit the document.** A value a
caller may want to vary — a rate, a cap, a headcount — is written
\`param tax precision 3 = default 19%\` (\`precision\` required, a literal
default). Every tool treats it as its default. \`visimark_eval\` with
\`scenarioContent: "{\\"tax\\": \\"12.5%\\"}"\` evaluates with that instead and
writes nothing: keys must name declared params, values must be JSON *strings*
that fit the precision, and a percent param takes a percent.

**Nothing is written unless you ask twice.** The plan tools never touch disk.
The apply tools take the plan you were given, refuse if the file changed
underneath it, and refuse entirely unless an operator opened the write gate.
If an apply tool answers \`writes are disabled\`, that is for the human running
the server to change, not something to work around.

Two worked documents are available as resources: a complete invoice at
[\`example/invoice\`](visimark://example/invoice), and the same invoice after
one input changed and nothing derived from it was updated, at
[\`example/drift\`](visimark://example/drift).

`;

const HEADER = `
<!-- Generated from skills/visimark/SKILL.md by \`bun run gen:mcp\`.
     Do not edit this file by hand — edit the skill. -->
`;

export function renderSkill(source: string): string {
  const start = source.indexOf("## Running it");
  if (start === -1) throw new Error("gen-mcp-skill: no `## Running it` heading in SKILL.md");
  const end = source.indexOf("\n## ", start + 1);
  if (end === -1) throw new Error("gen-mcp-skill: `## Running it` is the last section");

  let out = source.slice(0, start) + RUNNING_IT + source.slice(end + 1);
  for (const [pattern, replacement] of LINK_REWRITES) out = out.replaceAll(pattern, replacement);

  // The notice goes *after* the frontmatter, not before it: a YAML block that
  // is not the first thing in the file is not frontmatter, and a host that
  // loads this as a skill would see none.
  const fm = out.startsWith("---\n") ? out.indexOf("\n---\n", 4) + "\n---\n".length : 0;
  return out.slice(0, fm) + HEADER + out.slice(fm);
}

function main(): void {
  const source = readFileSync(join(ROOT, "skills/visimark/SKILL.md"), "utf8");
  writeFileSync(join(PKG, "skill.md"), renderSkill(source));

  mkdirSync(join(PKG, "docs"), { recursive: true });
  for (const name of SERVED_DOCS) {
    copyFileSync(join(ROOT, "docs", name), join(PKG, "docs", name));
  }
}

if (process.argv[1]?.endsWith("gen-mcp-skill.ts")) main();
