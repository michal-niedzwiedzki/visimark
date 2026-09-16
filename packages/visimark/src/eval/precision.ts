import type { Expr, Ref } from "../lang/ast.js";

/**
 * Resolve an operand's precision. `number` is a known width; `null` means the
 * operand has none the caller can supply — an unresolved name, a string or
 * date column, or a column with no cells to infer from.
 */
export type PrecisionLookup = (ref: Ref) => number | null;

/**
 * A binding's write precision, derived from its own expression.
 *
 * `null` means **not derivable**: the operation does not bound its result's
 * scale by its operands', so no width follows from the formula and the author
 * has to declare one. Division, `AVG` and `SQRT` are the cases that matter.
 *
 * Every rule here satisfies one invariant — **a derived precision never
 * discards a digit**, so rounding a result to its derived width is a no-op.
 * That is the whole reason the table has this shape rather than a convenient
 * default: an operation earns a rule if and only if its result's scale is
 * bounded by its operands'. See docs/design/declared-precision-spec.md §3.
 *
 * Derivation is deliberately **uncapped**. `two * two * two * two` derives 8,
 * and a chain can exceed the 18 a declaration may name. That width is exact and
 * honest, so clamping it here would break the invariant; whether it can actually
 * be rendered is the working-precision guard's question, in one place, rather
 * than silently every time a product nests.
 */
export function derivePrecision(expr: Expr, lookup: PrecisionLookup): number | null {
  switch (expr.type) {
    case "num":
      return decimalsOf(expr.value);
    case "date":
    case "str":
      return null;
    case "ref":
      return lookup(expr);
    case "unary":
      // `not` yields a boolean, which is never stored.
      return expr.op === "-" ? derivePrecision(expr.operand, lookup) : null;
    case "binary":
      return binaryPrecision(expr.op, expr.left, expr.right, lookup);
    case "call":
      return callPrecision(expr.name, expr.args, lookup);
  }
}

function binaryPrecision(
  op: string,
  left: Expr,
  right: Expr,
  lookup: PrecisionLookup,
): number | null {
  switch (op) {
    case "+":
    case "-":
      // the sum of two scales fits inside the wider of them
      return widest([derivePrecision(left, lookup), derivePrecision(right, lookup)]);
    case "*": {
      // a product of p and q decimals has at most p + q
      const a = derivePrecision(left, lookup);
      const b = derivePrecision(right, lookup);
      return a === null || b === null ? null : a + b;
    }
    case "^": {
      // repeated multiplication, so only a non-negative integer exponent bounds it
      const n = integerLiteral(right);
      if (n === null) return null;
      const a = derivePrecision(left, lookup);
      return a === null ? null : a * n;
    }
    default:
      // `/` never terminates in general; comparisons and `and`/`or` are not numeric
      return null;
  }
}

function callPrecision(name: string, args: Expr[], lookup: PrecisionLookup): number | null {
  const at = (i: number): number | null => {
    const a = args[i];
    return a === undefined ? null : derivePrecision(a, lookup);
  };
  switch (name) {
    // closed over the column's own scale
    case "SUM":
    case "MIN":
    case "MAX":
      return at(0);
    case "COUNT":
      return 0;
    // fixed by an argument
    case "ROUND":
      return integerLiteral(args[1]);
    case "FLOOR":
    case "CEILING":
      return at(1);
    // passes its operands' width through
    case "ABS":
      return at(0);
    case "MOD":
      return widest([at(0), at(1)]);
    case "IF":
      return widest([at(1), at(2)]);
    // `AVG` divides; `SQRT` need not terminate; `EOMONTH` yields a date
    default:
      return null;
  }
}

/** the wider of two precisions, or `null` if either is unknown */
function widest(ps: (number | null)[]): number | null {
  let max = 0;
  for (const p of ps) {
    if (p === null) return null;
    if (p > max) max = p;
  }
  return max;
}

/** a non-negative integer written literally, for `^` and `ROUND`'s width */
function integerLiteral(expr: Expr | undefined): number | null {
  if (expr?.type !== "num") return null;
  if (!/^\d+$/.test(expr.value)) return null;
  return Number(expr.value);
}

/** decimals in a Decimal string; percent literals arrive already folded */
function decimalsOf(value: string): number {
  const m = /\.(\d+)$/.exec(value);
  return m ? m[1]!.length : 0;
}
