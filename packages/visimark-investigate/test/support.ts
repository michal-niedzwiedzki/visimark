import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as engine from "../../visimark/src/browser.js";
import { cellKey } from "../src/ids.js";
import { maskMarkdown } from "../src/mask.js";
import { readTables } from "../src/tables.js";
import type { DocInput, Finding, Rule, RuleResult } from "../src/types.js";

export { engine };

export const FIXTURES = join(import.meta.dir, "fixtures/rules");

export function doc(path: string, text: string): DocInput {
  const masked = maskMarkdown(text);
  return { path, text, masked, tables: readTables(masked) };
}

export function ctx(texts: Map<string, string> = new Map()) {
  return { engine, texts, reader: engine.memoryReader((p) => texts.get(p)) };
}

/** One rule over one file, its raw findings shaped as the Report shapes them. */
export function runRule(
  rule: Rule,
  path: string,
  text: string,
): RuleResult & { shaped: Finding[] } {
  const result = rule.run(doc(path, text), ctx(new Map([[path, text]])));
  const shaped = result.findings.map(({ rule: id, cell, ...rest }) => ({
    ...rest,
    id: cellKey(path, cell),
    permalink: null,
    rules: [id],
  }));
  return { ...result, shaped };
}

export const fixtureDirs = (): string[] => readdirSync(FIXTURES).sort();
export const fixture = (id: string, name: string): string =>
  readFileSync(join(FIXTURES, id, name), "utf8");
