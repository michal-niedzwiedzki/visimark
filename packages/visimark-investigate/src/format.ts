import { cellLabel } from "./ids.js";
import { RULES } from "./rules/registry.js";
import type { Finding, Report } from "./types.js";

/**
 * The only wording of a result. The CLI prints these lines and the widget
 * escapes and renders them, so the two cannot describe the same finding
 * differently (spec §3.2, §4.5).
 */

const yn = (b: boolean | null): string => (b ? "yes" : "no");

export function summaryLines(r: Report): string[] {
  const a = r.accuracy;
  const d = r.adoption;
  const p = r.posture;
  return [
    `accuracy: ${a.confirmed} confirmed, ${a.leads} leads  (${a.tablesRead} tables read, ${a.tablesChecked} checked, ${a.unreadable} unreadable)`,
    `adoption: ${d.withArithmetic} tables with arithmetic and no rules, ${d.inferable} inferable, ${d.inferableAfterFix} inferable after fix`,
    p.available
      ? `posture:  CONTRIBUTING ${yn(p.contributing)}  PR template ${yn(p.prTemplate)}  LICENSE ${yn(p.license)}  action ${yn(p.actionUsed)}  last commit ${p.lastCommit ?? "unknown"}`
      : "posture:  unavailable",
  ];
}

const labelOf = new Map(RULES.map((r) => [r.id, r.label]));
const foundBy = (f: Finding): string => f.rules.map((id) => labelOf.get(id) ?? id).join(", ");

export function findingLines(f: Finding, style: "cli" | "web"): string[] {
  const where = `${f.path}:${f.lines[1]}`;
  if (style === "web") {
    const word = f.confidence === "confirmed" ? "Wrong number" : "Worth a look";
    return [`${word} · ${where} · ${cellLabel(f.id)}`, f.message, `found by: ${foundBy(f)}`];
  }
  const tag = f.confidence === "confirmed" ? "CONFIRMED" : "lead";
  return [
    `${tag.padEnd(9)}  ${where}  ${cellLabel(f.id)}  · found by: ${foundBy(f)}`,
    ...(f.permalink ? [`  ${f.permalink}`] : []),
    ...f.evidence,
    `  ${f.message}`,
  ];
}
