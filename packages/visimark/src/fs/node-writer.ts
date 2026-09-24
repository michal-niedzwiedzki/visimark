import { writeFileSync } from "node:fs";
import type { WriteErr, WriteOk, WriterPort } from "./writer.js";

/**
 * The `node:fs` implementation of the writer port — what `cmdFmt` and
 * `cmdInfer` now call instead of a bare `writeFileSync`. Behaviour is
 * unchanged: this moves the call, not what it does. See `fs/writer.ts` for
 * why the port itself stays this small.
 *
 * **Nothing in the browser's module graph may import this file** — same rule
 * as `fs/node-reader.ts`, checked the same way in
 * `test/playground/browser-graph.test.ts`.
 */
export const nodeWriter: WriterPort = {
  writeText(path: string, content: string): WriteOk | WriteErr {
    try {
      writeFileSync(path, content);
      return { ok: true };
    } catch (e) {
      return { err: e instanceof Error ? e.message : String(e) };
    }
  },
};
