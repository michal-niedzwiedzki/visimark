/** The source lines `from..to`, numbered, so a reader can check the arithmetic by eye. */
export function excerpt(text: string, from: number, to: number, max = 14): string[] {
  const lines = text.split("\n");
  const wanted: number[] = [];
  for (let n = from; n <= to; n++) wanted.push(n);
  const shown = wanted.length > max ? [...wanted.slice(0, max - 2), -1, wanted.at(-1)!] : wanted;
  return shown.map((n) =>
    n === -1 ? "      ..." : `${String(n).padStart(5)}  ${(lines[n - 1] ?? "").replace(/\r$/, "")}`,
  );
}
