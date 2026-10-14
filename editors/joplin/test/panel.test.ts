import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MESSAGES } from "../src/messages.js";
import { noteFindings } from "../src/note-findings.js";
import { panelHtml } from "../src/panel.js";

const docs = resolve(import.meta.dir, "../../../docs");
const drift = readFileSync(join(docs, "example-invoice-drift.md"), "utf8");

test("This note: a header, then a row per finding that reveals its span", () => {
  const note = noteFindings(drift);
  const html = panelHtml({ note, sweep: { kind: "idle" } });
  if (note.kind !== "findings") throw new Error(note.kind);
  expect(html).toContain(`${note.problems} problems`);
  expect(html).toContain('data-action="reveal"');
  expect(html).toContain("STALE lines.Net · On-call support");
});

test("This note: N1, C1 and I1", () => {
  expect(panelHtml({ note: { kind: "no-block" }, sweep: { kind: "idle" } })).toContain(MESSAGES.N1);
  const clean = panelHtml({
    note: { kind: "findings", rows: [], problems: 0, importsDropped: true },
    sweep: { kind: "idle" },
  });
  expect(clean).toContain(MESSAGES.C1);
  expect(clean).toContain(MESSAGES.I1);
});

test("Sweep: empty until run, progress with Cancel, then the list and the counts", () => {
  expect(panelHtml({ note: { kind: "no-block" }, sweep: { kind: "idle" } })).not.toContain(
    "Checked",
  );
  const running = panelHtml({
    note: { kind: "no-block" },
    sweep: { kind: "running", done: 3, total: 10 },
  });
  expect(running).toContain("Checked 3 of 10 notes");
  expect(running).toContain('data-action="cancel"');
  const done = panelHtml({
    note: { kind: "no-block" },
    sweep: {
      kind: "done",
      cancelled: true,
      notes: [{ id: "n<1>", title: "Q3 <invoice>", problems: 4 }],
      adviceOnly: 2,
      unreadable: 1,
      importsDropped: 3,
    },
  });
  expect(done).toContain("Cancelled");
  expect(done).toContain("Q3 &lt;invoice&gt;");
  expect(done).toContain('data-action="open"');
  expect(done).toContain('data-id="n&lt;1&gt;"');
  expect(done).toContain("4 problems");
  expect(done).toMatch(/2 notes? .*advice/);
  expect(done).toMatch(/1 note .*could not be read/);
  expect(done).toMatch(/3 notes .*another file/);
});
