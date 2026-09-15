import { constants, openSync } from "node:fs";

/**
 * The fd-acquiring half of the path gate.
 *
 * `fs/gate.ts` answers "is this path legal?". Its answer is true of a *name*,
 * at the instant it was asked - and VisiMark then carries that answer a long
 * way. A chart's verdict is settled inside `eval/check-charts.ts` and acted on
 * in `cli/commands.ts`, after every other chart, every splice, and every
 * earlier file of a multi-file `fmt` run. A name checked that long ago is not
 * evidence about the object finally opened.
 *
 * So the use is made to carry its own proof: open first, refuse if the
 * descriptor is not what the verdict described, and read and write **through
 * that descriptor** rather than resolving the path a second time.
 *
 * `O_EXCL` (the `x` in `wx`) refuses a symlink outright - including a dangling
 * one, which is the case a plain existence test misses. Do not "simplify" it
 * to `w`. `O_NOFOLLOW` is the same refusal for the open-existing case.
 *
 * **What this does not close.** `O_NOFOLLOW` guards the final path component
 * only: an attacker able to replace an intermediate *directory* with a symlink
 * still redirects the open, and closing that needs `openat` per component,
 * which Node does not expose. A hardlink is not a symlink and passes both
 * flags; the caller's marker re-check is what catches it. Both are accepted
 * under the local-CLI threat model in `SECURITY.md`, which names what would
 * change that.
 */

/** `undefined` on Windows, which has no symlink without elevation. */
const NOFOLLOW = constants.O_NOFOLLOW ?? 0;

export type OpenResult = { ok: number } | { err: string };

/**
 * Open `target` for writing without following a symlink at the final
 * component. `expectExisting` follows the gate's verdict: `false` means
 * `classify()` said `missing`, so anything at all being there now is a
 * change and `O_EXCL` refuses it; `true` means an existing artifact is to be
 * overwritten in place, which the caller must still prove it owns.
 */
export function openForWrite(target: string, expectExisting: boolean): OpenResult {
  const flags = expectExisting
    ? constants.O_RDWR | NOFOLLOW
    : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL;
  return attempt(target, flags);
}

/** The read-side counterpart: the declared-input gate's `.csv`. */
export function openForRead(target: string): OpenResult {
  return attempt(target, constants.O_RDONLY | NOFOLLOW);
}

function attempt(target: string, flags: number): OpenResult {
  try {
    return { ok: openSync(target, flags) };
  } catch (e) {
    return { err: message(target, e) };
  }
}

/**
 * A swap and a permissions problem are both refusals, but only one of them is
 * an attack. Keeping their wording apart means an ordinary read-only file does
 * not read as an intrusion, and an intrusion does not read as chmod.
 */
function message(target: string, e: unknown): string {
  const code = (e as NodeJS.ErrnoException | undefined)?.code;
  switch (code) {
    case "EEXIST":
    case "ELOOP":
      return "`" + target + "` changed between the check and the write";
    case "EISDIR":
      return "`" + target + "` is a directory";
    case "ENOENT":
      return "`" + target + "` disappeared between the check and the write";
    case "EACCES":
    case "EPERM":
      return "`" + target + "` cannot be opened (permission denied)";
    default:
      return "`" + target + "` cannot be opened" + (code ? " (" + code + ")" : "");
  }
}
