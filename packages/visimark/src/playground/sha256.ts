/**
 * A synchronous, dependency-free SHA-256 over UTF-8 text — the browser half of
 * what `fs/node-reader.ts` gets from `node:crypto`.
 *
 * **Why this exists at all.** `ReaderPort.readSealed` returns the digest of the
 * bytes it read, synchronously, because `check` is synchronous and making it
 * async would break every CLI caller (`fs/reader.ts` explains why the digest
 * rides on the read rather than a sibling `hash()`). The browser's own
 * `crypto.subtle.digest` is asynchronous and therefore unusable here. The only
 * other way to get a digest into a browser `ReaderPort` would be to precompute
 * one at build time next to the preloaded CSV — but then the playground's
 * stamp check would be comparing a constant against a constant, which verifies
 * nothing and would make the tutorial's claim that the stamp is checked a
 * worse lie than the one review §4.3 is fixing. So: 60 lines of FIPS 180-4.
 *
 * **Why it lives here and not in `src/fs/`.** `src/playground/` is the browser
 * build's own directory, and scope is the point. The Node reader keeps
 * `node:crypto` — it is faster, audited, and `test/playground/browser-graph.test.ts`
 * exists precisely to keep `node:crypto` out of this graph, so the two
 * implementations must not be tempted to share a module that then has to pick
 * one at runtime. Putting it under `src/playground/` says "this is the one the
 * browser uses" structurally rather than by comment.
 *
 * **Why it is not inline in `docs/playground.html`.** Bit-twiddling that is
 * wrong is silently wrong: a broken digest would simply report every import as
 * `stale`, which looks like a content mismatch rather than a bug. In a
 * 2,600-line HTML file it would have no tests. Here it has `test/playground/
 * sha256.test.ts`, which pins it against the FIPS 180-4 vectors, against
 * `node:crypto` over randomised inputs, and against the stamp actually written
 * in `docs/playground/tutorial/13-imports.md`.
 */

/** FIPS 180-4 §4.2.2 — the first 32 bits of the cube roots of the first 64 primes */
// prettier-ignore
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * The lowercase hex SHA-256 of `bytes`.
 *
 * Exported separately from `sha256Hex` so the tests can feed it the same
 * `Uint8Array` `node:crypto` is given and compare digests over bytes that are
 * not valid UTF-8 — which is where a text-only API would hide a disagreement.
 */
export function sha256HexBytes(bytes: Uint8Array): string {
  // FIPS 180-4 §5.1.1: append 0x80, pad with zeros, then the 64-bit bit length
  const bitLen = bytes.length * 8;
  const withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  // the length is < 2^32 bits for any file a browser holds in memory, so the
  // high word is always zero; it is written anyway rather than assumed
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(withPad.length - 4, bitLen >>> 0);

  // §5.3.3 — the first 32 bits of the square roots of the first 8 primes
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map(hex8).join("");
}

function hex8(x: number): string {
  return (x >>> 0).toString(16).padStart(8, "0");
}

/**
 * The lowercase hex SHA-256 of `text` **encoded as UTF-8** — the same bytes
 * `node:crypto` hashes when `fs/node-reader.ts` reads a file, so a digest
 * computed here is comparable with a stamp `visimark fmt` wrote on disk.
 */
export function sha256Hex(text: string): string {
  return sha256HexBytes(new TextEncoder().encode(text));
}
