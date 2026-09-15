import { Decimal } from "decimal.js";
import {
  type AliasDecl,
  type Assertion,
  type ChartDecl,
  COMPARISON_OPS,
  type Call,
  type Expr,
  type Ref,
} from "./ast.js";
import { lex } from "./lexer.js";
import { LangError, type Token } from "./token.js";

const LEFT_BP: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "^": 6,
};
const RIGHT_ASSOC = new Set(["^"]);
const UNARY_MINUS_BP = 5;
const UNARY_NOT_BP = 2;

/**
 * Deepest expression the pipeline will accept, guarding *two* different
 * overflows that a single guard does not cover. See
 * docs/design/parser-depth-cap-plan.md.
 *
 * 1. The parser's own recursion. `((((…1…))))` never returns an AST at all —
 *    `parseBp` overflows the stack first (measured: n = 18,751 under Bun on
 *    Linux; `ABS(ABS(…))` and a unary-minus run at n = 12,501).
 * 2. The depth of the tree that *does* come back. `parseBp` consumes a
 *    left-associative chain iteratively, so `1+1+…+1` recurses to depth 1 and
 *    still builds a left-leaning spine as deep as the chain is long. A
 *    recursion counter never fires on it, and five recursive AST walkers then
 *    have to descend it: `evalExpr`, `build`'s `rebase`, `check-report`'s
 *    `visit`, and the walkers in `eval/graph.ts` and `eval/check.ts`. Measured:
 *    `1+1+…+1` at n = 30,000 parses cleanly, then overflows `evalExpr`.
 *
 * So the ceiling is the *shallowest* of those walkers, not the parser, and the
 * figures above are JavaScriptCore's. The CLI ships to Node and the LSP runs
 * under the editor's Node, whose default stack is smaller — hence a cap two
 * orders of magnitude below the smallest number measured anywhere, rather than
 * one tuned close to it. A future walker inherits the budget for free, which is
 * why it lives here, at the only place that produces an `Expr`.
 *
 * 256 is not a squeeze: the deepest formula in this repository's own documents
 * is 5 (`ROUND(MaxNodes * (1 - budget.reserved_capacity) - 0.5, 0)`). The one
 * real input it refuses is a summed-every-column chain over a 300-column table,
 * which is accepted knowingly — it now gets a positioned finding instead of a
 * `RangeError` and a 10,000-frame stack trace.
 */
const MAX_EXPR_DEPTH = 256;

const DEPTH_MESSAGE = `expression nests more than ${MAX_EXPR_DEPTH} levels deep`;

/**
 * Deepest node under `root`, found with an explicit worklist. A recursive
 * guard against runaway recursion would overflow on exactly the input it is
 * meant to refuse, so this one never touches the call stack.
 */
function deepestNode(root: Expr): { depth: number; at: Expr } {
  let best = { depth: 0, at: root };
  const stack: { node: Expr; depth: number }[] = [{ node: root, depth: 1 }];
  for (;;) {
    const top = stack.pop();
    if (top === undefined) break;
    const { node, depth } = top;
    if (depth > best.depth) best = { depth, at: node };
    switch (node.type) {
      case "unary":
        stack.push({ node: node.operand, depth: depth + 1 });
        break;
      case "binary":
        stack.push({ node: node.left, depth: depth + 1 });
        stack.push({ node: node.right, depth: depth + 1 });
        break;
      case "call":
        for (const a of node.args) stack.push({ node: a, depth: depth + 1 });
        break;
      default:
        break;
    }
  }
  return best;
}

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token {
    return this.toks[this.pos]!;
  }
  private next(): Token {
    return this.toks[this.pos++]!;
  }
  private expect(kind: Token["kind"], what: string): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new LangError(`expected ${what}`, t.start, t.end);
    }
    return this.next();
  }

  parseTopLevel(): Expr {
    const expr = this.parseBp(0);
    const t = this.peek();
    if (t.kind !== "eof") {
      throw new LangError(
        `unexpected ${t.kind === "op" ? `operator \`${t.value}\`` : t.kind}`,
        t.start,
        t.end,
      );
    }
    // Guard 2. The recursion counter in parseBp cannot see a left-associative
    // spine, which that loop builds without recursing at all.
    const deepest = deepestNode(expr);
    if (deepest.depth > MAX_EXPR_DEPTH) {
      // Point at the deepest node rather than the whole expression: on a 60 KB
      // line a whole-line span is not a location.
      throw new LangError(DEPTH_MESSAGE, deepest.at.start, deepest.at.end);
    }
    return expr;
  }

  private parseBp(minBp: number): Expr {
    // Guard 1. The decrement is in a `finally` because parseStatement's outer
    // catch inspects and rethrows; a counter leaked on the error path would
    // make a later statement refuse for a depth it never reached.
    if (++this.depth > MAX_EXPR_DEPTH) {
      this.depth--;
      const t = this.peek();
      throw new LangError(DEPTH_MESSAGE, t.start, t.end);
    }
    try {
      return this.parseBpInner(minBp);
    } finally {
      this.depth--;
    }
  }

  private parseBpInner(minBp: number): Expr {
    let left = this.nud();

    for (;;) {
      const t = this.peek();
      if (t.kind !== "op") break;
      const lbp = LEFT_BP[t.value];
      if (lbp === undefined || lbp <= minBp) break;

      if (COMPARISON_OPS.has(t.value) && left.type === "binary" && COMPARISON_OPS.has(left.op)) {
        throw new LangError("comparisons do not chain; use `and` to combine them", t.start, t.end);
      }

      this.next();
      const rbp = RIGHT_ASSOC.has(t.value) ? lbp - 1 : lbp;
      const right = this.parseBp(rbp);
      left = {
        type: "binary",
        op: t.value,
        left,
        right,
        start: left.start,
        end: right.end,
      };
    }
    return left;
  }

  private nud(): Expr {
    const t = this.next();
    switch (t.kind) {
      case "number":
        return { type: "num", value: normNum(t.value), start: t.start, end: t.end };
      case "percent": {
        const folded = new Decimal(t.value).div(100).toString();
        return { type: "num", value: folded, start: t.start, end: t.end };
      }
      case "date":
        return { type: "date", value: t.value, start: t.start, end: t.end };
      case "string":
        return { type: "str", value: t.value, start: t.start, end: t.end };
      case "ident":
        return this.identTail(t);
      case "lparen": {
        const inner = this.parseBp(0);
        const close = this.expect("rparen", "`)`");
        inner.start = t.start;
        inner.end = close.end;
        return inner;
      }
      case "op":
        if (t.value === "-") {
          const operand = this.parseBp(UNARY_MINUS_BP);
          return {
            type: "unary",
            op: "-",
            operand,
            start: t.start,
            end: operand.end,
          };
        }
        if (t.value === "not") {
          const operand = this.parseBp(UNARY_NOT_BP);
          return {
            type: "unary",
            op: "not",
            operand,
            start: t.start,
            end: operand.end,
          };
        }
        throw new LangError(`unexpected operator \`${t.value}\``, t.start, t.end);
      default:
        throw new LangError(`unexpected ${t.kind}`, t.start, t.end);
    }
  }

  private identTail(idTok: Token): Expr {
    if (this.peek().kind === "dot") {
      this.next();
      const nameTok = this.expect("ident", "a name after `.`");
      const ref: Ref = {
        type: "ref",
        qualifier: idTok.value,
        name: nameTok.value,
        start: idTok.start,
        end: nameTok.end,
      };
      return ref;
    }
    if (this.peek().kind === "lparen") {
      this.next();
      const args: Expr[] = [];
      if (this.peek().kind !== "rparen") {
        args.push(this.parseBp(0));
        while (this.peek().kind === "comma") {
          this.next();
          args.push(this.parseBp(0));
        }
      }
      const close = this.expect("rparen", "`)`");
      const call: Call = {
        type: "call",
        name: idTok.value,
        args,
        start: idTok.start,
        end: close.end,
      };
      return call;
    }
    return { type: "ref", name: idTok.value, start: idTok.start, end: idTok.end };
  }
}

function normNum(text: string): string {
  // Preserve the written form's information but drop a redundant leading "+".
  return text;
}

export function parseExpr(src: string): Expr {
  return new Parser(lex(src)).parseTopLevel();
}

export interface Binding {
  name: string;
  expr: Expr;
  nameStart: number;
  nameEnd: number;
  /** true when the left-hand side was a quoted column header, not an identifier */
  quoted: boolean;
}

const LEADING_NAME_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;

export function parseBinding(line: string): Binding {
  try {
    return parseBindingInner(line);
  } catch (e) {
    // A failure anywhere in the line — including in the lexer, before the name
    // is ever tokenised — should still say which binding it came from.
    if (e instanceof LangError && e.bindingName === undefined) {
      const m = LEADING_NAME_RE.exec(line);
      if (m) e.bindingName = m[1];
    }
    throw e;
  }
}

/**
 * Parse one `vmark` block line: an `assert <expression>` statement, or an
 * ordinary `name = expression` binding. `assert` is a keyword — `assert = 1`
 * and a binding named `assert` are rejected here rather than silently parsed.
 */
export function parseStatement(line: string): Binding | Assertion | ChartDecl | AliasDecl {
  try {
    return parseStatementInner(line);
  } catch (e) {
    if (e instanceof LangError && e.bindingName === undefined) {
      const m = LEADING_NAME_RE.exec(line);
      if (m) e.bindingName = m[1];
    }
    throw e;
  }
}

function parseStatementInner(line: string): Binding | Assertion | ChartDecl | AliasDecl {
  const toks = lex(line);
  const first = toks.find((t) => t.kind !== "eof");
  if (first?.kind === "chart") {
    return parseChart(toks, first);
  }
  if (toks.some((t) => t.kind === "chart")) {
    const at = toks.find((t) => t.kind === "chart")!;
    throw new LangError("`chart` is a keyword", at.start, at.end);
  }
  if (first?.kind === "assert") {
    const rest = toks.slice(toks.indexOf(first) + 1);
    if (rest[0]?.kind === "op" && rest[0].value === "=") {
      throw new LangError("`assert` is a keyword", first.start, first.end);
    }
    if (rest.length === 1 && rest[0]!.kind === "eof") {
      throw new LangError("assert needs an expression", first.start, first.end);
    }
    const expr = new Parser(rest).parseTopLevel();
    return { type: "assert", expr, start: first.start, end: expr.end };
  }
  if (toks.some((t) => t.kind === "assert")) {
    const at = toks.find((t) => t.kind === "assert")!;
    throw new LangError("`assert` is a keyword", at.start, at.end);
  }
  if (first?.kind === "string") {
    const afterIdx = toks.indexOf(first) + 1;
    const after = toks[afterIdx];
    if (after?.kind === "is") {
      return parseAlias(toks, first, after);
    }
  }
  if (toks.some((t) => t.kind === "is")) {
    const at = toks.find((t) => t.kind === "is")!;
    throw new LangError("`is` is a keyword", at.start, at.end);
  }
  return parseBinding(line);
}

function parseBindingInner(line: string): Binding {
  const toks = lex(line);
  const eqIndex = toks.findIndex((t) => t.kind === "op" && t.value === "=");
  if (eqIndex === -1) {
    throw new LangError("binding has no `=`", 0, line.length);
  }
  const lhs = toks.slice(0, eqIndex);
  const nameToks = lhs.filter((t) => t.kind !== "eof");
  if (nameToks.length !== 1 || (nameToks[0]!.kind !== "ident" && nameToks[0]!.kind !== "string")) {
    const start = nameToks[0]?.start ?? 0;
    const end = nameToks[nameToks.length - 1]?.end ?? line.length;
    throw new LangError("the left of `=` must be a name or a quoted column header", start, end);
  }
  const nameTok = nameToks[0]!;
  const rhs = toks.slice(eqIndex + 1); // keeps the trailing eof
  const expr = new Parser(rhs).parseTopLevel();
  return {
    name: nameTok.value,
    expr,
    nameStart: nameTok.start,
    nameEnd: nameTok.end,
    quoted: nameTok.kind === "string",
  };
}

const ASPECT_MESSAGE = "aspect needs two positive integers, as `16:9`";

/**
 * `chart <name> as <engine> of <col>[, <col>]* labelled <col> [aspect <w>:<h>]`
 *
 * Operands are bare column names. An expression is refused here rather than
 * parsed, for the same reason `SUM(Price * Qty)` is refused: the calculation
 * model belongs to the language, and a chart consumes it.
 */
function parseChart(toks: Token[], kw: Token): ChartDecl {
  let i = toks.indexOf(kw) + 1;
  const at = (): Token => toks[i] ?? toks[toks.length - 1]!;

  const ident = (what: string): Token => {
    const t = at();
    if (t.kind === "op") {
      throw new LangError("a chart takes a column, not an expression", t.start, t.end);
    }
    if (t.kind !== "ident") {
      throw new LangError(`expected ${what}`, t.start, t.end);
    }
    i++;
    return t;
  };
  const word = (w: string): void => {
    const t = at();
    if (t.kind === "op") {
      throw new LangError("a chart takes a column, not an expression", t.start, t.end);
    }
    if (t.kind !== "ident" || t.value !== w) {
      throw new LangError(`expected \`${w}\``, t.start, t.end);
    }
    i++;
  };

  if (at().kind === "op" && at().value === "=") {
    throw new LangError("`chart` is a keyword", kw.start, kw.end);
  }
  if (at().kind === "ident" && at().value === "as") {
    throw new LangError("a chart needs a name", kw.start, at().end);
  }

  const name = ident("a chart name").value;
  word("as");
  const engineHead = ident("a chart type");
  let engine = engineHead.value;
  // a hyphenated built-in name like `stacked-bar` lexes as ident, op, ident;
  // joined here, and only here, when the pieces are written with no spaces
  if (at().kind === "op" && at().value === "-" && at().start === engineHead.end) {
    const dash = at();
    i++;
    const tail = at();
    if (tail.kind !== "ident" || tail.start !== dash.end) {
      throw new LangError("expected a chart type", engineHead.start, dash.end);
    }
    i++;
    engine = `${engine}-${tail.value}`;
  }
  word("of");

  // a qualified `sheet.Col` parses here and is refused later as a VECTOR
  // finding, the same way any foreign column is — a parse error would hide
  // the real rule behind a syntax complaint
  const colRef = (what: string): string => {
    const head = ident(what).value;
    if (at().kind === "dot") {
      i++;
      return `${head}.${ident(what).value}`;
    }
    return head;
  };

  const series: string[] = [];
  for (;;) {
    series.push(colRef("a column name"));
    if (at().kind === "comma") {
      i++;
      continue;
    }
    break;
  }

  word("labelled");
  const labels = colRef("a label column");

  let aspect: { w: number; h: number } | null = null;
  if (at().kind === "ident" && at().value === "aspect") {
    const kwAspect = at();
    i++;
    const w = at();
    if (w.kind !== "number") throw new LangError(ASPECT_MESSAGE, kwAspect.start, w.end);
    i++;
    if (at().kind !== "colon") throw new LangError(ASPECT_MESSAGE, kwAspect.start, at().end);
    i++;
    const h = at();
    if (h.kind !== "number") throw new LangError(ASPECT_MESSAGE, kwAspect.start, h.end);
    i++;
    const wn = Number(w.value);
    const hn = Number(h.value);
    if (!Number.isInteger(wn) || !Number.isInteger(hn) || wn < 1 || hn < 1) {
      throw new LangError(ASPECT_MESSAGE, kwAspect.start, h.end);
    }
    aspect = { w: wn, h: hn };
  }

  const end = at();
  if (end.kind !== "eof") {
    throw new LangError(
      `unexpected ${end.kind === "op" ? `operator \`${end.value}\`` : end.kind}`,
      end.start,
      end.end,
    );
  }
  return { type: "chart", name, engine, series, labels, aspect, start: kw.start, end: end.start };
}

/** `"<header>" is <symbol>` — see docs/design/human-readable-column-aliases-spec.md */
function parseAlias(toks: Token[], headerTok: Token, isTok: Token): AliasDecl {
  let i = toks.indexOf(isTok) + 1;
  const at = (): Token => toks[i] ?? toks[toks.length - 1]!;

  const symTok = at();
  if (symTok.kind !== "ident") {
    throw new LangError("expected a name after `is`", symTok.start, symTok.end);
  }
  i++;

  const end = at();
  if (end.kind !== "eof") {
    throw new LangError(
      `unexpected ${end.kind === "op" ? `operator \`${end.value}\`` : end.kind}`,
      end.start,
      end.end,
    );
  }
  return {
    type: "alias",
    header: headerTok.value,
    symbol: symTok.value,
    start: headerTok.start,
    end: symTok.end,
  };
}
