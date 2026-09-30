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
