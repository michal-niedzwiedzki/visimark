#!/usr/bin/env node
// Checks that the expression-depth cap still has stack headroom on *this*
// runtime. Run it under both:
//
//   bun  scripts/stack-headroom.mjs
//   node scripts/stack-headroom.mjs
//
// Why this exists. MAX_EXPR_DEPTH in packages/visimark/src/lang/parser.ts
// bounds how deep an expression may be, because five recursive walkers descend
// whatever the parser returns and the binding constraint is the shallowest of
// them. Those limits were measured under JavaScriptCore, but the CLI ships to
// Node and the LSP runs under the editor's Node, and V8's default stack is
// smaller. A margin that is comfortable on one engine is not automatically
// comfortable on the other, so CI checks it on the runtime that ships rather
// than trusting the Bun figure. See docs/design/parser-depth-cap-plan.md.
//
// What it measures. Not VisiMark's own walkers: `dist/` is a bundle and does
// not export the parser, and the cap would refuse the deep input anyway. It
// measures how many frames of a walker *shaped like* `evalExpr` — a switch, a
// couple of locals, one self-call in tail position of a case — this engine
// allows, which is the quantity that differs between engines. The calibration
// below ties that number back to the real ones.

/** Must match MAX_EXPR_DEPTH in packages/visimark/src/lang/parser.ts. */
const CAP = 256;

/**
 * Required headroom, and the calibration behind the number. Under Bun 1.4.2 on
 * Linux the synthetic walker below reaches 31,925 levels, while VisiMark's
 * shallowest real path — `ABS(ABS(…))` through `parseBp` — overflows at 12,501.
 * So this measurement runs about 2.5x optimistic, because a real frame carries
 * more than this one does.
 *
 * The cap therefore has ~49x real headroom on Bun but reads as ~125x here.
 * Requiring 10x leaves room for that 2.5x optimism and then roughly another 5x
 * for a future walker with a fatter frame or an engine with a smaller stack. If
 * this check ever trips, the cap is genuinely too close to an overflow on the
 * runtime that tripped it.
 */
const MIN_RATIO = 10;

/** A node shaped like the `binary` arm of an Expr, chained to a given depth. */
function spine(depth) {
  let node = { type: "num", value: "1" };
  for (let i = 0; i < depth; i++) {
    node = { type: "binary", op: "+", left: node, right: { type: "num", value: "1" } };
  }
  return node;
}

/** Shaped like eval/evaluate.ts's evalExpr: switch, locals, self-call. */
function walk(node) {
  switch (node.type) {
    case "num":
      return Number(node.value);
    case "binary": {
      const l = walk(node.left);
      const r = walk(node.right);
      return l + r;
    }
    default:
      return 0;
  }
}

/** Largest depth this engine walks without a RangeError. */
function limit() {
  let lo = 1;
  let hi = 500_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    let ok = true;
    try {
      walk(spine(mid));
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      ok = false;
    }
    if (ok) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const runtime = typeof Bun === "undefined" ? `node ${process.version}` : `bun ${Bun.version}`;
const measured = limit();
const ratio = measured / CAP;

console.log(
  `${runtime}: walks ${measured} levels before overflowing; ` +
    `cap=${CAP}, headroom=${ratio.toFixed(1)}x, required=${MIN_RATIO}x`,
);

if (ratio < MIN_RATIO) {
  console.error(
    `\nERROR: ${ratio.toFixed(1)}x headroom is below the ${MIN_RATIO}x this cap is documented to have.\n` +
      `Lower MAX_EXPR_DEPTH in packages/visimark/src/lang/parser.ts and update the comment beside it.`,
  );
  process.exit(1);
}
