/**
 * What the playground loads, and from where.
 *
 * Fetched fresh from playground.html's own directory on every load — docs/ and
 * the playground are the same tree, so there is nothing to bake or keep in
 * sync by hand. That also means the page must be served over http(s)
 * (`bun run serve`, or GitHub Pages) rather than opened over `file://`, where
 * `fetch()` of a sibling file is blocked by CORS.
 *
 * **The catalogue and the fetching are separate** (review §2.5). FILE_SOURCES
 * is a static map, known before a single request goes out, so the FILES panel
 * can list all twenty documents while only the one being read has actually
 * arrived. Boot used to `Promise.all` over the whole map — ~124 KB and 21
 * round trips — to display one document; see ./store.ts for what asks for the
 * rest, and when.
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

/**
 * Documents that cannot be read on their own, and what has to be in the store
 * beside them.
 *
 * This is the constraint review §2.5 warned lazy loading would trip over. The
 * ReaderPort in ./store.ts is *synchronous* — it has to be, because the engine
 * calls it mid-check — so by the time 13-imports.md is being evaluated its CSV
 * is either already in the store or the import reads UNDEF. There is no await
 * to reach for at that point, which is why the dependency is declared here and
 * resolved when the file is opened rather than discovered when it is read.
 *
 * Keep this in step with READER_FS in ./store.ts: that map says which paths
 * the reader can serve, this one says which of them must be fetched together.
 */
export const DATA_DEPENDENCIES: Record<string, readonly string[]> = {
  "13-imports.md": ["13-imports.csv"],
};

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

/** One document that could not be fetched, and why. */
export interface FailedFile {
  name: string;
  path: string;
  reason: string;
}

export interface LoadedFile {
  name: string;
  text: string;
}

export interface LoadedFiles {
  files: Record<string, string>;
  failed: FailedFile[];
}

/**
 * Fetches one document. Never throws: a caller that asked for an example can
 * shrug, and a caller that asked for the document in the editor cannot, so
 * which failures are fatal is decided at the call site rather than here (see
 * main.ts, review §2.1).
 */
export async function loadFile(name: string): Promise<LoadedFile | FailedFile> {
  const path = FILE_SOURCES[name];
  if (path === undefined) {
    return { name, path: name, reason: "not a bundled document" };
  }
  try {
    const res = await fetch(path);
    if (!res.ok) return { name, path, reason: `HTTP ${res.status}` };
    return { name, text: await res.text() };
  } catch (e) {
    return { name, path, reason: (e as Error).message };
  }
}

/**
 * Fetches several documents at once, reporting the ones that did not arrive
 * rather than rejecting on the first of them (review §2.1).
 *
 * A missing example is not the same failure as a missing `demo.md`: the first
 * costs one entry in the FILES list, the second leaves nothing to edit. Both
 * used to be the same unhandled rejection, which is why the page died silently
 * on either.
 */
export async function loadFiles(names: readonly string[]): Promise<LoadedFiles> {
  const results = await Promise.all(names.map(loadFile));
  const files: Record<string, string> = {};
  const failed: FailedFile[] = [];
  for (const result of results) {
    if ("text" in result) files[result.name] = result.text;
    else failed.push(result);
  }
  return { files, failed };
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
