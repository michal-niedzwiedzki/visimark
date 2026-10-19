# A `visimark_simulate` tool in `visimark-mcp` — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work this plan task-by-task. Steps are checkboxes for tracking.

**Goal:** `visimark-mcp` serves a read-only `visimark_simulate` tool, per [`visimark-simulate-mcp-tool-spec.md`](visimark-simulate-mcp-tool-spec.md). The CLI, the playground and the tool share one output function.

**Architecture:** `simulateRun` in `packages/visimark/src/report/simulate-run.ts` returns the stdout and stderr lines for one document. `cmdSimulate` and `pgSimulate` call it. `visimark-mcp` gains `src/tools/simulate.ts` and a `--max-questions` server flag.

**Tech Stack:** TypeScript, Bun test runner. No new dependency.

## Global Constraints

- Branch `issue/330-visimark-simulate-tool`; one PR, draft until CI is green.
- Commit trailers resolve from [`.agents/rules/ai-attribution.md`](../../.agents/rules/ai-attribution.md) for the session doing the work.
- **No CLI or playground output change.** Capture `simulate` output on every `docs/example-*.md` that has a `report` before Task 1 and diff it after Task 1.
- Fewest exports ([`dependencies-and-pins.md`](../../.agents/rules/dependencies-and-pins.md)): `simulateRun` is the only new export of `visimark`; `api-surface.test.ts` shows it.
- The tool description carries no count.
- After each task run `bun test`, `bun run typecheck`, `bun run lint` from the repo root; `bun run build` after Tasks 1 and 3.

## Task 1: `simulateRun` in the engine

- [ ] Write `test/simulate-run.test.ts` first: on `test/fixtures/simulation/simulate.md`, `stdout` and `stderr` are the #259 spec case 1 lines; with `elapsed` the summary ends ` in T`, without it `N of S sheets ran`; a document with no report gives `noReport`; a blocked sheet gives `blocked: 1` and a `fault: true` line; `onPlan` can throw and no question runs.
- [ ] Add `src/report/simulate-run.ts` and export `simulateRun` (and its types) from `src/index.ts`; update `api-surface.test.ts`.
- [ ] Rewrite `pgSimulate` and `cmdSimulate` over it. `cmdSimulate` keeps streaming the plan line through `onPlanLine`.
- [ ] Existing `simulate` CLI, acceptance and playground tests pass unchanged; the captured example output diffs clean.
- [ ] Commit.

## Task 2: `--max-questions`

- [ ] Tests in `args.test.ts`: `--max-questions 5` parses; `0`, `-1`, `1.5`, `abc` and a missing value are usage errors; the help text lists it. `spawn.test.ts`: a bad value exits `2` with nothing on stdout.
- [ ] `args.ts`: `maxQuestions?: number`, parsed before the transport starts. `main.ts` and `ServerDeps` carry it to `createServer`.
- [ ] `errors.ts`: add `LIMIT` to `FaultCode`.
- [ ] Commit.

## Task 3: the tool

- [ ] Tests in `test/tools-simulate.test.ts` for spec §5 rows 1–14: battery example by `path` against the CLI's lines (run in-process through `simulateRun` with the CLI's `elapsed` and compare minus ` in T`); the twin of each #259 case 1–12 via `content`; the import case on `docs/example-invoice-csv-import.md` plus a report sheet; determinism; `LIMIT` and its inclusive boundary.
- [ ] `src/tools/simulate.ts`: `simulateTool(limits)` returns the `ToolDef`; resolves input with `resolveInput`, validates `failOnFault`, calls `simulateRun` with `onPlan` throwing a private `LimitError` that `run` turns into `fault("LIMIT", …)`; `skipped` from a `check` of the same input.
- [ ] `tools/read.ts`: `readTools({ maxQuestions })`, with `READ_TOOLS = readTools({})`; `server.ts` uses `readTools` with the deps.
- [ ] Update `tools-read.test.ts` ("the seven read tools"), `handshake.test.ts` (nine names), `spawn.test.ts` (9).
- [ ] Commit.

## Task 4: documentation and changelog

- [ ] The files in spec §7. Regenerate `skill.md` with `scripts/gen-mcp-skill.ts` after editing `skills/visimark/SKILL.md`.
- [ ] Run `scripts/check-links.ts`, `bun run lint`, and the full checks. `CHANGELOG.md` `## Unreleased`.
- [ ] Commit.

## Task 5: verify and open the PR

- [ ] `bun test`, `typecheck`, `lint`, `build`, `scripts/check-dist-imports.ts`.
- [ ] Spawn the built server, call `visimark_simulate` over stdio on the battery example, compare with the CLI.
- [ ] Push; open a draft PR referencing #330.
