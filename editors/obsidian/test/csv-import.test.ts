import { expect, test } from "bun:test";
import { applyEdits, check } from "visimark";
import { readNote, type VaultRead } from "../src/snapshot.js";
import { reportFor } from "../src/report.js";

/**
 * v1.1 row 16 — proof, not new code.
 *
 * `docs/WIP/OBSIDIAN-FEATURES.md` records row 16 as "blocked on the same
 * write port as row 14 for stamp insertion". That premise does not hold: an
 * import's `at="sha256:…"` stamp is a plain edit to the *document's own
 * bytes* (`write/fmt.ts`'s `planFmt`, the `IMPORT`/"unstamped import" case),
 * never a write to the CSV file itself — `visimark-design.md` line ~1160
 * already says so ("The CSV file itself is never written"). Format already
 * applies every entry in `report.allRepairs` through one `editor.transaction`
 * unconditionally, with no dependence on the write port `#247`/`#252` added
 * for charts. So the write half of this row does not need building; what was
 * actually missing was a check that the *read* half — resolving a `from
 * <path>` declaration against the vault, through `snapshot.ts`'s fixed-point
 * loop, for a path relative to the *importing note's own folder* the way the
 * engine's `gatePath` requires (not the vault root) — reaches all the way
 * through to a stamp `format()` can actually apply. This file is that check.
 *
 * See #254 for the full writeup and the corrected non-goal in
 * `obsidian-plugin-spec.md` §8.
 */

function vaultOf(entries: Record<string, string>): { read: VaultRead } {
  const files = new Map(Object.entries(entries));
  return { read: (p) => Promise.resolve(files.get(p) ?? null) };
}

test("an unstamped CSV import, relative to the note's own folder, gets a repair that removes the finding", async () => {
  const { read } = vaultOf({
    "Finance/data/rates.csv": "Id,Rate\n1,12.3\n2,10.1\n",
    "Finance/2026 Budget.md": "```vmark #rates from data/rates.csv\nMean = AVG(rates.Rate)\n```\n",
  });
  const notePath = "Finance/2026 Budget.md";
  const source = "```vmark #rates from data/rates.csv\nMean = AVG(rates.Rate)\n```\n";

  const { model, snapshot } = await readNote(source, notePath, read);
  const doc = { path: snapshot.path, reader: snapshot.reader };
  const result = check(model, { doc });

  const unstamped = result.findings.find((f) => f.code === "IMPORT");
  expect(unstamped?.message).toContain("unstamped");

  const report = reportFor(model, result, doc);
  // exactly what `format()` (main.ts) applies through editor.transaction,
  // unconditionally — no setting gates this the way writeChartArtifacts
  // gates row 14, because nothing here writes anything but the note itself
  expect(report.allRepairs).toHaveLength(1);
  expect(report.allRepairs[0]!.text).toMatch(/^ at sha256:[0-9a-f]{64}$/);

  const repaired = applyEdits(model.source, report.allRepairs);
  const { model: model2, snapshot: snapshot2 } = await readNote(repaired, notePath, read);
  const doc2 = { path: snapshot2.path, reader: snapshot2.reader };
  const after = check(model2, { doc: doc2 });

  expect(after.findings.map((f) => f.code)).not.toContain("IMPORT");
  // idempotent: re-deriving the report against the repaired note finds
  // nothing left to stamp
  expect(reportFor(model2, after, doc2).allRepairs).toEqual([]);
});

test("a stale stamp (the CSV changed) is also repaired by the same unconditional path", async () => {
  const zeroStamp = "0".repeat(64);
  const { read } = vaultOf({
    "rates.csv": "Id,Rate\n1,12.3\n2,10.1\n",
    "budget.md": `\`\`\`vmark #rates from rates.csv at sha256:${zeroStamp}\nMean = AVG(rates.Rate)\n\`\`\`\n`,
  });
  const notePath = "budget.md";
  const source = `\`\`\`vmark #rates from rates.csv at sha256:${zeroStamp}\nMean = AVG(rates.Rate)\n\`\`\`\n`;

  const { model, snapshot } = await readNote(source, notePath, read);
  const doc = { path: snapshot.path, reader: snapshot.reader };
  const result = check(model, { doc });
  expect(result.findings.map((f) => f.code)).toContain("STALE");

  const report = reportFor(model, result, doc);
  expect(report.allRepairs.length).toBeGreaterThan(0);
  const repaired = applyEdits(model.source, report.allRepairs);
  const { model: model2, snapshot: snapshot2 } = await readNote(repaired, notePath, read);
  const after = check(model2, { doc: { path: snapshot2.path, reader: snapshot2.reader } });
  expect(after.findings.map((f) => f.code)).not.toContain("STALE");
  expect(after.findings.map((f) => f.code)).not.toContain("IMPORT");
});
