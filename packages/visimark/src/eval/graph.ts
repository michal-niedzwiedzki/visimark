import type { Call, Expr, Ref } from "../lang/ast.js";
import { closest } from "../report/levenshtein.js";
import type { Assertion, Binding, Chart, DocModel } from "../model/types.js";
import { type CallProblem, callProblem, isReduce } from "./functions.js";

/**
 * A `Binding`-shaped view of an assertion, so it flows through the dependency
 * walk and the topological sort like any node. It stores nothing and is never
 * a column rule, so `name` is empty and `kind` is `"scalar"` — a foreign or
 * own-sheet column reference in an assertion therefore lands in `vectorRefs`,
 * which is the scalar-only rule (spec §2) falling out for free.
 */
export function assertionNode(a: Assertion): Binding {
  return { id: a.id, sheetId: a.sheetId, name: "", expr: a.expr, kind: "scalar", span: a.span };
}

/**
 * A chart as a graph node. The expression is **synthetic** — a chain over the
 * series and label columns, built only so the ordinary dependency walk finds
 * them. It is never evaluated: `check` handles charts on their own branch, so
 * the arithmetic implied by the chain never runs.
 *
 * `kind` is `"column"` rather than `"scalar"` deliberately. That is what makes
 * a same-sheet column reference legal (a chart consumes columns) while a
 * foreign one stays a `VECTOR` error, with no rule of its own.
 */
export function chartNode(c: Chart): Binding {
  const names = [...c.series, c.labels];
  const refs: Expr[] = names.map((full) => {
    const dot = full.indexOf(".");
    return {
      type: "ref" as const,
      ...(dot === -1
        ? { name: full }
        : { qualifier: full.slice(0, dot), name: full.slice(dot + 1) }),
      start: c.span.start,
      end: c.span.end,
    };
  });
  let expr: Expr = refs[0]!;
  for (let i = 1; i < refs.length; i++) {
    expr = {
      type: "binary",
      op: "+",
      left: expr,
      right: refs[i]!,
      start: c.span.start,
      end: c.span.end,
    };
  }
  return { id: c.id, sheetId: c.sheetId, name: c.name, expr, kind: "column", span: c.span };
}

export type Resolution =
  | { kind: "column"; binding: Binding; sheetId: string }
  | { kind: "scalar"; binding: Binding; sheetId: string }
  | { kind: "doc-scalar"; binding: Binding; sheetId: "" }
  | { kind: "input-column"; sheetId: string; column: string }
  | { kind: "unknown"; suggestion: string | null; badName: string };

export function refText(ref: Ref): string {
  return ref.qualifier ? `${ref.qualifier}.${ref.name}` : ref.name;
}

export function resolve(
  model: DocModel,
  fromSheetId: string,
  ref: { qualifier?: string; name: string },
): Resolution {
  if (ref.qualifier) {
    const sheet = model.sheets.get(ref.qualifier);
    if (!sheet) {
      return {
        kind: "unknown",
        badName: `${ref.qualifier}.${ref.name}`,
        suggestion: closest(ref.qualifier, model.sheets.keys()),
      };
    }
    const col = sheet.columns.get(ref.name);
    if (col) return { kind: "column", binding: col, sheetId: sheet.id };
    if (sheet.inputColumns.has(ref.name)) {
      return { kind: "input-column", sheetId: sheet.id, column: ref.name };
    }
    const sc = sheet.scalars.get(ref.name);
    if (sc) return { kind: "scalar", binding: sc, sheetId: sheet.id };
    return {
      kind: "unknown",
      badName: `${ref.qualifier}.${ref.name}`,
      suggestion: closest(ref.name, [
        ...sheet.columns.keys(),
        ...sheet.inputColumns,
        ...sheet.scalars.keys(),
      ]),
    };
  }

  const sheet = model.sheets.get(fromSheetId);
  if (sheet) {
    const col = sheet.columns.get(ref.name);
    if (col) return { kind: "column", binding: col, sheetId: sheet.id };
    if (sheet.inputColumns.has(ref.name)) {
      return { kind: "input-column", sheetId: sheet.id, column: ref.name };
    }
    const sc = sheet.scalars.get(ref.name);
    if (sc) return { kind: "scalar", binding: sc, sheetId: sheet.id };
  }
  const doc = model.docScope.get(ref.name);
  if (doc) return { kind: "doc-scalar", binding: doc, sheetId: "" };

  const candidates = new Set<string>(model.docScope.keys());
  if (sheet) {
    for (const k of sheet.columns.keys()) candidates.add(k);
    for (const k of sheet.inputColumns) candidates.add(k);
    for (const k of sheet.scalars.keys()) candidates.add(k);
  }
  return {
    kind: "unknown",
    badName: ref.name,
    suggestion: closest(ref.name, candidates),
  };
}

export interface DepInfo {
  refs: { ref: Ref; res: Resolution }[];
  deps: Set<string>;
  vectorRefs: Ref[];
  undefRefs: Ref[];
  /** calls that are malformed on their face — wrong name, arity or argument shape */
  callErrors: { call: Call; problem: CallProblem }[];
}

export function dependencies(model: DocModel, binding: Binding): DepInfo {
  const info: DepInfo = {
    refs: [],
    deps: new Set(),
    vectorRefs: [],
    undefRefs: [],
    callErrors: [],
  };

  const visit = (node: Expr, inAggregate: boolean): void => {
    switch (node.type) {
      case "ref": {
        const res = resolve(model, binding.sheetId, node);
        info.refs.push({ ref: node, res });
        if (res.kind === "unknown") {
          info.undefRefs.push(node);
          return;
        }
        if (res.kind === "column") {
          const foreign = res.sheetId !== binding.sheetId;
          const ownColumnRule = binding.kind === "column" && !foreign;
          if (inAggregate) {
            info.deps.add(res.binding.id);
          } else if (ownColumnRule) {
            // row-wise use of a sibling column rule: legal, binding-level dep
            info.deps.add(res.binding.id);
          } else {
            info.vectorRefs.push(node);
          }
        } else if (res.kind === "input-column") {
          const foreign = res.sheetId !== binding.sheetId;
          const ownColumnRule = binding.kind === "column" && !foreign;
          if (!inAggregate && !ownColumnRule) {
            info.vectorRefs.push(node);
          }
          // inputs are leaves: no binding-level dependency edge
        } else {
          info.deps.add(res.binding.id);
        }
        return;
      }
      case "call": {
        const problem = callProblem(node.name, node.args);
        if (problem) info.callErrors.push({ call: node, problem });
        // A malformed reduce still gates its arguments as one, so a column
        // reference inside it is not also reported as a stray vector.
        const agg = isReduce(node.name);
        for (const a of node.args) visit(a, inAggregate || agg);
        return;
      }
      case "unary":
        visit(node.operand, inAggregate);
        return;
      case "binary":
        visit(node.left, inAggregate);
        visit(node.right, inAggregate);
        return;
    }
  };

  if (!binding.parseError) visit(binding.expr, false);
  return info;
}

export interface TopoResult {
  order: Binding[];
  cycles: Binding[][];
  depMap: Map<string, DepInfo>;
  /** ids in `order` that are assertions, not bindings */
  assertionIds: Set<string>;
  chartIds: Set<string>;
}

export function topoOrder(model: DocModel): TopoResult {
  const nodes = new Map<string, Binding>();
  const assertionIds = new Set<string>();
  const chartIds = new Set<string>();
  for (const b of model.docScope.values()) nodes.set(b.id, b);
  for (const sheet of model.sheets.values()) {
    for (const b of sheet.columns.values()) nodes.set(b.id, b);
    for (const b of sheet.scalars.values()) nodes.set(b.id, b);
    for (const a of sheet.assertions) {
      nodes.set(a.id, assertionNode(a));
      assertionIds.add(a.id);
    }
    for (const c of sheet.charts) {
      nodes.set(c.id, chartNode(c));
      chartIds.add(c.id);
    }
  }

  const docOrder = [...nodes.keys()];
  const rank = new Map(docOrder.map((id, i) => [id, i]));

  const depMap = new Map<string, DepInfo>();
  const deps = new Map<string, Set<string>>();
  for (const [id, b] of nodes) {
    const info = dependencies(model, b);
    depMap.set(id, info);
    deps.set(id, new Set([...info.deps].filter((d) => nodes.has(d))));
  }

  // Kahn's algorithm for the acyclic prefix
  const indeg = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    indeg.set(id, 0);
    dependents.set(id, []);
  }
  for (const [id, ds] of deps) {
    for (const d of ds) {
      indeg.set(id, indeg.get(id)! + 1);
      dependents.get(d)!.push(id);
    }
  }

  const ready = docOrder.filter((id) => indeg.get(id) === 0);
  ready.sort((a, b) => rank.get(a)! - rank.get(b)!);
  const order: Binding[] = [];
  const emitted = new Set<string>();
  while (ready.length) {
    const id = ready.shift()!;
    order.push(nodes.get(id)!);
    emitted.add(id);
    for (const dep of dependents.get(id)!) {
      indeg.set(dep, indeg.get(dep)! - 1);
      if (indeg.get(dep) === 0) {
        // insert keeping document order
        const r = rank.get(dep)!;
        let k = 0;
        while (k < ready.length && rank.get(ready[k]!)! < r) k++;
        ready.splice(k, 0, dep);
      }
    }
  }

  const stuck = docOrder.filter((id) => !emitted.has(id));
  const cycles = extractCycles(stuck, deps, nodes, rank);

  return { order, cycles, depMap, assertionIds, chartIds };
}

function extractCycles(
  stuck: string[],
  deps: Map<string, Set<string>>,
  nodes: Map<string, Binding>,
  rank: Map<string, number>,
): Binding[][] {
  const stuckSet = new Set(stuck);
  const sccs = tarjan(stuck, deps, stuckSet);
  const cycles: Binding[][] = [];
  for (const scc of sccs) {
    if (scc.length === 1 && !deps.get(scc[0]!)!.has(scc[0]!)) continue;
    const member = new Set(scc);
    // data-flow successors: m depends on n  =>  edge n -> m
    const flow = new Map<string, string[]>();
    for (const n of scc) flow.set(n, []);
    for (const m of scc) {
      for (const d of deps.get(m)!) {
        if (member.has(d)) flow.get(d)!.push(m);
      }
    }
    for (const succs of flow.values()) {
      succs.sort((a, b) => rank.get(a)! - rank.get(b)!);
    }
    const start = [...scc].sort((a, b) => rank.get(a)! - rank.get(b)!)[0]!;
    const path: string[] = [start];
    let cur = start;
    for (;;) {
      const succs = flow.get(cur)!;
      const fresh = succs.find((s) => !path.includes(s));
      const next = fresh ?? (succs.includes(start) ? start : undefined);
      if (next === undefined) break;
      path.push(next);
      if (next === start) break;
      cur = next;
    }
    cycles.push(path.map((id) => nodes.get(id)!));
  }
  return cycles;
}

function tarjan(ids: string[], deps: Map<string, Set<string>>, within: Set<string>): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];

  const strongconnect = (v: string): void => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of deps.get(v) ?? []) {
      if (!within.has(w)) continue;
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      for (;;) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      out.push(comp);
    }
  };

  for (const v of ids) if (!idx.has(v)) strongconnect(v);
  return out;
}
