import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WRITES_DISABLED, closedGate, permits } from "../src/gate.js";

const root = mkdtempSync(join(tmpdir(), "visimark-mcp-gate-"));
const inside = join(root, "doc.md");
writeFileSync(inside, "# x\n");
const outsideRoot = mkdtempSync(join(tmpdir(), "visimark-mcp-out-"));
const outside = join(outsideRoot, "doc.md");
writeFileSync(outside, "# x\n");

test("all four combinations of flag and roots", () => {
  // The gate fails closed. No roots means no writes, even with the flag: an
  // operator who passes it into a host that declares nothing has not chosen a
  // blast radius, and the server does not choose one for them.
  expect(permits({ allowWrite: false, roots: [] }, inside)?.message).toBe(WRITES_DISABLED);
  expect(permits({ allowWrite: false, roots: [root] }, inside)?.message).toBe(WRITES_DISABLED);
  expect(permits({ allowWrite: true, roots: [] }, inside)?.message).toBe(WRITES_DISABLED);
  expect(permits({ allowWrite: true, roots: [root] }, inside)).toBeUndefined();
});

test("the default gate is the closed one", () => {
  expect(closedGate()).toEqual({ allowWrite: false, roots: [] });
  expect(permits(closedGate(), inside)?.code).toBe("WRITE");
});

test("a path outside every declared root is refused", () => {
  const f = permits({ allowWrite: true, roots: [root] }, outside);
  expect(f).toMatchObject({ code: "WRITE" });
  expect(f?.message).toContain("outside every declared root");
});

test("a root itself is inside itself", () => {
  expect(permits({ allowWrite: true, roots: [root] }, root)).toBeUndefined();
});

test("a sibling whose name merely starts with the root's is outside it", () => {
  // `relative()` alone would read `/tmp/rootEVIL` as inside `/tmp/root`.
  const sibling = `${root}-evil`;
  mkdirSync(sibling, { recursive: true });
  expect(permits({ allowWrite: true, roots: [root] }, join(sibling, "x.md"))?.code).toBe("WRITE");
});

test("a symlink out of a root does not read as a path inside it", () => {
  const link = join(root, "escape.md");
  symlinkSync(outside, link);
  expect(permits({ allowWrite: true, roots: [root] }, link)?.code).toBe("WRITE");
});

test("a file that does not exist yet is judged by where it would go", () => {
  // An artifact this run is about to create has no realpath, and its directory
  // is what containment is really about.
  expect(
    permits({ allowWrite: true, roots: [root] }, join(root, "charts/new.svg")),
  ).toBeUndefined();
  expect(permits({ allowWrite: true, roots: [root] }, join(outsideRoot, "new.svg"))?.code).toBe(
    "WRITE",
  );
});

test("several roots are an either-or", () => {
  const gate = { allowWrite: true, roots: [root, outsideRoot] };
  expect(permits(gate, inside)).toBeUndefined();
  expect(permits(gate, outside)).toBeUndefined();
});
