/** Shared `Bun.spawnSync` wrapper for the `repo:scan`/`repo:pr` scripts —
 * every git/gh invocation across them wants the same exit/stdout/stderr
 * shape, trimmed of the trailing newline a CLI tool always leaves. */
export function run(cmd: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(cmd, { cwd });
  return {
    ok: proc.exitCode === 0,
    stdout: proc.stdout.toString("utf8").trim(),
    stderr: proc.stderr.toString("utf8").trim(),
  };
}

/**
 * `git ls-files`'s tracked-Markdown listing, done right: `-z` NUL-delimits
 * entries instead of quoting an unusual filename (any non-ASCII byte, by
 * default) and newline-joining the rest, which is what every earlier version
 * of this listing did (`run(["git","ls-files","*.md",...])` then
 * `.split("\n")`) — a repo with a non-ASCII filename would hand a quoted,
 * escaped string to `infer`/`check`/`fmt` as if it were a real path, which
 * doesn't exist, rather than the file this was supposed to name.
 *
 * Deliberately not built on `run()`: that trims the whole blob, which would
 * eat real leading/trailing whitespace off the first/last filename. NUL
 * splitting already isolates each entry, so nothing here needs trimming.
 */
export function listTrackedFiles(cwd: string, patterns: string[]): string[] {
  const proc = Bun.spawnSync(["git", "ls-files", "-z", ...patterns], { cwd });
  if (proc.exitCode !== 0) return [];
  return proc.stdout
    .toString("utf8")
    .split("\0")
    .filter((p) => p.length > 0);
}
