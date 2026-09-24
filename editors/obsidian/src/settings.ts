/**
 * The plugin's four settings — spec §2.5, and its defaults are the spec.
 *
 * **`writeChartArtifacts` is not here.** §2.5 lists it, off and "not settable
 * in v1": there is a vault-backed write *primitive* now (`vault.ts`'s
 * `vaultWriter`) but no chart-generation code to call it (§8 — that's v1.1
 * row 14, unbuilt), so the plugin still cannot honour a `true` value, and a
 * toggle nothing can act on is worse than no toggle. Declining the write
 * never silences the finding — the shipped `--no-artifacts` contract — which
 * is why a stale chart still gets a row with no repair, unconditionally,
 * everywhere in this plugin.
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
}

export const DEFAULT_SETTINGS: VisiMarkSettings = {
  formatOnSave: false,
  showProvenanceInLivePreview: true,
  sweepOnOpen: false,
};
