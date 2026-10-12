import type { FindingCode } from "visimark";

/**
 * A finding's diagnostic severity. The LSP's table
 * (packages/visimark-lsp/src/diagnostics.ts) for every code it lists; plus
 * `PRECISION` and `COVERAGE`, which fail `check` and which the LSP shows as
 * information only because its table omits them. Typed on `FindingCode`, so a
 * code the engine adds does not compile here until it has a row.
 */
export const SEVERITY: Record<FindingCode, "error" | "warning" | "info" | "hint"> = {
  STALE: "warning",
  DATE: "error",
  UNIT: "error",
  UNDEF: "error",
  DUP: "error",
  VECTOR: "error",
  CYCLE: "error",
  TYPE: "error",
  SHEET: "error",
  ANCHOR: "warning",
  ASSERT: "error",
  PRECISION: "error",
  DOMAIN: "error",
  ARTIFACT: "error",
  IMPORT: "error",
  WARN: "hint",
  NOTE: "info",
  COVERAGE: "error",
};
