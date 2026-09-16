import { expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex, sha256HexBytes } from "../../src/playground/sha256.js";

/**
 * **Why this file exists.** `src/playground/sha256.ts` is the browser's
 * substitute for `node:crypto`, and a wrong SHA-256 fails *quietly*: every
 * import would simply read as `stale`, which looks exactly like a CSV somebody
 * edited. The playground would go on claiming it verifies the stamp while
 * verifying nothing — a worse lie than the one review §4.3 set out to fix. So
 * the implementation is pinned three ways: the published FIPS 180-4 vectors,
 * agreement with `node:crypto` over random bytes at every length across a
 * block boundary, and the digest the tutorial actually ships in
 * `13-imports.md`.
 *
 * **If one of these fails, the implementation is wrong, not the expectation.**
 * Fix `src/playground/sha256.ts`; never adjust a vector to match it.
 */

test("FIPS 180-4 published vectors", () => {
  expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  );
  expect(sha256Hex("a".repeat(1_000_000))).toBe(
    "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
  );
});

test("agrees with node:crypto at every length across a block boundary", () => {
  // 55/56 and 63/64 are where FIPS 180-4 §5.1.1's padding needs a second
  // block. An off-by-one there is invisible on a short test string and fatal
  // on a real file, so every length up to two blocks is checked rather than a
  // sample of them.
  for (let n = 0; n <= 130; n++) {
    const bytes = randomBytes(n);
    expect(sha256HexBytes(bytes), `length ${n}`).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  }
});

test("hashes text as UTF-8, the same bytes node:crypto reads off disk", () => {
  // a digest computed here is compared against a stamp `visimark fmt` wrote
  // through node:crypto, so the two encodings must not disagree on non-ASCII
  for (const s of ["café", "日本語", "a b", "\u{1f600}"]) {
    expect(sha256Hex(s), s).toBe(createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex"));
  }
});

test("reproduces the stamp written in the tutorial's imports chapter", () => {
  const root = join(import.meta.dir, "../../../../docs/playground/tutorial");
  const csv = readFileSync(join(root, "13-imports.csv"), "utf8");
  const chapter = readFileSync(join(root, "13-imports.md"), "utf8");
  const stamped = /at sha256:([0-9a-f]{64})/.exec(chapter)?.[1] ?? "(no stamp clause)";
  expect(
    sha256Hex(csv),
    "the browser SHA-256 no longer reproduces the stamp in " +
      "docs/playground/tutorial/13-imports.md. Either src/playground/sha256.ts is wrong or the " +
      "CSV changed without `visimark fmt` rewriting the stamp — fix whichever it is; do not " +
      "relax this test.",
  ).toBe(stamped);
});
