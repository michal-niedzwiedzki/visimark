import type { TarEntry } from "../pack.ts";

const dec = new TextDecoder();
const field = (h: Uint8Array, from: number, len: number): string =>
  dec.decode(h.subarray(from, from + len)).replace(/\0.*$/s, "");

/** Read back a ustar archive, checking each header's checksum. Test-only. */
export function untar(buf: Uint8Array): TarEntry[] {
  const out: TarEntry[] = [];
  let at = 0;
  while (at + 512 <= buf.length) {
    const h = buf.subarray(at, at + 512);
    if (h.every((b) => b === 0)) break;
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i]!;
    const stored = parseInt(field(h, 148, 8).trim(), 8);
    if (sum !== stored) throw new Error(`bad checksum at ${at}: ${stored} != ${sum}`);
    const size = parseInt(field(h, 124, 12).trim(), 8);
    out.push({ name: field(h, 0, 100), bytes: buf.slice(at + 512, at + 512 + size) });
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
