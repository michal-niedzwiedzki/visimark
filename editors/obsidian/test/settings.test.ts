import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../src/settings.js";

/**
 * Spec §2.5's own table is the source of truth for these three defaults;
 * this is what stops one of them drifting silently.
 */
test("format-on-save defaults off — audience B has not agreed to it", () => {
  expect(DEFAULT_SETTINGS.formatOnSave).toBe(false);
});

test("Live Preview provenance defaults on — row 2 covers both renderers", () => {
  expect(DEFAULT_SETTINGS.showProvenanceInLivePreview).toBe(true);
});

test("sweep-on-open defaults off — a scan is a command, not a startup cost", () => {
  expect(DEFAULT_SETTINGS.sweepOnOpen).toBe(false);
});
