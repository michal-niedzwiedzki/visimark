import { expect, test } from "bun:test";
import manifest from "../package.json" with { type: "json" };

/** Every path an `exports` condition can resolve to, as a published path. */
function exportTargets(node: unknown, into: string[] = []): string[] {
  if (typeof node === "string") into.push(node);
  else if (node && typeof node === "object") {
    for (const value of Object.values(node)) exportTargets(value, into);
  }
  return into;
}

test("every exports target is inside a published files entry", () => {
  // `files` is what npm puts in the tarball. An `exports` condition pointing
  // outside it — the "bun" condition at ./src/index.ts, with only dist shipped
  // — is not a degraded run for that consumer: Bun resolves the condition
  // first, finds nothing, and fails the whole package resolution.
  const shipped = manifest.files as string[];
  for (const target of exportTargets(manifest.exports)) {
    const root = target.replace(/^\.\//, "").split("/")[0]!;
    expect({ target, shipped }).toMatchObject({ shipped: expect.arrayContaining([root]) });
  }
});
