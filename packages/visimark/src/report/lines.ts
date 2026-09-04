/**
 * The 1-based source line holding `offset`. Offsets are UTF-16 code units, so
 * this counts newlines in the same units every span in the engine is measured
 * in.
 */
export function lineOf(source: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source[i] === "\n") line++;
  return line;
}
