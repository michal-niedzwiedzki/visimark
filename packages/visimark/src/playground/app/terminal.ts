/** The TERMINAL panel: a scrolling transcript of the commands the playground
 *  runs, capped so a long session cannot grow the DOM without bound. */

import { byId } from "./dom.js";

/**
 * How many *lines* of transcript are kept.
 *
 * Both halves of that sentence were untrue before the follow-up review's §2.9.
 * The cap counted child *nodes* while calling them lines — a `VM.formatCheck`
 * block is one node and forty lines, so the real ceiling was somewhere between
 * 400 and unbounded depending on what had been logged. And it was enforced by
 * a `trim()` on the interface that all 23 call sites had to remember to call;
 * `main.ts`'s boot-failure loop did not.
 *
 * So the count is now newlines rather than nodes, and the trim happens inside
 * `line()`. The cap holds by construction, no caller can breach it by
 * forgetting something, and `trim` is gone from the interface rather than
 * sitting on it as an obligation.
 */
const TERM_MAX_LINES = 400;

export interface Terminal {
  /** Appends one entry, optionally classed (`cmd`, `err`). The entry may be
   *  several lines; the cap counts all of them. */
  line(text: string, cls?: string): void;
  /** Appends a `$ …` command echo. */
  cmd(text: string): void;
  clear(): void;
}

export function createTerminal(): Terminal {
  const el = byId("terminal-body");
  /** How many lines each appended node contributed, oldest first. A parallel
   *  record is needed because `el.childNodes.length` cannot answer it: one
   *  node can carry one line or forty. */
  const perNode: number[] = [];
  let lines = 0;

  function trim(): void {
    // Never empty the panel completely: one entry longer than the whole cap
    // is still the thing the visitor is meant to read.
    while (lines > TERM_MAX_LINES && perNode.length > 1) {
      el.removeChild(el.firstChild!);
      lines -= perNode.shift()!;
    }
  }

  return {
    line(text, cls) {
      const span = document.createElement("span");
      if (cls) span.className = cls;
      span.textContent = `${text}\n`;
      el.appendChild(span);
      perNode.push(text.split("\n").length);
      lines += perNode[perNode.length - 1]!;
      trim();
      const body = el.parentElement;
      if (body) body.scrollTop = body.scrollHeight;
    },
    cmd(text) {
      this.line(`$ ${text}`, "cmd");
    },
    clear() {
      el.textContent = "";
      perNode.length = 0;
      lines = 0;
    },
  };
}
