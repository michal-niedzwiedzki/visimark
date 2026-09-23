import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * The resources, served from the **installed package's own files** — listed in
 * `files` in `package.json` — and never fetched at runtime. A network read
 * would give the server an ambient dependency the CLI does not have, and would
 * make a resource's content depend on something other than the installed
 * version (spec §2.6).
 *
 * The highest-value payload here is not `check` — it is the skill. A server
 * that ships `check` without the authoring discipline hands an agent a
 * verifier with none of the reason it exists, above all the rule that a green
 * `check` is evidence of agreement, not of derivation.
 *
 * The two worked examples are resources rather than prompt content on a
 * deliberate distinction: resources are pull, prompts are push, and samples
 * want pull. An invoice should not enter context unless the task is an
 * invoice.
 */
export interface ResourceDef {
  readonly uri: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly mimeType: string;
  /** relative to the package root, as published */
  readonly file: string;
}

export const RESOURCES: readonly ResourceDef[] = [
  {
    uri: "visimark://skill",
    name: "skill",
    title: "The VisiMark authoring skill",
    description:
      "How to author and edit a VisiMark document: the orderings to follow, the traps to " +
      "avoid, and why a green check is evidence of agreement rather than of derivation. " +
      "Read this before writing a document, not after.",
    mimeType: "text/markdown",
    file: "skill.md",
  },
  {
    uri: "visimark://cli-reference",
    name: "cli-reference",
    title: "VisiMark command reference",
    description:
      "Every command, option, exit code and finding code, with what each one means. The " +
      "normative source for what a field in a tool result says.",
    mimeType: "text/markdown",
    file: "docs/cli-reference.md",
  },
  {
    uri: "visimark://function-reference",
    name: "function-reference",
    title: "VisiMark function reference",
    description:
      "The builtins: signature, parameters, return type, precision, errors and worked " +
      "examples. Generated from the engine's own registry, and every example is executed " +
      "in CI.",
    mimeType: "text/markdown",
    file: "docs/function-reference.md",
  },
  {
    uri: "visimark://example/invoice",
    name: "example-invoice",
    title: "A complete worked invoice",
    description:
      "A finished VisiMark document: tables, rules, anchored scalars, assertions and prose " +
      "that agree with each other.",
    mimeType: "text/markdown",
    file: "docs/example-invoice.md",
  },
  {
    uri: "visimark://example/drift",
    name: "example-drift",
    title: "The same invoice after one input changed",
    description:
      "The worked invoice with a single input edited and nothing derived from it updated — " +
      "what `visimark_check` is for, shown rather than described.",
    mimeType: "text/markdown",
    file: "docs/example-invoice-drift.md",
  },
];

/**
 * The package root, found the same lazy way `version.ts` finds the manifest:
 * `../` from `src/` in dev and from the bundled `dist/` once installed.
 */
function packageRoot(): string {
  return dirname(createRequire(import.meta.url).resolve("../package.json"));
}

export function resourceFor(uri: string): ResourceDef | undefined {
  return RESOURCES.find((r) => r.uri === uri);
}

/**
 * The resource's bytes. A missing file throws rather than returning empty: an
 * empty resource is a package that shipped wrong, and it should say so at the
 * call rather than hand an agent a blank page.
 */
export function readResource(def: ResourceDef): string {
  const text = readFileSync(join(packageRoot(), def.file), "utf8");
  if (text.trim() === "") throw new Error(`visimark-mcp: resource ${def.uri} is empty`);
  return text;
}
