/**
 * A trailing debounce with `cancel`: the one thing the extension used
 * `obsidian`'s `debounce(fn, ms, true)` for. A further call before the timer
 * fires replaces the pending one outright.
 */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const call = (...args: A): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  return Object.assign(call, {
    cancel(): void {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  });
}
