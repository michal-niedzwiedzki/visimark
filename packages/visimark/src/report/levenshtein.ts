export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Closest candidate by edit distance; ties broken by longer shared prefix, then
 * alphabetically. `maxDistance` bounds how wrong a suggestion may be — without
 * it the nearest candidate is always offered, however unlike the target.
 */
export function closest(
  target: string,
  candidates: Iterable<string>,
  maxDistance = Infinity,
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  let bestPrefix = -1;
  for (const c of candidates) {
    if (c === target) continue;
    const d = levenshtein(target, c);
    if (d > maxDistance) continue;
    const p = commonPrefix(target, c);
    if (
      d < bestDist ||
      (d === bestDist && p > bestPrefix) ||
      (d === bestDist && p === bestPrefix && best !== null && c < best)
    ) {
      best = c;
      bestDist = d;
      bestPrefix = p;
    }
  }
  return best;
}
