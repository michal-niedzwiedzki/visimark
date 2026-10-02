import { locate, type RawAnchor } from "../parse/document.js";

/**
 * Spec §3 step 1 (docs/design/nbsp-display-rule-for-string-anchors-spec.md):
 * splice `rendered` into `source` at the anchor's value span, re-parse, and
 * prove the anchor still targets the same node kind wrapping one text child
 * whose source is exactly `rendered` and whose decoded value is `expected`.
 * The splice is in place, so flanking and autolinking see the real context.
 */
export function roundTrips(
  source: string,
  anchor: RawAnchor,
  rendered: string,
  expected: string,
): boolean {
  const v = anchor.value;
  if (!v || rendered === "") return false;
  const spliced = source.slice(0, v.start) + rendered + source.slice(v.end);
  const shift = rendered.length - (v.end - v.start);
  const commentStart = anchor.commentSpan.start + shift;
  const after = locate(spliced).anchors.find((a) => a.commentSpan.start === commentStart);
  // innerValueSpan already yields null unless the node wraps exactly one text child
  return (
    after !== undefined &&
    after.value !== null &&
    after.value.kind === v.kind &&
    after.value.start === v.start &&
    after.value.end === v.start + rendered.length &&
    after.valueText === expected
  );
}
