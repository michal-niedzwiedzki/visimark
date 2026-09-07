import { Decimal } from "decimal.js";
import {
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

class Parser {
  private pos = 0;
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
    return expr;
  }

  private parseBp(minBp: number): Expr {
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
export function parseStatement(line: string): Binding | Assertion | ChartDecl {
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

function parseStatementInner(line: string): Binding | Assertion | ChartDecl {
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
  if (nameToks.length !== 1 || nameToks[0]!.kind !== "ident") {
    const start = nameToks[0]?.start ?? 0;
    const end = nameToks[nameToks.length - 1]?.end ?? line.length;
    throw new LangError("the left of `=` must be a single name", start, end);
  }
  const nameTok = nameToks[0]!;
  const rhs = toks.slice(eqIndex + 1); // keeps the trailing eof
  const expr = new Parser(rhs).parseTopLevel();
  return {
    name: nameTok.value,
    expr,
    nameStart: nameTok.start,
    nameEnd: nameTok.end,
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
  const engine = ident("a chart type").value;
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
    throw new LangError(`unexpected ${end.kind === "op" ? `operator \`${end.value}\`` : end.kind}`, end.start, end.end);
  }
  return { type: "chart", name, engine, series, labels, aspect, start: kw.start, end: end.start };
}
