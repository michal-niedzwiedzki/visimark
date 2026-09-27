import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, check, locate } from "visimark";
import { TEMPLATE_ORDER, render, sourceNames } from "../../../scripts/gen-obsidian-templates.js";
import { TEMPLATES } from "../src/templates.js";

/**
 * **Row 10's acceptance is machine-checkable, and this is it.** Manual test
 * §2.10 asks for two things of every template: that it passes `check` from the
 * CLI with **zero findings before anything is edited**, and that it contains
 * no syntax that means something only inside Obsidian (v1 constraint 5). A
 * person has to insert one to test the command; nothing about the documents
 * themselves needs a vault.
 *
 * Zero findings is a stricter bar than it sounds. It is not "no problems" —
 * `WARN` for a name that is declared and never used, and `COVERAGE` for a
 * table with no rules attached, are findings too, and either one would show a
 * new reader a template that complains about itself the moment they open it.
 * That is the worst possible first impression for the on-ramp.
 */

const dir = resolve(import.meta.dir, "../templates");
const read = (name: string): string => readFileSync(join(dir, `${name}.md`), "utf8");

test("every template passes check with zero findings, unedited", () => {
  const offenders: string[] = [];
  for (const t of TEMPLATES) {
    const findings = check(build(locate(t.body))).findings;
    if (findings.length > 0) {
      offenders.push(`${t.id}: ${findings.map((f) => `${f.code} ${f.name ?? ""}`).join(", ")}`);
    }
  }
  expect(offenders, offenders.join(" | ")).toEqual([]);
});

test("every template contains at least one vmark block, so the gate opens on it", () => {
  // the template exists to give someone their first VisiMark note; one that
  // does not activate the plugin has failed at the only job it has
  for (const t of TEMPLATES) {
    expect(locate(t.body).blocks.length, `${t.id} has no vmark block`).toBeGreaterThan(0);
  }
});

test("every template computes something, rather than just looking like it does", () => {
  // a document with a block and no bindings would pass the two tests above and
  // teach nothing. Each template must bind at least one column and one scalar.
  for (const t of TEMPLATES) {
    const model = build(locate(t.body));
    const sheets = [...model.sheets.values()];
    const columns = sheets.reduce((n, s) => n + s.columns.size, 0);
    const scalars = sheets.reduce((n, s) => n + s.scalars.size, 0);
    expect(columns, `${t.id} binds no column`).toBeGreaterThan(0);
    expect(scalars, `${t.id} binds no scalar`).toBeGreaterThan(0);
  }
});

test("every template anchors a number in prose", () => {
  // the anchor is the idea the format is *for* — a sentence whose number stays
  // checked. A template without one shows a spreadsheet, not a document.
  for (const t of TEMPLATES) {
    expect(locate(t.body).anchors.length, `${t.id} anchors nothing`).toBeGreaterThan(0);
  }
});

/**
 * Prose only — fenced code blocks removed.
 *
 * Obsidian does not read a tag, a callout or a comment inside a fence, and
 * neither should this check: `#lines` on a ```vmark block's first line is the
 * sheet's identity, which is exactly the syntax the templates are here to
 * teach. Scanning the raw document would forbid the thing being taught.
 */
function prose(markdown: string): string {
  return markdown.replace(/^(`{3,}|~{3,}).*$[\s\S]*?^\1\s*$/gm, "");
}

test("no template uses syntax that means something only inside Obsidian", () => {
  // v1 constraint 5, and the reason the whole fork exists: a note that only
  // works inside the vault is a note the format has failed
  const obsidianOnly: [RegExp, string][] = [
    [/!?\[\[[^\]]+\]\]/, "a wikilink or embed"],
    [/^> \[![a-z]+\]/im, "a callout"],
    [/%%[\s\S]*?%%/, "an Obsidian comment"],
    [/^---\r?\n/, "YAML frontmatter, which Obsidian reads as properties"],
    [/\^[a-z0-9]{6}\s*$/im, "a block reference"],
    [/(?:^|\s)#[a-z][a-z0-9/_-]*(?:\s|$)/im, "a tag"],
    [/^\s*```(?:dataview|dataviewjs|query|tasks)\b/im, "a query block"],
  ];
  const offenders: string[] = [];
  for (const t of TEMPLATES) {
    const text = prose(t.body);
    for (const [re, what] of obsidianOnly) {
      if (re.test(text)) offenders.push(`${t.id} contains ${what}`);
    }
  }
  expect(offenders, offenders.join("; ")).toEqual([]);
});

test("the prose filter does not simply hide everything", () => {
  // a filter that returned "" would make the test above pass for every
  // document ever written, which is the way this check fails silently
  const withTag = "Some prose #inbox here.\n\n```vmark #lines\nx = 1\n```\n";
  expect(prose(withTag)).toContain("#inbox");
  expect(prose(withTag)).not.toContain("#lines");
  for (const t of TEMPLATES) {
    expect(prose(t.body).trim().length, `${t.id}: the filter left no prose`).toBeGreaterThan(200);
  }
});

test("src/templates.ts is what the generator would write today", () => {
  // the same freshness check gen-function-reference.ts and gen-mcp-skill.ts
  // get from their CI jobs, as a test instead, so no workflow has to change
  const current = readFileSync(resolve(import.meta.dir, "../src/templates.ts"), "utf8");
  expect(
    render(read),
    "editors/obsidian/src/templates.ts is stale — run `bun run gen:obsidian-templates`",
  ).toBe(current);
});

test("the generated bodies are the Markdown files, byte for byte", () => {
  // stated separately from the freshness check above: that one compares whole
  // files and would also fail for a change to the generator's own preamble.
  // This one is only about the documents, which are what the CLI checks.
  for (const t of TEMPLATES) {
    expect(t.body, `${t.id} differs from templates/${t.id}.md`).toBe(read(t.id));
  }
});

test("every Markdown file in templates/ has a command, and every command a file", () => {
  // a template with no place in TEMPLATE_ORDER ships in the repository and
  // nowhere else, which is a file nobody can reach and nothing would notice
  expect(sourceNames()).toEqual([...TEMPLATE_ORDER].sort());
  expect(TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_ORDER]);
});

test("titles are sentence case, which is Obsidian's rule for UI text", () => {
  for (const t of TEMPLATES) {
    const rest = t.title.slice(1);
    expect(t.title[0], `${t.id}: "${t.title}" does not start with a capital`).toBe(
      t.title[0]!.toUpperCase(),
    );
    expect(rest, `${t.id}: "${t.title}" is Title Case`).toBe(rest.toLowerCase());
  }
});

test("the templates directory holds nothing but Markdown", () => {
  const strays = readdirSync(dir).filter((f) => !f.endsWith(".md"));
  expect(strays, `${strays.join(", ")} — templates/ is documents only`).toEqual([]);
});
