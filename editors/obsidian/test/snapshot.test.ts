import { expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { build, check, locate, type Finding } from "visimark";
// The Node reader, reached by path on purpose and only here. This file's job
// is to compare two hosts, so it legitimately needs both — and `onDisk` is
// deliberately absent from the browser entry point the rest of the plugin
// imports (#201), which is exactly the property under test.
import { onDisk } from "../../../packages/visimark/src/index.js";
import { readNote, toVaultPath, vaultSnapshot, type VaultRead } from "../src/snapshot.js";

/**
 * **What this proves.** A note read out of a vault must produce the same
 * findings as the same file read off a disk by the CLI. That is the whole
 * "one engine, thin client" claim at the one place it could quietly break —
 * the reader — and it is the claim a person cannot check by looking at the
 * plugin, because a wrong digest simply reports every import as stale, which
 * looks like a content mismatch rather than a bug.
 *
 * So every assertion below is a **comparison against the Node host**, not
 * against expectations typed out here. `docs/` stands in for a vault: it has a
 * CSV import with a `sha256:` stamp, five generated chart artifacts and a
 * dozen documents that read nothing at all.
 */

const docs = resolve(import.meta.dir, "../../../docs");

/** `docs/` as a vault: every file under it, keyed the way Obsidian keys them. */
function vaultOf(dir: string, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const key = prefix === "" ? entry : `${prefix}/${entry}`;
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "vendor") continue;
      for (const [k, v] of vaultOf(full, key)) out.set(k, v);
      continue;
    }
    try {
      out.set(key, readFileSync(full, "utf8"));
    } catch {
      // a binary file is not something a VisiMark document reads
    }
  }
  return out;
}

const vault = vaultOf(docs);
const readFromVault: VaultRead = (p) => Promise.resolve(vault.get(p) ?? null);

/** what a finding is, for comparison: code, message and where it points */
const shape = (f: Finding): string => `${f.code} ${f.name ?? ""} ${f.message}`;

async function vaultFindings(noteVaultPath: string): Promise<string[]> {
  const source = vault.get(noteVaultPath)!;
  const { model, snapshot } = await readNote(source, noteVaultPath, readFromVault);
  return check(model, { doc: { path: snapshot.path, reader: snapshot.reader } }).findings.map(
    shape,
  );
}

function diskFindings(noteVaultPath: string): string[] {
  const full = join(docs, noteVaultPath);
  const model = build(locate(readFileSync(full, "utf8")));
  return check(model, { doc: onDisk(full) }).findings.map(shape);
}

test("toVaultPath is the whole translation between engine space and vault space", () => {
  expect(toVaultPath("/notes/q3.csv")).toBe("notes/q3.csv");
  expect(toVaultPath("notes/q3.csv")).toBe("notes/q3.csv");
  expect(toVaultPath("/")).toBe("");
});

test("a note that reads nothing needs one round and holds nothing", async () => {
  const { snapshot } = await readNote(
    vault.get("example-invoice.md")!,
    "example-invoice.md",
    readFromVault,
  );
  expect(snapshot.held.size).toBe(0);
  expect(snapshot.rounds).toBe(1);
});

test("a CSV import resolves out of the vault, stamp and all", async () => {
  const note = "example-invoice-csv-import.md";
  const { snapshot } = await readNote(vault.get(note)!, note, readFromVault);
  expect([...snapshot.held]).toContain("/example-invoice-csv-import.csv");
  // the file is stamped `at sha256:…` in the document, so agreeing with the
  // Node host here means the synchronous digest agrees with node:crypto's
  expect(await vaultFindings(note)).toEqual(diskFindings(note));
});

test("generated chart artifacts resolve out of the vault", async () => {
  const note = "example-charts.md";
  const { snapshot } = await readNote(vault.get(note)!, note, readFromVault);
  expect([...snapshot.held]).toContain("/charts/example-charts-sales.svg");
  expect(await vaultFindings(note)).toEqual(diskFindings(note));
});

test("every worked example gives the vault host the same findings as the Node host", async () => {
  // the corpus, not a chosen pair: 12 documents, including the ones that read
  // nothing, so a reader that answered wrongly in either direction shows up
  const notes = readdirSync(docs).filter((f) => f.startsWith("example-") && f.endsWith(".md"));
  expect(notes.length).toBeGreaterThan(5);
  const disagreements: string[] = [];
  for (const note of notes) {
    const fromVault = await vaultFindings(note);
    const fromDisk = diskFindings(note);
    if (JSON.stringify(fromVault) !== JSON.stringify(fromDisk)) {
      disagreements.push(
        `${note}\n  vault: ${fromVault.join(" | ")}\n  disk:  ${fromDisk.join(" | ")}`,
      );
    }
  }
  expect(disagreements, disagreements.join("\n")).toEqual([]);
});

test("path discovery settles, which is the invariant the design rests on", async () => {
  // §2.6 claims nothing in the engine asks the reader for a path a parse of
  // the document did not name — so what is asked for cannot depend on what
  // was answered, and one fetch round is always enough. If that were false
  // this would creep up, and vaultSnapshot would throw rather than loop.
  const notes = readdirSync(docs).filter((f) => f.startsWith("example-") && f.endsWith(".md"));
  const rounds = new Map<string, number>();
  for (const note of notes) {
    const { snapshot } = await readNote(vault.get(note)!, note, readFromVault);
    rounds.set(note, snapshot.rounds);
  }
  const late = [...rounds].filter(([, r]) => r > 2).map(([n, r]) => `${n}: ${r}`);
  expect(late, `${late.join(", ")} — discovery needed a third round`).toEqual([]);
});

test("a file outside the vault is absent, and the engine says so in its own words", async () => {
  const source = [
    "| Item | Qty |",
    "|---|---|",
    "| a | 1 |",
    "",
    "```vmark #lines from ../../etc/passwd labelled Item, Qty",
    "```",
    "",
  ].join("\n");
  const { model, snapshot } = await readNote(source, "notes/q3.md", readFromVault);
  // the plugin adds no path policy of its own: nothing was fetched, and the
  // finding is the engine's ordinary one for a file it could not read
  expect(snapshot.held.size).toBe(0);
  const findings = check(model, { doc: { path: snapshot.path, reader: snapshot.reader } }).findings;
  expect(findings.map((f) => f.code)).toContain("IMPORT");
});

test("the recorded set is what the note reads, and nothing else", async () => {
  const note = "example-invoice-csv-import.md";
  const { snapshot } = await readNote(vault.get(note)!, note, readFromVault);
  const held = [...snapshot.held].map((p) => relative("/", p));
  expect(held).toEqual(["example-invoice-csv-import.csv"]);
});

test("VaultRead owns the catching, and the snapshot does not swallow", async () => {
  // The contract is `null` for anything unreadable, and the caller is what
  // turns a rejected `vault.adapter.read` into one. Asserted rather than
  // assumed, because the tempting alternative — catching in here — would turn
  // a vault that has gone away into a note that silently reports every import
  // as missing, which reads exactly like a real IMPORT finding.
  const angry: VaultRead = () => Promise.reject(new Error("permission denied"));
  const note = "example-invoice-csv-import.md";
  await expect(vaultSnapshot(build(locate(vault.get(note)!)), note, angry)).rejects.toThrow(
    "permission denied",
  );

  // and the shape the plugin actually passes: catching at the boundary
  const safe: VaultRead = () => Promise.reject(new Error("nope")).catch((): string | null => null);
  const { snapshot } = await readNote(vault.get(note)!, note, safe);
  expect(snapshot.held.size).toBe(0);
  expect([...snapshot.asked]).toContain("/example-invoice-csv-import.csv");
});
