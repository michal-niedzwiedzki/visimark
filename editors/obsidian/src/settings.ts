/**
 * The plugin's five settings — spec §2.5, and its defaults are the spec.
 *
 * **`writeChartArtifacts` was not here through v1.1 row 13.** §2.5 listed it
 * off and "not settable in v1": there was no vault-backed write port at all.
 * v1.1 row 14 (`chart.ts`, `write/fmt.ts`'s `artifactsFor`) is the code that
 * calls the write primitive #247 added, so the toggle now does something —
 * see the field doc below for what it still does not change. Declining the
 * write never silences the finding — the shipped `--no-artifacts` contract —
 * which is why a stale chart still gets a row with no repair, unconditionally,
 * whenever this is off.
 */
export interface VisiMarkSettings {
  /**
   * Apply every repair `fmt` would make when the reader explicitly saves —
   * v1 row 7's other half (the per-row repair and the whole-note Format
   * command both already write, per v1 constraint 3's "an explicit act").
   * Off by default: audience B has not agreed to a tool that changes bytes
   * they did not type, and an autosave never triggers this on either
   * surface, mobile included, where a save is a timer far more often than a
   * decision.
   */
  formatOnSave: boolean;
  /**
   * Mark a computed value while typing, the same way reading mode always
   * does (row 2). On by default. The toggle exists because the anchor
   * comment a mark decorates is visible as literal text in Live Preview —
   * §16 records that as unverified-then-confirmed — so a mark sits beside a
   * `<!--vmark=…-->` a reader can see, and this is one setting away if that
   * reads badly in practice.
   */
  showProvenanceInLivePreview: boolean;
  /** Start a vault-wide sweep automatically each time this vault opens. Off
   * by default — a sweep is a scan of every note, a command, not a startup
   * cost every vault should pay unasked. */
  sweepOnOpen: boolean;
  /**
   * Regenerate a stale or missing chart's SVG through the vault, when Format
   * (the command, or format-on-save with `formatOnSave` on) runs — v1
   * constraint 3's "an explicit act", same as every other write this plugin
   * makes. Off by default: audience B has not agreed to this tool creating
   * *new files* in the vault any more than it has agreed to edited bytes in
   * an existing one, and a chart is a file this plugin has never written
   * before now. Turning it on does not change what `check` reports — a
   * stale chart is still a stale chart until the next Format runs, exactly
   * the way a stale cell is.
   */
  writeChartArtifacts: boolean;
}

export const DEFAULT_SETTINGS: VisiMarkSettings = {
  formatOnSave: false,
  showProvenanceInLivePreview: true,
  sweepOnOpen: false,
  writeChartArtifacts: false,
};
