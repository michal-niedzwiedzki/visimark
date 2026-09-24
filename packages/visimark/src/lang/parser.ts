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
import type { Domain, Leaf, PresetName, RangeLeaf, SetLeaf } from "./domain.js";
import { lex } from "./lexer.js";
import { DELIM_OPENER_OF, DELIM_PAIRS } from "./notation.js";
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
 * figures above are JavaScriptCore's. That distinction is not academic: the CLI
 * ships to Node and the LSP runs under the editor's Node, and `acceptance-node`
 * measures the same synthetic walker at **9,520 levels under Node 20 against
 * 31,925 under Bun** — V8's usable stack here is 3.3x smaller. A cap chosen
 * against the Bun figure alone would have about a third of the margin it
 * appeared to have.
 *
 * Hence a cap two orders of magnitude below the smallest number measured
 * anywhere, rather than one tuned close to it, and `scripts/stack-headroom.mjs`
 * re-measuring on every CI run so this comment cannot quietly go stale. A
 * future walker inherits the budget for free, which is why it lives here, at
 * the only place that produces an `Expr`.
 *
 * 256 is not a squeeze: the deepest formula in this repository's own documents
 * is 5 (`ROUND(MaxNodes * (1 - budget.reserved_capacity) - 0.5, 0)`). The one
 * real input it refuses is a summed-every-column chain over a 300-column table,
 * which is accepted knowingly — it now gets a positioned finding instead of a
 * `RangeError` and a 10,000-frame stack trace.
 *
 * The declaration below is read verbatim by `scripts/stack-headroom.mjs`, so
 * that the headroom CI checks is the cap actually in force. Renaming or
 * reformatting this line fails that check loudly rather than silently; update
 * the pattern there too.
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
        `unexpected ${t.kind === "op" ? `operator \`${t.value}\`` : t.kind === "delim" ? `\`${t.value}\`` : t.kind}`,
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
      case "delim": {
        // `|x|`, `⌊x⌋`, `⌈x⌉`: a pair resolved to the call it stands for. A
        // delimiter in operand position always opens; after an operand it has
        // no binding power, so the inner expression stops there and the pair's
        // closer is consumed below. That is what lets `|` nest without lookahead.
        const pair = DELIM_PAIRS[t.value];
        if (!pair) {
          throw new LangError(
            `\`${t.value}\` has no opening \`${DELIM_OPENER_OF[t.value]}\``,
            t.start,
            t.end,
          );
        }
        const inner = this.parseBp(0);
        const close = this.peek();
        if (close.kind !== "delim" || close.value !== pair.close) {
          throw new LangError(`expected \`${pair.close}\``, close.start, close.end);
        }
        this.next();
        const args: Expr[] = [inner];
        // The notation itself supplies the step, and the closing glyph is the
        // span it points at, so no finding lands on text the author never wrote.
        if (pair.step !== undefined) {
          args.push({ type: "num", value: pair.step, start: close.start, end: close.end });
        }
        return { type: "call", name: pair.fn, args, start: t.start, end: close.end };
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
  /** declared write precision, from a `precision N` clause on the head */
  precision?: number;
  /** set on a `param NAME precision N = default LITERAL` statement: the default
   *  literal as written, and whether it was a percent literal. See
   *  docs/design/scenario-params-spec.md. */
  param?: { text: string; percent: boolean };
  /** a `param`'s optional domain clause. See
   *  docs/design/a-param-declares-the-set-of-values-it-ac-spec.md §2. */
  domain?: Domain;
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
  // `param` is contextual: the keyword only as the first token and followed by
  // a name, so `param = 5` and `param precision 2 = …` stay ordinary bindings.
  if (first?.kind === "ident" && first.value === "param") {
    const second = toks[toks.indexOf(first) + 1];
    if (second?.kind === "ident" || second?.kind === "string") {
      return parseParam(line, toks, first, second);
    }
  }
  // A `precision` clause belongs on the binding head, where `parseBindingInner`
  // takes it from. Anywhere to the right of `=` it is a keyword inside an
  // expression, which is never legal.
  const eqAt = toks.findIndex((t) => t.kind === "op" && t.value === "=");
  const precAt = toks.findIndex((t) => t.kind === "precision");
  if (precAt !== -1 && eqAt !== -1 && precAt > eqAt) {
    const at = toks[precAt]!;
    throw new LangError("`precision` is a keyword", at.start, at.end);
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
  const headToks = lhs.filter((t) => t.kind !== "eof");
  const { nameToks, precision } = takePrecisionClause(headToks);
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
    ...(precision === undefined ? {} : { precision }),
  };
}

export const PARAM_DEFAULT_MESSAGE = "a param default must be a number literal";

/**
 * `param NAME [precision N] = default LITERAL` — see
 * docs/design/scenario-params-spec.md §2. A missing `precision` clause is not
 * a parse error: the binding is returned without one and `check` reports
 * `PRECISION`, as it does for any binding whose width is required.
 */
function parseParam(line: string, toks: Token[], kw: Token, nameTok: Token): Binding {
  try {
    return parseParamInner(line, toks, kw, nameTok);
  } catch (e) {
    // `LEADING_NAME_RE` cannot see past the `param` keyword, so name the
    // binding here or its findings would print as a bare `sheet.`
    if (e instanceof LangError && e.bindingName === undefined) e.bindingName = nameTok.value;
    throw e;
  }
}

function parseParamInner(line: string, toks: Token[], kw: Token, nameTok: Token): Binding {
  if (nameTok.kind === "string") {
    throw new LangError(
      "a param name must be an identifier, not a quoted header",
      nameTok.start,
      nameTok.end,
    );
  }
  const eqIndex = toks.findIndex((t) => t.kind === "op" && t.value === "=");
  if (eqIndex === -1) {
    throw new LangError("binding has no `=`", kw.start, line.length);
  }
  const head = toks.slice(toks.indexOf(nameTok), eqIndex);
  let rest = head.slice(1); // past `nameTok`
  let precision: number | undefined;
  if (rest[0]?.kind === "precision") {
    const kw = rest[0]!;
    const digits = rest[1];
    if (!digits || digits.kind !== "number" || !/^\d+$/.test(digits.value)) {
      const start = digits?.start ?? kw.start;
      const end = digits?.end ?? kw.end;
      throw new LangError(PRECISION_RANGE_MESSAGE, start, end);
    }
    const n = Number(digits.value);
    if (!Number.isInteger(n) || n < 0 || n > MAX_PRECISION) {
      throw new LangError(PRECISION_RANGE_MESSAGE, digits.start, digits.end);
    }
    precision = n;
    rest = rest.slice(2);
  }
  const domain = rest.length === 0 ? undefined : parseParamDomainClause(line, rest);
  const dflt = toks[eqIndex + 1]!;
  if (dflt.kind !== "ident" || dflt.value !== "default") {
    throw new LangError("expected `default` after `=` in a param", dflt.start, dflt.end);
  }
  let i = eqIndex + 2;
  let negative = false;
  const litStart = toks[i]!.start;
  if (toks[i]?.kind === "op" && toks[i]!.value === "-") {
    negative = true;
    i++;
  }
  const lit = toks[i]!;
  if ((lit.kind !== "number" && lit.kind !== "percent") || toks[i + 1]?.kind !== "eof") {
    const at = toks[eqIndex + 2]!;
    throw new LangError(PARAM_DEFAULT_MESSAGE, at.start, Math.max(line.length, at.end));
  }
  const percent = lit.kind === "percent";
  // the written digits are kept, as `nud` keeps them for any number literal;
  // a percent folds exactly as it does there
  const magnitude = percent ? new Decimal(lit.value).div(100).toString() : lit.value;
  const value = negative ? `-${magnitude}` : magnitude;
  return {
    name: nameTok.value,
    expr: { type: "num", value, start: litStart, end: lit.end },
    nameStart: nameTok.start,
    nameEnd: nameTok.end,
    quoted: false,
    ...(precision === undefined ? {} : { precision }),
    param: { text: line.slice(litStart, lit.end), percent },
    ...(domain === undefined ? {} : { domain }),
  };
}

export const PARAM_DOMAIN_LITERAL_MESSAGE = "a param domain bound must be a number literal";
export const PARAM_DOMAIN_MALFORMED_MESSAGE = "malformed param domain clause";
const PARAM_DOMAIN_PRESETS = new Set<PresetName>(["integer", "positive", "natural"]);

/**
 * `[PRESET] [in DOMAIN-EXPR]`, the optional clause on a `param` header
 * between `precision N` and `= default LITERAL`. See
 * docs/design/a-param-declares-the-set-of-values-it-ac-spec.md §2. `tokens`
 * is whatever remains of the head after the name and an optional precision
 * clause; every glyph spelling (`∈`, `ℤ`, `ℕ`, `ℤ⁺`) has already lexed as its
 * keyword equivalent by this point, so this function reads keywords only.
 */
function parseParamDomainClause(line: string, tokens: Token[]): Domain {
  let i = 0;
  const parts: Leaf[] = [];
  const first = tokens[0];
  if (first?.kind === "ident" && first.value !== "in") {
    if (
      first.value === "positive" &&
      tokens[1]?.kind === "ident" &&
      tokens[1]!.value === "integer"
    ) {
      parts.push({ kind: "preset", name: "positive integer", text: "positive integer" });
      i = 2;
    } else if (PARAM_DOMAIN_PRESETS.has(first.value as PresetName)) {
      parts.push({ kind: "preset", name: first.value as PresetName, text: first.value });
      i = 1;
    } else {
      throw new LangError(
        `unrecognised param domain preset \`${first.value}\``,
        first.start,
        first.end,
      );
    }
  }
  const inTok = tokens[i];
  if (inTok) {
    if (inTok.kind !== "ident" || inTok.value !== "in") {
      throw new LangError(
        PARAM_DOMAIN_MALFORMED_MESSAGE,
        inTok.start,
        tokens[tokens.length - 1]!.end,
      );
    }
    const { leaf, next } = parseDomainRangeOrSet(line, tokens, i + 1);
    parts.push(leaf);
    i = next;
  }
  if (i !== tokens.length) {
    const extra = tokens[i]!;
    throw new LangError(
      PARAM_DOMAIN_MALFORMED_MESSAGE,
      extra.start,
      tokens[tokens.length - 1]!.end,
    );
  }
  return { parts };
}

function parseDomainRangeOrSet(
  line: string,
  tokens: Token[],
  i: number,
): { leaf: Leaf; next: number } {
  const open = tokens[i];
  if (!open) {
    throw new LangError(PARAM_DOMAIN_MALFORMED_MESSAGE, line.length, line.length);
  }
  if (open.kind === "lbrace") return parseDomainSet(line, tokens, i);
  if (open.kind === "lparen" || open.kind === "lbracket") return parseDomainRange(line, tokens, i);
  throw new LangError(PARAM_DOMAIN_MALFORMED_MESSAGE, open.start, open.end);
}

function parseDomainLiteral(
  line: string,
  tokens: Token[],
  i: number,
): { value: string; literal: { text: string; percent: boolean }; next: number } {
  const first = tokens[i];
  if (!first) {
    throw new LangError(PARAM_DOMAIN_LITERAL_MESSAGE, line.length, line.length);
  }
  const start = first.start;
  let negative = false;
  let j = i;
  if (tokens[j]?.kind === "op" && tokens[j]!.value === "-") {
    negative = true;
    j++;
  }
  const lit = tokens[j];
  if (!lit || (lit.kind !== "number" && lit.kind !== "percent")) {
    throw new LangError(PARAM_DOMAIN_LITERAL_MESSAGE, start, lit?.end ?? start);
  }
  const percent = lit.kind === "percent";
  const magnitude = percent ? new Decimal(lit.value).div(100).toString() : lit.value;
  const value = negative ? `-${magnitude}` : magnitude;
  return { value, literal: { text: line.slice(start, lit.end), percent }, next: j + 1 };
}

function parseDomainRange(
  line: string,
  tokens: Token[],
  i: number,
): { leaf: RangeLeaf; next: number } {
  const openTok = tokens[i]!;
  const loClosed = openTok.kind === "lbracket";
  let j = i + 1;
  let lo: string | undefined;
  let loLiteral: { text: string; percent: boolean } | undefined;
  if (tokens[j]?.kind !== "comma") {
    const parsed = parseDomainLiteral(line, tokens, j);
    lo = parsed.value;
    loLiteral = parsed.literal;
    j = parsed.next;
  }
  const comma = tokens[j];
  if (!comma || comma.kind !== "comma") {
    throw new LangError(PARAM_DOMAIN_MALFORMED_MESSAGE, openTok.start, comma?.end ?? openTok.end);
  }
  j++;
  let hi: string | undefined;
  let hiLiteral: { text: string; percent: boolean } | undefined;
  const closeAhead = tokens[j]?.kind === "rparen" || tokens[j]?.kind === "rbracket";
  if (!closeAhead) {
    const parsed = parseDomainLiteral(line, tokens, j);
    hi = parsed.value;
    hiLiteral = parsed.literal;
    j = parsed.next;
  }
  const closeTok = tokens[j];
  if (!closeTok || (closeTok.kind !== "rparen" && closeTok.kind !== "rbracket")) {
    throw new LangError(
      PARAM_DOMAIN_MALFORMED_MESSAGE,
      openTok.start,
      closeTok?.end ?? openTok.end,
    );
  }
  const hiClosed = closeTok.kind === "rbracket";
  j++;
  if (lo === undefined && loClosed) {
    throw new LangError(PARAM_DOMAIN_MALFORMED_MESSAGE, openTok.start, openTok.end);
  }
  if (hi === undefined && hiClosed) {
    throw new LangError(PARAM_DOMAIN_MALFORMED_MESSAGE, closeTok.start, closeTok.end);
  }
  return {
    leaf: {
      kind: "range",
      ...(lo === undefined ? {} : { lo, loLiteral }),
      loClosed,
      ...(hi === undefined ? {} : { hi, hiLiteral }),
      hiClosed,
      text: line.slice(openTok.start, closeTok.end),
    },
    next: j,
  };
}

function parseDomainSet(line: string, tokens: Token[], i: number): { leaf: SetLeaf; next: number } {
  const openTok = tokens[i]!;
  let j = i + 1;
  const members: string[] = [];
  const memberLiterals: { text: string; percent: boolean }[] = [];
  if (tokens[j]?.kind !== "rbrace") {
    for (;;) {
      const parsed = parseDomainLiteral(line, tokens, j);
      members.push(parsed.value);
      memberLiterals.push(parsed.literal);
      j = parsed.next;
      if (tokens[j]?.kind === "comma") {
        j++;
        continue;
      }
      break;
    }
  }
  const closeTok = tokens[j];
  if (!closeTok || closeTok.kind !== "rbrace") {
    throw new LangError(
      PARAM_DOMAIN_MALFORMED_MESSAGE,
      openTok.start,
      closeTok?.end ?? openTok.end,
    );
  }
  j++;
  return {
    leaf: { kind: "set", members, memberLiterals, text: line.slice(openTok.start, closeTok.end) },
    next: j,
  };
}

export const PRECISION_RANGE_MESSAGE = "precision must be a whole number from 0 to 18";
export const PRECISION_KEYWORD_MESSAGE =
  "`precision` is a keyword — write `precision 2`, not `precision = 2`";
/** the widest declarable width: `Decimal.precision` is 40 significant digits,
 *  so 18 decimals stays exact for integer parts up to 22 digits. See
 *  docs/design/declared-precision-spec.md section 3.5. */
const MAX_PRECISION = 18;

/**
 * Split a `precision N` clause off the end of a binding head, leaving the name
 * tokens. The head is already multi-token for `"Header" is symbol`, so a
 * trailing clause needs no new grammar layer — only that the clause is last.
 */
function takePrecisionClause(head: Token[]): { nameToks: Token[]; precision?: number } {
  const kwIndex = head.findIndex((t) => t.kind === "precision");
  if (kwIndex === -1) return { nameToks: head };
  const kw = head[kwIndex]!;
  if (kwIndex === 0) {
    // `precision = 2` — the removed document-scope constant.
    throw new LangError(PRECISION_KEYWORD_MESSAGE, kw.start, kw.end);
  }
  const rest = head.slice(kwIndex + 1);
  const digits = rest[0];
  if (rest.length !== 1 || digits?.kind !== "number" || !/^\d+$/.test(digits.value)) {
    const start = digits?.start ?? kw.start;
    const end = rest[rest.length - 1]?.end ?? kw.end;
    throw new LangError(PRECISION_RANGE_MESSAGE, start, end);
  }
  const n = Number(digits.value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_PRECISION) {
    throw new LangError(PRECISION_RANGE_MESSAGE, digits.start, digits.end);
  }
  return { nameToks: head.slice(0, kwIndex), precision: n };
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
