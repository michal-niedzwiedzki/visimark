export interface Pos {
  start: number;
  end: number;
}

/** the raw text of a unit bracket, without the brackets; `start`/`end` span
 *  the brackets themselves */
export interface UnitText extends Pos {
  text: string;
}

export interface NumberLit extends Pos {
  type: "num";
  /** Decimal string. Percent literals are folded here (`23%` -> `"0.23"`). */
  value: string;
  /** a unit written on the literal, `10 [PLN]` */
  unit?: UnitText;
  /** true when the literal was written with `%` — a ratio, never given a unit */
  percent?: boolean;
  /** true for the step `⌊x⌋` and `⌈x⌉` supply themselves: it takes `x`'s unit */
  implicitStep?: boolean;
}
export interface DateLit extends Pos {
  type: "date";
  value: string;
}
export interface StrLit extends Pos {
  type: "str";
  value: string;
}
export interface Ref extends Pos {
  type: "ref";
  name: string;
  qualifier?: string;
}
export interface Unary extends Pos {
  type: "unary";
  op: "-" | "not";
  operand: Expr;
}
export interface Binary extends Pos {
  type: "binary";
  op: string;
  left: Expr;
  right: Expr;
}
export interface Call extends Pos {
  type: "call";
  name: string;
  args: Expr[];
}

export type Expr = NumberLit | DateLit | StrLit | Ref | Unary | Binary | Call;

export const COMPARISON_OPS = new Set(["==", "!=", "<", "<=", ">", ">="]);

/** An `assert <expression>` statement. Binds nothing; carries an invariant that
 *  `check` evaluates. See the design doc, section 17. */
export interface Assertion extends Pos {
  type: "assert";
  expr: Expr;
}

/** A `chart <name> as <engine> of <cols> labelled <col> [aspect w:h]` statement.
 *  Binds nothing and produces no value; it declares a generated artifact.
 *  Operands are bare column names — a chart consumes the calculation model,
 *  it does not extend it. */
export interface ChartDecl extends Pos {
  type: "chart";
  name: string;
  engine: string;
  series: string[];
  labels: string;
  aspect: { w: number; h: number } | null;
}

/** A `[atom] = [unit]` statement: a scale-1 unit definition. Binds no value.
 *  See docs/design/algebraic-unit-maps-on-names-spec.md §2.5. */
export interface UnitDef extends Pos {
  type: "unitdef";
  atom: UnitText;
  unit: UnitText;
}

/** A `"<header>" is <symbol>` statement. Binds no expression; declares that
 *  `symbol` is a second, formula-facing name for the column whose GFM header
 *  is `header`, exactly as `header` itself would be if it were an identifier.
 *  See docs/design/human-readable-column-aliases-spec.md. */
export interface AliasDecl extends Pos {
  type: "alias";
  header: string;
  symbol: string;
}
