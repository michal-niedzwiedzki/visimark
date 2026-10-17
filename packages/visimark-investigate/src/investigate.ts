import { applyEdits } from "./apply.js";
import { cellKey } from "./ids.js";
import { maskMarkdown } from "./mask.js";
import type { Skipped } from "./policy.js";
import { computePosture } from "./posture.js";
import { repoReader } from "./reader.js";
import { blobUrl } from "./repo.js";
import { engineInfer } from "./rules/engine-infer.js";
import { RULES } from "./rules/registry.js";
import { readTables } from "./tables.js";
import {
  tableKey,
  type DocInput,
  type Engine,
  type Finding,
  type RawFinding,
  type Report,
  type Rule,
  type RuleContext,
} from "./types.js";

export interface InvestigateInput {
  repo: { label: string; host: string | null; commit: string; lastCommit: string | null };
  engineVersion: string;
  /** every tracked blob, all types — posture reads it */
  paths: { path: string; size: number }[];
  /** the Markdown the policy kept, plus any import targets */
  texts: Map<string, string>;
  /** from `selectFiles`, plus the shell's `generated` and `fetch-failed` entries */
  skipped: Skipped[];
  /** `.github/workflows/*.y(a)ml` texts, or null when they could not be read */
  workflowTexts: string[] | null;
  clonePath: string | null;
}

const MARKDOWN = /\.(md|markdown)$/i;

function docInput(path: string, text: string): DocInput {
  const masked = maskMarkdown(text);
  return { path, text, masked, tables: readTables(masked) };
}

/**
 * One investigation: every rule over every document the shell read, merged
 * per cell and rated on accuracy, adoption and posture (spec §3–§4). Pure —
 * the same input gives the same Report in the CLI and in the browser.
 */
export function investigate(
  input: InvestigateInput,
  engine: Engine,
  rules: readonly Rule[] = RULES,
): Report {
  const skippedPaths = new Set(input.skipped.map((s) => s.path));
  const docs = [...input.texts.keys()]
    .filter((p) => MARKDOWN.test(p) && !skippedPaths.has(p))
    .sort()
    .map((p) => docInput(p, input.texts.get(p)!));
  const ctx: RuleContext = { engine, texts: input.texts, reader: repoReader(engine, input.texts) };

  const raw: RawFinding[] = [];
  const checked = new Set<string>();
  const ruled = new Set<string>();
  const proposed = new Set<string>();
  const ruleErrors: Report["ruleErrors"] = [];
  let unreadable = 0;
  let withoutRules = 0;
  let tablesRead = 0;

  for (const doc of docs) {
    tablesRead += doc.tables.length;
    for (const rule of rules) {
      try {
        const r = rule.run(doc, ctx);
        raw.push(...r.findings);
        for (const k of r.checked) checked.add(k);
        for (const k of r.ruled) ruled.add(k);
        for (const p of r.proposals) proposed.add(tableKey(doc.path, p.table));
        unreadable += r.unreadable;
        withoutRules += r.coverage;
      } catch (err) {
        ruleErrors.push({
          path: doc.path,
          rule: rule.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const findings = merge(raw, rules, input);
  const confirmedTables = new Map<string, Finding[]>();
  for (const f of findings) {
    const m = /^(.*#t\d+)\//.exec(f.id);
    if (f.confidence !== "confirmed" || !m) continue;
    confirmedTables.set(m[1]!, [...(confirmedTables.get(m[1]!) ?? []), f]);
  }

  const inferable = [...proposed].filter((k) => !ruled.has(k) && !confirmedTables.has(k)).length;
  const withArithmetic = new Set([...checked, ...proposed].filter((k) => !ruled.has(k))).size;
  const inferableAfterFix = afterFix(docs, confirmedTables, ruled, ctx, ruleErrors);

  const confirmed = findings.filter((f) => f.confidence === "confirmed").length;
  const leads = findings.length - confirmed;
  const verdict =
    confirmed > 0
      ? "confirmed"
      : leads > 0
        ? "leads"
        : checked.size > 0
          ? "clean"
          : "nothing-checkable";

  return {
    version: 1,
    engine: input.engineVersion,
    repo: { label: input.repo.label, host: input.repo.host, commit: input.repo.commit },
    clonePath: input.clonePath,
    files: {
      markdown: input.paths.filter((p) => MARKDOWN.test(p.path)).length,
      read: docs.length,
      skipped: input.skipped,
    },
    accuracy: { verdict, confirmed, leads, tablesRead, tablesChecked: checked.size, unreadable },
    adoption: { withoutRules, withArithmetic, inferable, inferableAfterFix },
    posture: computePosture(
      input.paths.map((p) => p.path),
      input.workflowTexts,
      input.repo.lastCommit,
    ),
    findings,
    ruleErrors,
  };
}

/** Findings on the same cell become one (spec §3.5). */
function merge(raw: RawFinding[], rules: readonly Rule[], input: InvestigateInput): Finding[] {
  const order = new Map(rules.map((r, i) => [r.id, i]));
  const byId = new Map<string, RawFinding[]>();
  for (const f of raw) {
    const id = cellKey(f.path, f.cell);
    byId.set(id, [...(byId.get(id) ?? []), f]);
  }
  const out: Finding[] = [];
  for (const [id, group] of byId) {
    group.sort((a, b) => order.get(a.rule)! - order.get(b.rule)!);
    const lead = group.find((f) => f.confidence === "confirmed") ?? group[0]!;
    const { rule: _rule, cell: _cell, fix, ...rest } = lead;
    const finding: Finding = {
      ...rest,
      id,
      permalink: blobUrl(
        input.repo.host,
        input.repo.label,
        input.repo.commit,
        lead.path,
        lead.lines[0],
        lead.lines[1],
      ),
      confidence: group.some((f) => f.confidence === "confirmed") ? "confirmed" : "lead",
      rules: [...new Set(group.map((f) => f.rule))],
    };
    if (fix) finding.fix = fix;
    out.push(finding);
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.lines[1] - b.lines[1]));
}

/**
 * Tables holding a confirmed finding that `infer` writes a rule for once the
 * file's confirmed fixes are applied — the exact finding wins over a proposal
 * that fits only by explaining the wrong row away (#409).
 */
function afterFix(
  docs: DocInput[],
  confirmedTables: Map<string, Finding[]>,
  ruled: Set<string>,
  ctx: RuleContext,
  ruleErrors: Report["ruleErrors"],
): number {
  let count = 0;
  for (const doc of docs) {
    const tables = [...confirmedTables.keys()].filter(
      (k) => k.startsWith(`${doc.path}#t`) && !ruled.has(k),
    );
    if (tables.length === 0) continue;
    const edits = tables.flatMap((k) => confirmedTables.get(k)!.flatMap((f) => f.fix ?? []));
    let fixed: string;
    try {
      fixed = applyEdits(doc.text, dedupe(edits));
    } catch {
      continue;
    }
    let proposals;
    try {
      proposals = engineInfer.run(docInput(doc.path, fixed), ctx).proposals;
    } catch (err) {
      // Recorded like any other rule failure: the rest of the report stands.
      ruleErrors.push({
        path: doc.path,
        rule: engineInfer.id,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const after = new Set(proposals.map((p) => tableKey(doc.path, p.table)));
    count += tables.filter((k) => after.has(k)).length;
  }
  return count;
}

function dedupe<T extends { from: number; to: number }>(edits: T[]): T[] {
  const seen = new Set<string>();
  return edits.filter((e) => {
    const k = `${e.from}:${e.to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
