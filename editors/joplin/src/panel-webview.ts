/**
 * The findings panel's own script, in its webview: a click on a row or the
 * Cancel button posts what it was to the plugin (`panel.ts`).
 */
declare const webviewApi: { postMessage(message: unknown): Promise<unknown> };

document.addEventListener("click", (event) => {
  const el = (event.target as Element | null)?.closest<HTMLElement>("[data-action]");
  if (!el) return;
  void webviewApi.postMessage({
    kind: el.dataset.action,
    start: el.dataset.start === undefined ? undefined : Number(el.dataset.start),
    end: el.dataset.end === undefined ? undefined : Number(el.dataset.end),
    id: el.dataset.id,
  });
});
