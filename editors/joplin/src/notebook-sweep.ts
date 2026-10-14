import { sweep, type SweepOptions, type SweepResult } from "visimark-editor-shared/sweep.js";
import { noteFindings } from "./note-findings.js";

/**
 * The notebook sweep (#384 spec §2.5): a notebook and every notebook under
 * it, one note at a time through `joplin.data`, each checked on its own with
 * no reader. It reads and never writes.
 */

/** the part of `joplin.data` the sweep calls */
export interface DataApi {
  get(path: string[], query?: object): Promise<unknown>;
}

interface Page<T> {
  items: T[];
  has_more: boolean;
}

export interface SweptDetail {
  readonly title: string;
  readonly importsDropped: boolean;
}

export type NotebookSweep = SweepResult<SweptDetail> & {
  /** notes left partly unchecked because they read a file Joplin cannot open */
  readonly importsDropped: number;
};

export async function sweepNotebook(
  data: DataApi,
  rootId: string,
  options: SweepOptions = {},
): Promise<NotebookSweep> {
  const titles = new Map<string, string>();
  const partly = new Set<string>();

  const source = {
    paths: async (): Promise<string[]> => {
      const folders = await all<{ id: string; parent_id: string }>(
        data,
        ["folders"],
        ["id", "parent_id", "title"],
      );
      const ids: string[] = [];
      for (const folder of descendants(folders, rootId)) {
        const notes = await all<{ id: string; title: string }>(
          data,
          ["folders", folder, "notes"],
          ["id", "title"],
        );
        for (const n of notes) {
          titles.set(n.id, n.title);
          ids.push(n.id);
        }
      }
      return ids;
    },
    read: async (id: string): Promise<string | null> => {
      try {
        const note = (await data.get(["notes", id], { fields: ["body"] })) as { body?: unknown };
        return typeof note?.body === "string" ? note.body : null;
      } catch {
        return null;
      }
    },
  };

  const result = await sweep<SweptDetail>(
    source,
    async (text, id) => {
      const found = noteFindings(text);
      if (found.kind !== "findings") throw new Error("could not be checked");
      if (found.importsDropped) partly.add(id);
      return {
        problems: found.problems,
        advice: found.advice ?? 0,
        detail: { title: titles.get(id) ?? id, importsDropped: found.importsDropped },
      };
    },
    options,
  );
  return { ...result, importsDropped: partly.size };
}

/** Every page of a `joplin.data` listing. */
async function all<T>(data: DataApi, path: string[], fields: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const got = (await data.get(path, { fields, page })) as Page<T>;
    out.push(...got.items);
    if (!got.has_more) return out;
  }
}

/** The root and every folder under it, root first. */
function descendants(folders: { id: string; parent_id: string }[], rootId: string): string[] {
  const out = [rootId];
  for (let i = 0; i < out.length; i++) {
    // `includes` guards a parent cycle in synced data from looping forever
    for (const f of folders) if (f.parent_id === out[i] && !out.includes(f.id)) out.push(f.id);
  }
  return out;
}
