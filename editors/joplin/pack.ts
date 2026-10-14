/**
 * A POSIX ustar writer, just enough for a Joplin `.jpl` (spec §2.7). No
 * dependency and no `tar` process: mtime, uid and gid are 0, so equal inputs
 * give equal bytes on every OS.
 */
export interface TarEntry {
  name: string;
  bytes: Uint8Array;
}

const BLOCK = 512;
const enc = new TextEncoder();
const octal = (n: number, width: number): Uint8Array =>
  enc.encode(n.toString(8).padStart(width - 1, "0") + "\0");
const padded = (n: number): number => Math.ceil(n / BLOCK) * BLOCK;

export function ustar(entries: readonly TarEntry[]): Uint8Array {
  const size = entries.reduce((t, e) => t + BLOCK + padded(e.bytes.length), 0) + 2 * BLOCK;
  const out = new Uint8Array(size);
  let at = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    if (name.length > 100) throw new Error(`ustar: name longer than 100 bytes: ${e.name}`);
    const h = out.subarray(at, at + BLOCK);
    h.set(name, 0);
    h.set(octal(0o644, 8), 100);
    h.set(octal(0, 8), 108);
    h.set(octal(0, 8), 116);
    h.set(octal(e.bytes.length, 12), 124);
    h.set(octal(0, 12), 136);
    h.fill(0x20, 148, 156);
    h[156] = 0x30; // typeflag '0': a regular file
    h.set(enc.encode("ustar\0"), 257);
    h.set(enc.encode("00"), 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.set(enc.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148);
    out.set(e.bytes, at + BLOCK);
    at += BLOCK + padded(e.bytes.length);
  }
  return out;
}
