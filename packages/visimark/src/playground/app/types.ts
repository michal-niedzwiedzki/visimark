/**
 * The data shapes docs/playground/scenarios.json is allowed to carry, and the
 * internal shapes the quest engine runs on.
 *
 * scenarios.json is plain JSON — no functions, so no scenario can carry code.
 * Everything a scenario can ask the playground to detect goes through the
 * fixed `check` vocabulary in ./quest.ts. These types are that contract
 * written down: a `fetch()` of untyped JSON is cast to `RawScenario` exactly
 * once, in ./sources.ts, and ./quest.ts's `normalizeStep` is the only thing
 * that turns it into something executable — failing loudly on a kind or check
 * name it does not recognise.
 */

export type { PgEvalResult, VisiMarkApi } from "../browser-entry.js";

/** A quest step as scenarios.json writes it. */
export type RawStep =
  | { kind: "tab"; id?: string; text: string; group: string; tab: string }
  | { kind: "action"; id?: string; text: string; action: string }
  | { kind: "eval"; id?: string; text: string; check: string; column?: string }
  | { kind: "text"; id?: string; text: string; contains: string }
  | { kind: "manual"; id?: string; text: string };

export interface RawBadge {
  name: string;
  /** a key into BADGE_ICONS in ./badges.ts */
  icon: string;
  /** first-person and share-ready, posted verbatim by the share buttons */
  skill: string;
}

export interface RawReward {
  text: string;
  kind: "link" | "gist" | "agent";
  link?: string;
  /** an agent reward's prompt template; `{json}` is substituted */
  prompt?: string;
}

export interface RawScenario {
  body: string;
  quest?: RawStep[];
  reward?: RawReward;
  badge?: RawBadge;
}

export type Scenarios = Record<string, RawScenario>;

/** A badge, plus the id assigned from its chapter's position. */
export type Badge = RawBadge & { id: string };

/** The internal step shape the quest engine runs on. Exactly one of
 *  `action`, `evalCheck`, `textContains` and `manual` is meaningful. */
export interface Step {
  id: string;
  text: string;
  /** completed when questSignal() fires with this string */
  action?: string;
  /** completed when this returns true against a fresh eval result */
  evalCheck?: (ctx: EvalContext) => boolean;
  /** completed as soon as the document contains this substring */
  textContains?: string;
  /** nothing to detect — the visitor ticks it themselves */
  manual?: boolean;
}

/** What every CHECKS predicate is handed. */
export interface EvalContext {
  evalResult: Record<string, unknown> & { assertions?: unknown[]; charts?: unknown[] };
  baselineJson: string;
  hasStale: boolean;
  baselineHasStale: boolean;
  sourceChanged: boolean;
}
