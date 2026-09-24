import type { Finding, FindingCode } from "visimark";

/**
 * The audience-B finding vocabulary — spec §3.2, and v1 constraint 6 of #176:
 * **no red, no `STALE`, no "1 problem", no exit code anywhere in the UI.**
 *
 * One translation of the engine's error taxonomy
 * (`docs/visimark-design.md` §10), owned here, so that the findings view, the
 * hover popover, the vault sweep and the status bar all say the same thing.
 * A person who keeps a knowledge base in Obsidian and has never opened a
 * terminal is not being shown a Problems panel; they are being told what is
 * wrong with their note in a sentence.
 *
 * **Why this is plugin code and not an engine addition.** The engine has
 * `describeFinding`, and a plain-language sibling of it would be real reuse —
 * the moment there is a second audience-B surface. There is not one. Adding it
 * to the engine now would be the engine change the plugin spec says it does
 * not make, for a caller that does not exist. When a second surface wants
 * these words, that is new information for the section-F catalogue row, and
 * this table lifts out unchanged.
 *
 * **Completeness is a compile error, not a test.** `TEXT` is typed
 * `Record<FindingCode, …>`, so a code added to the engine's taxonomy fails to
 * typecheck here until it has words. A missing row would otherwise be a
 * finding that silently does not appear — the worst failure this file has,
 * because the note looks clean.
 *
 * **The code is not in the row.** It is on the returned object, for the detail
 * popover and for anyone who goes looking; `row` is prose and never contains
 * it. `quote` carries text taken verbatim out of the document — only `ASSERT`
 * has any — so that the plugin's own words can be checked for constraint 6
 * without the check tripping over the user's.
 */

/** What the reader can *do* about a finding, if anything. */
export type ReaderAction =
  | { kind: "repair" }
  | { kind: "infer" }
  | { kind: "suggest"; name: string }
  | { kind: "cycle"; path: string[] }
  | null;

export interface ReaderFinding {
  /** the engine's code — for the detail popover, never for the row */
  code: FindingCode;
  /** a problem to fix, or advice that is not a problem */
  severity: "problem" | "advice";
  /** the sentence, in the plugin's own words */
  row: string;
  /** text lifted verbatim out of the document, when the row needs it */
  quote?: string;
  action: ReaderAction;
}

/** The name a row is about, as the reader wrote it. */
function subject(f: Finding): string {
  return f.raw ?? f.name ?? "this value";
}

/**
 * The sentence for each code.
 *
 * `null` means **not a row**: `NOTE` exists to qualify another finding and has
 * no site of its own, so showing it alone would be a row about nothing. It
 * collapses into the finding it depends on.
 */
const TEXT: Record<FindingCode, ((f: Finding) => string) | null> = {
  STALE: (f) =>
    f.artifact !== undefined
      ? "This chart is older than the numbers it draws."
      : // the engine collapses every drifted prose anchor into one finding
        // with no site of its own, because there is no single place to point
        // at. Saying "this value" about eight of them would send the reader
        // looking for one. The engine only emits this when the count is at
        // least 1 (reportAnchors, check-report.ts), so a missing count would
        // be a hole, not a clean note — never render it as "0 values".
        f.anchorGroup === true
        ? f.suppressedCount === undefined
          ? "Some values in the text no longer match their formulas."
          : f.suppressedCount === 1
            ? "1 value in the text no longer matches its formula."
            : `${f.suppressedCount} values in the text no longer match their formulas.`
        : "This value no longer matches its formula.",
  DATE: () => "This looks like a date but is not one VisiMark can read.",
  UNIT: () => "This column mixes units.",
  UNDEF: (f) => `Nothing in this note is called ${subject(f)}.`,
  DUP: (f) => `${subject(f)} is defined twice.`,
  VECTOR: () => "This uses a whole column where one value is expected.",
  CYCLE: () => "These values depend on each other in a loop.",
  TYPE: () => "This formula does not fit together.",
  SHEET: () => "This block has rules but no table above it.",
  ANCHOR: () => "This highlighted value has nothing to bind to.",
  PRECISION: () => "VisiMark cannot tell how many decimals this should have.",
  ASSERT: () => "This check does not hold.",
  ARTIFACT: () => "This chart could not be built.",
  IMPORT: () => "The data file this note reads could not be read.",
  WARN: (f) => `${subject(f)} is defined but never used.`,
  // emitCoverage (packages/visimark/src/eval/check.ts) reports two opposite
  // cases under one code: a table with no rules at all (span undefined), and
  // a `<!--vmark:no-formulas-->` marker on a document that already has rules
  // (span points at the marker). Telling the marker case "nothing is checked"
  // and offering Infer would be backwards — the fix there is deleting the
  // marker, not adding more rules.
  COVERAGE: (f) =>
    f.span !== undefined
      ? "A marker says nothing here is checked, but this table now has rules."
      : "Nothing in this table is checked yet.",
  NOTE: null,
};

/**
 * What the reader may do about it.
 *
 * **Only `STALE` offers a repair, and only for a value.** `fmt` repairs
 * `STALE` and nothing else (`visimark-design.md` §10), and an action the
 * engine will not honour is worse than no action — it is a button that does
 * nothing, on a document the person has been told is wrong. A stale *chart*
 * gets none either, because v1 has no vault-backed write port (§2.5, §8):
 * declining the write never silences the finding, which is the shipped
 * `--no-artifacts` contract, so the row stays and the button does not appear.
 *
 * **`Finding.suggestion` is not a rename target on every code.** The engine
 * sets it for `UNDEF` (a did-you-mean binding name), but also for `TYPE`
 * (closest *function* name), `WARN` (closest *referenced* name for an unused
 * scalar) and `PRECISION` (a whole `param … precision N = default …` line —
 * an instruction, not a name at all). `COVERAGE`'s marker case has no plugin
 * action either — the fix is deleting a marker comment, which is not
 * something `fmt` or `infer` does — so it falls through to `null` below.
 * Only `UNDEF`'s suggestion is a binding a reader could plausibly want to
 * jump to.
 */
function actionFor(f: Finding): ReaderAction {
  if (f.code === "STALE" && f.artifact === undefined) return { kind: "repair" };
  if (f.code === "COVERAGE" && f.span === undefined) return { kind: "infer" };
  if (f.code === "CYCLE" && f.cyclePath !== undefined) return { kind: "cycle", path: f.cyclePath };
  if (f.code === "UNDEF" && f.suggestion !== undefined)
    return { kind: "suggest", name: f.suggestion };
  return null;
}

/**
 * `WARN` and `NOTE` are advice — reported, never counted, never the reason a
 * run fails. The engine says so in one place (`isProblem`), and this agrees
 * with it by construction rather than by keeping a second list: anything that
 * is not advice is a problem.
 */
const ADVICE: ReadonlySet<FindingCode> = new Set<FindingCode>(["WARN", "NOTE"]);

/**
 * One engine finding, in audience-B words — or `null` when it is not a row.
 */
export function forReader(f: Finding): ReaderFinding | null {
  const text = TEXT[f.code];
  if (text === null) return null;
  return {
    code: f.code,
    severity: ADVICE.has(f.code) ? "advice" : "problem",
    row: text(f),
    ...(f.code === "ASSERT" && f.source !== undefined ? { quote: f.source } : {}),
    action: actionFor(f),
  };
}

/** A note's findings as rows, with the ones that are not rows dropped. */
export function forReaderAll(findings: readonly Finding[]): ReaderFinding[] {
  const out: ReaderFinding[] = [];
  for (const f of findings) {
    const row = forReader(f);
    if (row !== null) out.push(row);
  }
  return out;
}
