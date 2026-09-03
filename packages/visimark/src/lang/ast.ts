export interface Pos {
  start: number;
  end: number;
}

export interface NumberLit extends Pos {
  type: "num";
  /** Decimal string. Percent literals are folded here (`23%` -> `"0.23"`). */
  value: string;
}
export interface DateLit extends Pos {
  type: "date";
  value: string;
}
export interface StrLit extends Pos {
  type: "str";
  value: string;
}
export interface BoolLit extends Pos {
  type: "bool";
  value: boolean;
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

export type Expr =
  | NumberLit
  | DateLit
  | StrLit
  | BoolLit
  | Ref
  | Unary
  | Binary
  | Call;

export const COMPARISON_OPS = new Set(["==", "!=", "<", "<=", ">", ">="]);
