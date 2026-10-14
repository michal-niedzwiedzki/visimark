import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { noteFindings } from "../src/note-findings.js";
import { sweepNotebook } from "../src/notebook-sweep.js";

const docs = resolve(import.meta.dir, "../../../docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");
const clean = readFileSync(join(docs, "example-invoice.md"), "utf8");

interface FakeNote {
  id: string;
  title: string;
  parent_id: string;
  body: string;
}

/** A `joplin.data` over three folders: root, a child of root, and one unrelated. */
function fakeData(notes: FakeNote[], pageSize = 2) {
  const folders = [
    { id: "root", parent_id: "", title: "Root" },
    { id: "child", parent_id: "root", title: "Child" },
    { id: "other", parent_id: "", title: "Other" },
  ];
  const calls: string[] = [];
  const page = <T>(items: T[], n = 1) => ({
    items: items.slice((n - 1) * pageSize, n * pageSize),
    has_more: n * pageSize < items.length,
  });
  return {
    calls,
    data: {
      get: async (path: string[], query: { page?: number; fields?: string[] }) => {
        calls.push(path.join("/"));
        if (path.length === 1 && path[0] === "folders") return page(folders, query.page);
        if (path[0] === "folders" && path[2] === "notes") {
          return page(
            notes.filter((n) => n.parent_id === path[1]).map((n) => ({ id: n.id, title: n.title })),
            query.page,
          );
        }
        if (path[0] === "notes") {
          const note = notes.find((n) => n.id === path[1]);
          if (!note) throw new Error("no such note");
          return { body: note.body };
        }
        throw new Error(`unexpected ${path.join("/")}`);
      },
      put: async () => {
        throw new Error("the sweep must never write");
      },
    },
  };
}

const notes: FakeNote[] = [
  { id: "a", title: "Drift in root", parent_id: "root", body: drift },
  { id: "b", title: "Clean in root", parent_id: "root", body: clean },
  { id: "c", title: "Plain in root", parent_id: "root", body: "# Shopping\n\n- milk\n" },
  { id: "d", title: "Drift in child", parent_id: "child", body: drift },
  { id: "e", title: "Drift elsewhere", parent_id: "other", body: drift },
];

test("J11: the sweep visits the notebook and its sub-notebooks only, and lists the disagreeing notes", async () => {
  const { data, calls } = fakeData(notes);
  const result = await sweepNotebook(data, "root");
  expect(result.notes.map((n) => [n.path, n.detail.title])).toEqual([
    ["a", "Drift in root"],
    ["d", "Drift in child"],
  ]);
  expect(result.notes[0]!.problems).toBe(noteFindingsProblems(drift));
  expect(result.scanned).toBe(4);
  expect(calls.some((c) => c.includes("other"))).toBe(false);
  expect(calls).not.toContain("notes/e");
});

test("J12: a signal set after the first chunk cancels, with what was found so far", async () => {
  const { data } = fakeData(notes);
  const signal = { aborted: false };
  const result = await sweepNotebook(data, "root", {
    chunk: 1,
    signal,
    onProgress: () => void (signal.aborted = true),
  });
  expect(result.cancelled).toBe(true);
  expect(result.scanned).toBeLessThan(4);
  expect(result.notes.map((n) => n.path)).toEqual(["a"]);
});

test("a note whose body cannot be read is unreadable, never clean", async () => {
  const { data } = fakeData(notes);
  const broken = {
    ...data,
    get: async (path: string[], query: { page?: number }) => {
      if (path[0] === "notes" && path[1] === "a") throw new Error("gone");
      return data.get(path, query);
    },
  };
  const result = await sweepNotebook(broken, "root");
  expect(result.unreadable).toEqual(["a"]);
});

test("a note that imports counts as partly checked", async () => {
  const importing = [
    "```vmark #order from order.csv labelled Item, Total",
    "x = 1",
    "```",
    "",
    "| Item | Qty | Net |",
    "|------|----:|----:|",
    "| pen  |  2  | 11.00 |",
    "",
    "```vmark #lines",
    "Net precision 2 = Qty * 5",
    "```",
    "",
  ].join("\n");
  const { data } = fakeData([{ id: "i", title: "Imports", parent_id: "root", body: importing }]);
  const result = await sweepNotebook(data, "root");
  expect(result.notes.map((n) => [n.path, n.detail.importsDropped])).toEqual([["i", true]]);
});

function noteFindingsProblems(body: string): number {
  const f = noteFindings(body);
  if (f.kind !== "findings") throw new Error(f.kind);
  return f.problems;
}
