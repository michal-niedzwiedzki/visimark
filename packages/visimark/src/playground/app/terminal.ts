/** The TERMINAL panel: a scrolling transcript of the commands the playground
 *  runs, capped so a long session cannot grow the DOM without bound. */

import { byId } from "./dom.js";

const TERM_MAX_LINES = 400;

export interface Terminal {
  /** Appends one line, optionally classed (`cmd`, `err`). */
  line(text: string, cls?: string): void;
  /** Appends a `$ …` command echo. */
  cmd(text: string): void;
  clear(): void;
  /** Drops the oldest lines back down to the cap. */
  trim(): void;
}

export function createTerminal(): Terminal {
  const el = byId("terminal-body");
  return {
    line(text, cls) {
      const span = document.createElement("span");
      if (cls) span.className = cls;
      span.textContent = `${text}\n`;
      el.appendChild(span);
      const body = el.parentElement;
      if (body) body.scrollTop = body.scrollHeight;
    },
    cmd(text) {
      this.line(`$ ${text}`, "cmd");
    },
    clear() {
      el.textContent = "";
    },
    trim() {
      while (el.childNodes.length > TERM_MAX_LINES) el.removeChild(el.firstChild!);
    },
  };
}
