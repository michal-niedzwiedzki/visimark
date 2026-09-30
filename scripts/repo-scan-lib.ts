/**
 * The pure half of `repo-scan.ts`: no filesystem, network, or subprocess
 * access, so it is unit-tested directly. Parses the repo argument, detects
 * whether a clone already runs the VisiMark action, and renders the
 * human-readable summary from the `check`/`infer` JSON envelopes those
 * commands already produce (see `packages/visimark/src/cli/commands.ts`).
 */

const SHORTHAND = /^[\w.-]+\/[\w.-]+$/;

export interface RepoRef {
  /** URL passed to `git clone`. */
  cloneUrl: string;
  /** `owner/repo`, for display and the report. */
  label: string;
}

/**
 * Accepts `owner/repo`, or an `https://`/`git@` URL (with or without a
 * `.git` suffix). Anything else is a usage error, not a network one — this
 * never touches the network.
 */
export function parseRepoArg(input: string): RepoRef | { error: string } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { error: "repo argument is empty" };

  if (SHORTHAND.test(trimmed)) {
    return { cloneUrl: `https://github.com/${trimmed}.git`, label: trimmed };
  }

  const httpsMatch = trimmed.match(/^https:\/\/[^/]+\/([\w.-]+\/[\w.-]+?)(\.git)?\/?$/);
  if (httpsMatch) {
    return { cloneUrl: trimmed, label: httpsMatch[1]! };
  }

  const sshMatch = trimmed.match(/^git@[^:]+:([\w.-]+\/[\w.-]+?)(\.git)?\/?$/);
  if (sshMatch) {
    return { cloneUrl: trimmed, label: sshMatch[1]! };
  }

  return { error: `not a recognized repo (want \`owner/repo\` or a git URL): ${input}` };
}

/**
 * Drops any path with a dot-directory or dot-file component — `.github/`,
 * `.agents/`, `.changeset/`, a bare `.env.md`, and so on. `git ls-files
 * '*.md'` matches those too (this very repo's own tracked Markdown under
 * `.agents/` is proof: a glob with no `/` matches at any depth), but they're
 * tooling/config, not
 * the authored documents `repo:scan`/`repo:pr` exist to find arithmetic in —
 * scanning them just adds noise (agent skill files, issue templates) to the
 * report. A leading-dot check on each path segment, not just the first,
 * catches `docs/.internal/notes.md` the same as `.github/foo.md`.
 */
export function excludeDotPaths(paths: string[]): string[] {
  return paths.filter((p) => !p.split("/").some((segment) => segment.startsWith(".")));
}

/**
 * A `uses:` line naming the visimark action, e.g. `owner/visimark@v1` or
 * `owner/visimark/action.yml@v1` — matches action.yml's own publish shape,
 * case-insensitively since Actions refs are matched case-insensitively too.
 */
const VISIMARK_ACTION_USE = /^\s*-?\s*uses:\s*[\w.-]+\/visimark(@|\/|\s|$)/im;

export function hasVisimarkAction(workflowTexts: string[]): boolean {
  return workflowTexts.some((text) => VISIMARK_ACTION_USE.test(text));
}

export interface JsonSummaryLike {
  files: number;
  [key: string]: number;
}

interface FindingLike {
  location?: { file?: string; [key: string]: unknown };
  [key: string]: unknown;
}
interface DisagreementLike {
  rowLabel: string;
  stored: string;
  computed: string;
}
interface ProposalLike {
  kind: string;
  sheet: string;
  name: string;
  rule: string;
  disagreement?: DisagreementLike;
  [key: string]: unknown;
}
interface FileEntryLike {
  path: string;
  findings?: FindingLike[];
  proposals?: ProposalLike[];
  [key: string]: unknown;
}
interface JsonSectionLike {
  summary: JsonSummaryLike;
  files: FileEntryLike[];
  [key: string]: unknown;
}

/**
 * `infer`'s "near-miss" proposal, unpacked: a rule that fits every row of a
 * column but one — the fit is close enough that the one holdout is almost
 * certainly the same arithmetic, computed wrong (or entered wrong), not an
 * unrelated number. `infer --write` never writes these down (see
 * `infer/write.ts`'s `planMarker`), so they never turn into a `check`
 * finding either — this is the only place they surface.
 *
 * A near-miss is a heuristic, not a proof: on a table with only a handful of
 * rows, a "rule" can fit most of them by coincidence rather than because a
 * real formula relationship exists. Treat each one as a lead to look at, not
 * a confirmed bug.
 */
export interface Disagreement {
  path: string;
  sheet: string;
  name: string;
  rule: string;
  rowLabel: string;
  stored: string;
  computed: string;
}

export function extractDisagreements(section: JsonSectionLike | undefined): Disagreement[] {
  if (!section) return [];
  const out: Disagreement[] = [];
  for (const entry of section.files) {
    for (const p of entry.proposals ?? []) {
      if (p.kind === "near-miss" && p.disagreement) {
        out.push({
          path: entry.path,
          sheet: p.sheet,
          name: p.name,
          rule: p.rule,
          rowLabel: p.disagreement.rowLabel,
          stored: p.disagreement.stored,
          computed: p.disagreement.computed,
        });
      }
    }
  }
  return out;
}

export interface ScanReport {
  command: "repo-scan";
  repo: string;
  cloneUrl: string;
  ref: string | null;
  skipped: boolean;
  skipReason?: string;
  markdownFiles: number;
  check?: JsonSectionLike;
  infer?: JsonSectionLike;
  disagreements?: Disagreement[];
}

/**
 * `cmdCheck`/`cmdInfer` were run against files in a temp clone, so every path
 * they reported — the file entry's own `path` and, for `check`, each
 * finding's `location.file` (`publicFinding` sets it to the same absolute
 * path) — starts with `workdir`. Strips that prefix in place so the report
 * reads as paths in the scanned repo, not paths on this machine that stop
 * existing when the clone is cleaned up.
 */
export function relativizePaths(section: JsonSectionLike | undefined, workdir: string): void {
  if (!section) return;
  const prefix = workdir.endsWith("/") ? workdir : `${workdir}/`;
  for (const entry of section.files) {
    if (entry.path.startsWith(prefix)) entry.path = entry.path.slice(prefix.length);
    for (const finding of entry.findings ?? []) {
      const file = finding.location?.file;
      if (typeof file === "string" && file.startsWith(prefix)) {
        finding.location!.file = file.slice(prefix.length);
      }
    }
  }
}

/**
 * Wraps a category of text in an ANSI color, or not — `noColor` is the
 * default for every formatter below, so calling them without a palette (as
 * every existing test does) renders identical plain text. `repo-scan.ts`
 * builds the real one, gated on TTY/`NO_COLOR`, since color codes are a
 * terminal concern, not something the pure formatters decide.
 */
export interface Palette {
  finding: (s: string) => string;
  proposal: (s: string) => string;
  disagreement: (s: string) => string;
}

export const noColor: Palette = {
  finding: (s) => s,
  proposal: (s) => s,
  disagreement: (s) => s,
};

/** A finding's own fields don't share one "what happened" field across
 * codes — `details.message` covers most, `STALE` and a few others carry
 * their story in dedicated fields instead. This is the one place that reads
 * either, for `--explain`. */
function describeFinding(f: FindingLike): string {
  const details = (f.details ?? {}) as Record<string, unknown>;
  if (typeof details.message === "string") return details.message;
  if (f.code === "STALE") {
    if (details.stored !== undefined && details.computed !== undefined) {
      return `stored ${details.stored}, computed ${details.computed}`;
    }
    if (details.artifact !== undefined) return `stale artifact ${details.artifact}`;
    if (details.suppressedCount !== undefined) {
      return `${details.suppressedCount} suppressed under its anchor group`;
    }
  }
  if (f.code === "DATE" && details.raw !== undefined) return `ambiguous date ${details.raw}`;
  if (f.code === "ASSERT" && details.substituted !== undefined) return String(details.substituted);
  return JSON.stringify(details);
}

function proposalLine(p: ProposalLike): string {
  if (p.kind === "near-miss" && p.disagreement) {
    const d = p.disagreement;
    return `[near-miss] ${p.sheet}.${p.name} row ${d.rowLabel}: stored ${d.stored}, rule (${p.rule}) computes ${d.computed}`;
  }
  return `[${p.kind}] ${p.sheet}.${p.name} — ${p.rule}`;
}

export function formatSummary(report: ScanReport): string[] {
  const lines = [`repo-scan: ${report.repo} (${report.cloneUrl})`];
  if (report.ref) lines.push(`  ref: ${report.ref}`);

  if (report.skipped) {
    lines.push(`  skipped: ${report.skipReason}`);
    return lines;
  }

  lines.push(`  markdown files: ${report.markdownFiles}`);

  const check = report.check?.summary;
  if (check) {
    lines.push(
      `  check: ${check.problems} problem(s), ${check.stale} stale, ${check.errors} error(s) across ${check.files} file(s)`,
    );
  }

  const infer = report.infer?.summary;
  if (infer) {
    lines.push(
      `  infer: ${infer.rules} rule(s), ${infer.scalars} scalar(s), ${infer.anchors} anchor(s) across ${infer.files} file(s)`,
    );
  }

  if (report.disagreements) {
    const n = report.disagreements.length;
    lines.push(
      n > 0
        ? `  disagreements: ${n} (a close-fit rule that one row doesn't match — values worth checking; see the file list below, or --explain for row-by-row detail; small tables can fit a rule by coincidence)`
        : "  disagreements: 0",
    );
  }

  return lines;
}

/**
 * One line per disagreement: which file, which column, which row, and the
 * stored-vs-computed mismatch that makes it worth a look. See
 * `extractDisagreements` for what this is and its false-positive caveat.
 */
export function formatDisagreements(report: ScanReport, palette: Palette = noColor): string[] {
  if (!report.disagreements || report.disagreements.length === 0) return [];
  const lines = ["  disagreements:"];
  for (const d of report.disagreements) {
    const line = `${d.path}  ${d.sheet}.${d.name}  row ${d.rowLabel}: stored ${d.stored}, rule (${d.rule}) computes ${d.computed}`;
    lines.push(`    ${palette.disagreement(line)}`);
  }
  return lines;
}

export function filesWithHits(report: ScanReport): string[] {
  const paths = new Set<string>();
  for (const entry of report.check?.files ?? []) {
    if ((entry.findings?.length ?? 0) > 0) paths.add(entry.path);
  }
  for (const entry of report.infer?.files ?? []) {
    if ((entry.proposals?.length ?? 0) > 0) paths.add(entry.path);
  }
  return [...paths].sort();
}

/**
 * Whether a scan turned up anything a follow-up `repo:pr` run would act on —
 * a `check` finding or an `infer` proposal in at least one file. A skipped
 * scan (already runs the action) or a repo with no Markdown at all has
 * nothing to act on either. Used to decide whether `repo-scan --keep` is
 * worth keeping the clone for.
 */
export function hasUsefulFindings(report: ScanReport): boolean {
  if (report.skipped) return false;
  return filesWithHits(report).length > 0;
}

/**
 * One line per file that has a `check` finding or an `infer` proposal —
 * clean files are left out so this stays readable on a large repo. This is
 * the default text-mode view; `--explain` replaces it with `formatExplain`.
 */
export function formatFiles(report: ScanReport, palette: Palette = noColor): string[] {
  if (report.skipped) return [];
  const paths = filesWithHits(report);
  if (paths.length === 0) return [];

  const checkByPath = new Map((report.check?.files ?? []).map((f) => [f.path, f]));
  const inferByPath = new Map((report.infer?.files ?? []).map((f) => [f.path, f]));

  const lines = ["  files:"];
  for (const path of paths) {
    const findings = checkByPath.get(path)?.findings?.length ?? 0;
    const proposals = inferByPath.get(path)?.proposals?.length ?? 0;
    const bits = [
      findings > 0 ? palette.finding(`${findings} finding(s)`) : "",
      proposals > 0 ? palette.proposal(`${proposals} proposal(s)`) : "",
    ].filter(Boolean);
    lines.push(`    ${path}: ${bits.join(", ")}`);
  }
  return lines;
}

/**
 * `--explain`: under each file, every finding and every proposal spelled
 * out — not just their counts. Findings in `palette.finding`, ordinary
 * proposals in `palette.proposal`, and a near-miss proposal (a disagreement)
 * in `palette.disagreement`, since it reads as a lead worth chasing rather
 * than a stylistic suggestion.
 */
export function formatExplain(report: ScanReport, palette: Palette = noColor): string[] {
  if (report.skipped) return [];
  const paths = filesWithHits(report);
  if (paths.length === 0) return [];

  const checkByPath = new Map((report.check?.files ?? []).map((f) => [f.path, f]));
  const inferByPath = new Map((report.infer?.files ?? []).map((f) => [f.path, f]));

  const lines = ["  files:"];
  for (const path of paths) {
    lines.push(`    ${path}`);
    for (const f of checkByPath.get(path)?.findings ?? []) {
      lines.push(`      ${palette.finding(`[${f.code}] ${describeFinding(f)}`)}`);
    }
    for (const p of inferByPath.get(path)?.proposals ?? []) {
      const line = proposalLine(p);
      lines.push(
        `      ${p.kind === "near-miss" ? palette.disagreement(line) : palette.proposal(line)}`,
      );
    }
  }
  return lines;
}
