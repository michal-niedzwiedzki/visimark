/**
 * What the playground loads, and from where.
 *
 * Fetched fresh from playground.html's own directory on every load — docs/ and
 * the playground are the same tree, so there is nothing to bake or keep in
 * sync by hand. That also means the page must be served over http(s)
 * (`bun run serve`, or GitHub Pages) rather than opened over `file://`, where
 * `fetch()` of a sibling file is blocked by CORS.
 */

import type { RawScenario, Scenarios } from "./types.js";

/** The tutorial track, one concept per file — their SCENARIO-panel body and
 *  quest come from scenarios.json. */
export const TUTORIAL_CHAPTERS = [
  "01-tables.md",
  "02-inference.md",
  "03-sheets.md",
  "04-anchors.md",
  "05-mappers.md",
  "06-aggregates.md",
  "07-reasoning.md",
  "08-knowledge.md",
  "09-units.md",
  "10-assertions.md",
  "11-build-automation.md",
  "12-charts.md",
  "13-imports.md",
];

/**
 * Data files a chapter imports, rather than chapters themselves — no badge, no
 * scenario quest, but fetched into the same store so the engine can actually
 * read them (see ./store.ts). 13-imports.md declares
 * `from 13-imports.csv ... at sha256:...`; with the CSV absent the sheet has
 * no table and every imported column reads UNDEF, which is the spurious
 * failure review §4.3 fixes.
 */
export const TUTORIAL_DATA = ["13-imports.csv"];

/** Filename as the playground shows it → path to fetch it from. */
export const FILE_SOURCES: Record<string, string> = { "demo.md": "playground/demo.md" };
for (const name of [...TUTORIAL_CHAPTERS, ...TUTORIAL_DATA]) {
  FILE_SOURCES[name] = `playground/tutorial/${name}`;
}
Object.assign(FILE_SOURCES, {
  "example-invoice.md": "example-invoice.md",
  "example-invoice-drift.md": "example-invoice-drift.md",
  "example-quote-plain.md": "example-quote-plain.md",
  "example-charts.md": "example-charts.md",
  "example-executable-documentation.md": "example-executable-documentation.md",
});

export const SCENARIOS_PATH = "playground/scenarios.json";

export async function loadFiles(): Promise<Record<string, string>> {
  const names = Object.keys(FILE_SOURCES);
  const texts = await Promise.all(
    names.map(async (name) => {
      const path = FILE_SOURCES[name]!;
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.text();
    }),
  );
  const files: Record<string, string> = {};
  names.forEach((name, i) => {
    files[name] = texts[i]!;
  });
  return files;
}

export async function loadScenarios(): Promise<Scenarios> {
  const res = await fetch(SCENARIOS_PATH);
  if (!res.ok) throw new Error(`${SCENARIOS_PATH}: HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, RawScenario | string>;
  const scenarios: Scenarios = {};
  for (const name of Object.keys(data)) {
    // "//" is the file's own documentation comment, not a scenario.
    if (name !== "//") scenarios[name] = data[name] as RawScenario;
  }
  return scenarios;
}
